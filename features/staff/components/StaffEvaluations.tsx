import React, { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { Award, ChevronDown, ChevronUp, Star } from 'lucide-react';

export default function StaffEvaluations({ evals: initialData, employee }: any) {
    const [evals, setEvals] = useState<any[]>(initialData || []);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchEvals = async () => {
            if(!employee?.employee_id) return;
            const { data } = await supabase
                .from('evaluations')
                .select('*')
                .eq('employee_id', employee.employee_id)
                .order('month', { ascending: false });
            
            if(data) setEvals(data);
            setLoading(false);
        };
        fetchEvals();
    }, [employee]);

    const toggleExpand = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
    };

    // دالة مساعدة لعرض تفاصيل الدرجة
    const ScoreRow = ({ label, score, max }: any) => (
        <div className="flex justify-between items-center text-sm py-2 border-b border-gray-50 last:border-0">
            <span className="text-gray-600">{label}</span>
            <span className="font-bold text-gray-800">{score} <span className="text-gray-300 text-xs">/ {max}</span></span>
        </div>
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                <Award className="w-6 h-6 text-purple-600"/> تقييمات الأداء
            </h3>

            {loading ? (
                <div className="text-center py-8 text-gray-400">جاري تحميل التقييمات...</div>
            ) : evals.length === 0 ? (
                <div className="bg-purple-50 p-8 rounded-3xl text-center border border-purple-100">
                    <p className="text-purple-800 font-bold">لم يتم تسجيل تقييمات بعد</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {evals.map((ev) => (
                        <div key={ev.id} className="bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden transition-all hover:shadow-md">
                            {/* Header Card */}
                            <div 
                                onClick={() => toggleExpand(ev.id)}
                                className="p-5 flex items-center justify-between cursor-pointer bg-gradient-to-l from-white to-gray-50"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white shadow-lg ${
                                        ev.total_score >= 90 ? 'bg-emerald-500 shadow-emerald-200' : 
                                        ev.total_score >= 75 ? 'bg-blue-500 shadow-blue-200' : 'bg-orange-500 shadow-orange-200'
                                    }`}>
                                        {ev.total_score}%
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-800 text-lg">تقييم شهر {ev.month}</h4>
                                        <p className="text-xs text-gray-500 font-bold mt-1">
                                            {ev.total_score >= 90 ? 'مستوى ممتاز 🌟' : ev.total_score >= 75 ? 'مستوى جيد جداً 👍' : 'يحتاج تحسين 📉'}
                                        </p>
                                    </div>
                                </div>
                                {expandedId === ev.id ? <ChevronUp className="text-gray-400"/> : <ChevronDown className="text-gray-400"/>}
                            </div>

                            {/* Expanded Details */}
                            {expandedId === ev.id && (
                                <div className="p-5 bg-gray-50 border-t border-gray-100 animate-in slide-in-from-top-2">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                                        <ScoreRow label="المظهر العام" score={ev.score_appearance} max={10} />
                                        <ScoreRow label="الحضور والانتظام" score={ev.score_attendance} max={10} />
                                        <ScoreRow label="لجان الجودة" score={ev.score_quality} max={10} />
                                        <ScoreRow label="مكافحة العدوى" score={ev.score_infection} max={10} />
                                        <ScoreRow label="التدريب" score={ev.score_training} max={10} />
                                        <ScoreRow label="الملفات الطبية" score={ev.score_records} max={10} />
                                        <div className="col-span-1 md:col-span-2 mt-2 pt-2 border-t border-gray-200">
                                            <div className="flex justify-between items-center">
                                                <span className="font-bold text-gray-700">أداء الأعمال المسندة</span>
                                                <span className="font-black text-purple-600 text-lg">{ev.score_tasks} <span className="text-xs text-gray-400">/ 40</span></span>
                                            </div>
                                        </div>
                                    </div>
                                    {ev.notes && (
                                        <div className="mt-4 p-3 bg-yellow-50 text-yellow-800 text-sm rounded-xl border border-yellow-100">
                                            <strong>ملاحظات:</strong> {ev.notes}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
