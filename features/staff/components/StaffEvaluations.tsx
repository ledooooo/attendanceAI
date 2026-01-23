import React, { useState } from 'react';
import { Award, Edit, Trash2, Plus, Save, X, Calendar, Search, Loader2 } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import { Employee, Evaluation } from '../../../types';
import toast from 'react-hot-toast';
// 1. ✅ استيراد React Query
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Props {
    // evals: Evaluation[]; // لم نعد بحاجة لتمريرها كـ prop لأننا سنجلبها هنا
    employee?: Employee;
    isAdmin?: boolean;
    onUpdate?: () => void;
}

export default function StaffEvaluations({ employee, isAdmin = false }: Props) {
    const queryClient = useQueryClient();
    
    // UI State
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [showForm, setShowForm] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [currentEvalId, setCurrentEvalId] = useState<string | null>(null);

    // Initial Form State
    const initialFormState = {
        month: new Date().toISOString().slice(0, 7),
        score_appearance: 0,
        score_attendance: 0,
        score_quality: 0,
        score_infection: 0,
        score_training: 0,
        score_records: 0,
        score_tasks: 0,
        notes: ''
    };

    const [formData, setFormData] = useState(initialFormState);

    // ------------------------------------------------------------------
    // 1. 📥 جلب التقييمات (Query)
    // ------------------------------------------------------------------
    const { data: evals = [], isLoading } = useQuery({
        queryKey: ['staff_evaluations', employee?.employee_id],
        queryFn: async () => {
            if (!employee?.employee_id) return [];
            const { data, error } = await supabase
                .from('evaluations')
                .select('*')
                .eq('employee_id', employee.employee_id)
                .order('month', { ascending: false });
            
            if (error) throw error;
            return data as Evaluation[];
        },
        enabled: !!employee?.employee_id, // لا يعمل إلا بوجود موظف
        staleTime: 1000 * 60 * 10, // البيانات صالحة لمدة 10 دقائق
    });

    // ------------------------------------------------------------------
    // 2. 🛠️ الحفظ (Insert/Update Mutation)
    // ------------------------------------------------------------------
    const saveMutation = useMutation({
        mutationFn: async (data: any) => {
            const total = 
                Number(data.score_appearance) + 
                Number(data.score_attendance) + 
                Number(data.score_quality) + 
                Number(data.score_infection) + 
                Number(data.score_training) + 
                Number(data.score_records) + 
                Number(data.score_tasks);

            const payload = {
                employee_id: employee?.employee_id,
                month: data.month,
                year: parseInt(data.month.split('-')[0]),
                score_appearance: Number(data.score_appearance),
                score_attendance: Number(data.score_attendance),
                score_quality: Number(data.score_quality),
                score_infection: Number(data.score_infection),
                score_training: Number(data.score_training),
                score_records: Number(data.score_records),
                score_tasks: Number(data.score_tasks),
                total_score: total,
                notes: data.notes
            };

            if (editMode && currentEvalId) {
                const { error } = await supabase.from('evaluations').update(payload).eq('id', currentEvalId);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('evaluations').insert(payload);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['staff_evaluations'] });
            toast.success(editMode ? 'تم تحديث التقييم بنجاح' : 'تم إضافة التقييم بنجاح');
            setShowForm(false);
            setEditMode(false);
            setFormData(initialFormState);
        },
        onError: (err: any) => toast.error(`حدث خطأ: ${err.message}`)
    });

    // ------------------------------------------------------------------
    // 3. 🗑️ الحذف (Delete Mutation)
    // ------------------------------------------------------------------
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('evaluations').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['staff_evaluations'] });
            toast.success('تم حذف التقييم');
        },
        onError: () => toast.error('فشل الحذف')
    });

    // ------------------------------------------------------------------
    // 4. 🎨 دوال المساعدة والعرض
    // ------------------------------------------------------------------

    const filteredEvals = evals.filter(ev => ev.month === selectedMonth);

    const openEdit = (evalItem: any) => {
        setFormData({
            month: evalItem.month,
            score_appearance: evalItem.score_appearance || 0,
            score_attendance: evalItem.score_attendance || 0,
            score_quality: evalItem.score_quality || 0,
            score_infection: evalItem.score_infection || 0,
            score_training: evalItem.score_training || 0,
            score_records: evalItem.score_records || 0,
            score_tasks: evalItem.score_tasks || 0,
            notes: evalItem.notes || ''
        });
        setCurrentEvalId(evalItem.id);
        setEditMode(true);
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        saveMutation.mutate(formData);
    };

    const handleDelete = (id: string) => {
        if (confirm('هل أنت متأكد من حذف هذا التقييم؟')) {
            deleteMutation.mutate(id);
        }
    };

    const currentTotal = 
        Number(formData.score_appearance) + 
        Number(formData.score_attendance) + 
        Number(formData.score_quality) + 
        Number(formData.score_infection) + 
        Number(formData.score_training) + 
        Number(formData.score_records) + 
        Number(formData.score_tasks);

    if (isLoading) {
        return <div className="text-center py-10 flex flex-col items-center gap-2"><Loader2 className="w-8 h-8 animate-spin text-purple-600"/><span>جاري تحميل التقييمات...</span></div>;
    }

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom duration-500 pb-20">
            {/* Header with Month Filter */}
            <div className="flex flex-col md:flex-row justify-between items-center border-b pb-4 gap-4">
                <h3 className="text-2xl font-black flex items-center gap-3 text-gray-800">
                    <Award className="text-purple-600 w-7 h-7" /> التقييمات الشهرية
                </h3>
                
                <div className="flex items-center gap-3 w-full md:w-auto">
                    {/* ✅ فلتر اختيار الشهر */}
                    <div className="relative flex-1 md:w-48">
                        <input 
                            type="month" 
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 bg-white font-bold text-gray-700 focus:border-purple-500 outline-none shadow-sm"
                        />
                        <Calendar className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>

                    {isAdmin && !showForm && (
                        <button 
                            onClick={() => { 
                                setEditMode(false); 
                                setFormData(initialFormState); 
                                setShowForm(true); 
                            }} 
                            className="bg-purple-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-purple-700 transition-all shadow-lg hover:shadow-purple-200 text-sm whitespace-nowrap"
                        >
                            <Plus className="w-4 h-4"/> إضافة
                        </button>
                    )}
                </div>
            </div>

            {/* Form (Admin Only) */}
            {showForm && isAdmin && (
                <div className="bg-gray-50 border border-purple-200 rounded-[2.5rem] p-6 mb-8 shadow-sm relative overflow-hidden animate-in fade-in">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-purple-100 rounded-bl-full opacity-50 pointer-events-none"></div>
                    
                    <div className="flex justify-between items-center mb-6 relative z-10">
                        <h4 className="font-bold text-purple-800 text-lg flex items-center gap-2">
                            {editMode ? <Edit className="w-5 h-5"/> : <Plus className="w-5 h-5"/>}
                            {editMode ? 'تعديل التقييم الحالي' : 'إضافة تقييم شهر جديد'}
                        </h4>
                        <button onClick={() => setShowForm(false)} className="bg-white p-2 rounded-full text-gray-500 hover:text-red-500 hover:bg-red-50 transition-colors shadow-sm">
                            <X className="w-5 h-5"/>
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="md:col-span-2 lg:col-span-1">
                                <label className="block text-xs font-bold text-gray-500 mb-1.5">شهر التقييم</label>
                                <input 
                                    type="month" 
                                    required 
                                    className="w-full p-3 rounded-xl border border-gray-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none transition-all font-bold text-gray-700" 
                                    value={formData.month} 
                                    onChange={e => setFormData({...formData, month: e.target.value})} 
                                    disabled={editMode}
                                />
                            </div>
                            
                            <InputGroup label="المظهر العام (10)" max={10} val={formData.score_appearance} setVal={(v:any)=>setFormData({...formData, score_appearance: v})} />
                            <InputGroup label="لجان الجودة (10)" max={10} val={formData.score_quality} setVal={(v:any)=>setFormData({...formData, score_quality: v})} />
                            <InputGroup label="مكافحة العدوى (10)" max={10} val={formData.score_infection} setVal={(v:any)=>setFormData({...formData, score_infection: v})} />
                            
                            <InputGroup label="الحضور والغياب (20)" max={20} val={formData.score_attendance} setVal={(v:any)=>setFormData({...formData, score_attendance: v})} />
                            <InputGroup label="التدريب (20)" max={20} val={formData.score_training} setVal={(v:any)=>setFormData({...formData, score_training: v})} />
                            <InputGroup label="الملفات الطبية (20)" max={20} val={formData.score_records} setVal={(v:any)=>setFormData({...formData, score_records: v})} />
                            <InputGroup label="أداء الأعمال (10)" max={10} val={formData.score_tasks} setVal={(v:any)=>setFormData({...formData, score_tasks: v})} />
                        </div>

                        <div className="flex flex-col md:flex-row gap-4 items-stretch">
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-gray-500 mb-1.5">ملاحظات المدير</label>
                                <textarea 
                                    className="w-full p-3 rounded-xl border border-gray-300 focus:border-purple-500 outline-none h-24 text-sm resize-none"
                                    placeholder="اكتب أي ملاحظات إضافية هنا..." 
                                    value={formData.notes} 
                                    onChange={e => setFormData({...formData, notes: e.target.value})}
                                ></textarea>
                            </div>
                            <div className="w-full md:w-48 bg-purple-600 rounded-2xl p-4 flex flex-col items-center justify-center text-white shadow-lg">
                                <span className="text-xs font-bold opacity-80 mb-1">المجموع الكلي</span>
                                <span className="text-4xl font-black">{currentTotal}</span>
                                <span className="text-xs opacity-60">من 100</span>
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={saveMutation.isPending}
                            className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold hover:bg-gray-800 flex justify-center items-center gap-2 transition-all shadow-xl hover:shadow-2xl disabled:opacity-70"
                        >
                            {saveMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>} 
                            {saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ التقييم'}
                        </button>
                    </form>
                </div>
            )}

            {/* List */}
            <div className="grid gap-4">
                {filteredEvals.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-[2.5rem] border border-dashed border-gray-200 animate-in fade-in">
                        <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Search className="w-8 h-8 text-gray-400"/>
                        </div>
                        <p className="text-gray-500 font-bold mb-1">لا يوجد تقييم لشهر <span dir="ltr">{selectedMonth}</span></p>
                        <p className="text-xs text-gray-400">يرجى اختيار شهر آخر أو انتظار التقييم</p>
                    </div>
                ) : filteredEvals.map((ev) => (
                    <div key={ev.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col lg:flex-row gap-6 relative group overflow-hidden transition-all hover:shadow-md animate-in slide-in-from-bottom-2">
                        <div className={`absolute top-0 right-0 w-2 h-full transition-colors ${
                            ev.total_score >= 90 ? 'bg-emerald-500' : 
                            ev.total_score >= 75 ? 'bg-blue-500' : 
                            ev.total_score >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}></div>

                        <div className="flex lg:flex-col items-center justify-between lg:justify-center min-w-[120px] lg:border-l lg:pl-6 border-gray-100 pb-4 lg:pb-0 border-b lg:border-b-0">
                            <div className="text-center">
                                <span className="text-4xl font-black text-gray-800 block">{ev.total_score}</span>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">الإجمالي</span>
                            </div>
                            <div className="bg-gray-100 px-3 py-1 rounded-lg mt-2 lg:mt-4">
                                <span className="text-sm font-bold text-gray-600 font-mono">{ev.month}</span>
                            </div>
                        </div>

                        <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            <ScoreItem label="المظهر" val={ev.score_appearance || 0} max={10} color="orange"/>
                            <ScoreItem label="الحضور" val={ev.score_attendance || 0} max={20} color="purple"/>
                            <ScoreItem label="الجودة" val={ev.score_quality || 0} max={10} color="blue"/>
                            <ScoreItem label="العدوى" val={ev.score_infection || 0} max={10} color="red"/>
                            <ScoreItem label="التدريب" val={ev.score_training || 0} max={20} color="green"/>
                            <ScoreItem label="الملفات" val={ev.score_records || 0} max={20} color="indigo"/>
                            <ScoreItem label="الأعمال" val={ev.score_tasks || 0} max={10} color="pink"/>
                            
                            {ev.notes && (
                                <div className="col-span-2 sm:col-span-3 md:col-span-4 bg-gray-50 p-3 rounded-2xl mt-2 border border-gray-100">
                                    <p className="text-xs text-gray-500 font-medium leading-relaxed">
                                        <span className="font-bold text-gray-700 block mb-1">ملاحظات:</span> 
                                        {ev.notes}
                                    </p>
                                </div>
                            )}
                        </div>

                        {isAdmin && (
                            <div className="flex lg:flex-col gap-2 justify-end items-center border-t lg:border-t-0 lg:border-r lg:pr-6 pt-4 lg:pt-0 border-gray-100">
                                <button 
                                    onClick={() => openEdit(ev)} 
                                    className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors tooltip"
                                    title="تعديل"
                                >
                                    <Edit className="w-5 h-5"/>
                                </button>
                                <button 
                                    onClick={() => handleDelete(ev.id)} 
                                    disabled={deleteMutation.isPending}
                                    className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors tooltip disabled:opacity-50"
                                    title="حذف"
                                >
                                    {deleteMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin"/> : <Trash2 className="w-5 h-5"/>}
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

const InputGroup = ({ label, max, val, setVal }: any) => (
    <div>
        <label className="block text-[10px] font-bold text-gray-400 mb-1 flex justify-between">
            {label} <span className="text-gray-300">Max: {max}</span>
        </label>
        <input 
            type="number" 
            min="0" 
            max={max} 
            className="w-full p-3 rounded-xl border border-gray-200 focus:border-purple-500 outline-none font-bold text-gray-700 text-center" 
            value={val} 
            onChange={e => setVal(Math.min(max, Math.max(0, Number(e.target.value))))}
        />
    </div>
);

const ScoreItem = ({ label, val, max, color }: any) => (
    <div className={`bg-${color}-50 p-3 rounded-2xl border border-${color}-100 flex flex-col items-center justify-center`}>
        <span className={`text-[10px] font-bold text-${color}-600 mb-1`}>{label}</span>
        <div className="flex items-baseline gap-0.5">
            <span className="text-lg font-black text-gray-800">{val}</span>
            <span className="text-[10px] text-gray-400 font-medium">/{max}</span>
        </div>
    </div>
);
