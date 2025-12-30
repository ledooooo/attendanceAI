import React, { useState } from 'react';
import { Award, Star, TrendingUp, Plus, Save, X, Clock, User } from 'lucide-react'; // تم التصحيح هنا
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';

interface Props {
    evals: any[];
    employee?: Employee; // مطلوب للمدير
    isAdmin?: boolean;   // هل المستخدم مدير؟
    onUpdate?: () => void; // لتحديث البيانات بعد الحفظ
}

export default function StaffEvaluations({ evals, employee, isAdmin = false, onUpdate }: Props) {
    const [showAddForm, setShowAddForm] = useState(false);
    const [newEval, setNewEval] = useState({
        month: new Date().toISOString().slice(0, 7),
        score_performance: 0,
        score_attendance: 0,
        score_appearance: 0,
        notes: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!employee) return;

        // حساب الدرجة النهائية
        const total = Math.round(
            (Number(newEval.score_performance) + Number(newEval.score_attendance) + Number(newEval.score_appearance)) / 3
        );

        const { error } = await supabase.from('evaluations').insert({
            employee_id: employee.employee_id,
            month: newEval.month,
            score_performance: newEval.score_performance,
            score_attendance: newEval.score_attendance,
            score_appearance: newEval.score_appearance,
            total_score: total,
            notes: newEval.notes
        });

        if (!error) {
            alert('تم حفظ التقييم بنجاح ✅');
            setShowAddForm(false);
            setNewEval({ month: new Date().toISOString().slice(0, 7), score_performance: 0, score_attendance: 0, score_appearance: 0, notes: '' });
            if (onUpdate) onUpdate();
        } else {
            alert('حدث خطأ: ' + error.message);
        }
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
            {/* رأس الصفحة وزر الإضافة للمدير */}
            <div className="flex justify-between items-center">
                <h3 className="text-2xl font-black flex items-center gap-3 text-gray-800">
                    <Award className="text-yellow-500 w-7 h-7" /> التقييمات الشهرية
                </h3>
                {isAdmin && !showAddForm && (
                    <button 
                        onClick={() => setShowAddForm(true)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-sm"
                    >
                        <Plus className="w-5 h-5"/> إضافة تقييم
                    </button>
                )}
            </div>

            {/* نموذج الإضافة (للمدير فقط) */}
            {showAddForm && isAdmin && (
                <div className="bg-gray-50 border border-blue-200 rounded-[2.5rem] p-6 mb-6 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="font-bold text-blue-800">تقييم جديد</h4>
                        <button onClick={() => setShowAddForm(false)} className="bg-white p-2 rounded-full hover:text-red-500 transition-colors"><X className="w-5 h-5"/></button>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">الشهر</label>
                                <input type="month" required className="w-full p-3 rounded-xl border border-gray-300" 
                                    value={newEval.month} onChange={e => setNewEval({...newEval, month: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">الأداء الفني (100%)</label>
                                <input type="number" min="0" max="100" required className="w-full p-3 rounded-xl border border-gray-300" 
                                    value={newEval.score_performance} onChange={e => setNewEval({...newEval, score_performance: Number(e.target.value)})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">الالتزام والمواعيد (100%)</label>
                                <input type="number" min="0" max="100" required className="w-full p-3 rounded-xl border border-gray-300" 
                                    value={newEval.score_attendance} onChange={e => setNewEval({...newEval, score_attendance: Number(e.target.value)})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">المظهر والسلوك (100%)</label>
                                <input type="number" min="0" max="100" required className="w-full p-3 rounded-xl border border-gray-300" 
                                    value={newEval.score_appearance} onChange={e => setNewEval({...newEval, score_appearance: Number(e.target.value)})} />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">ملاحظات</label>
                            <textarea className="w-full p-3 rounded-xl border border-gray-300 h-20"
                                value={newEval.notes} onChange={e => setNewEval({...newEval, notes: e.target.value})}></textarea>
                        </div>
                        <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 flex justify-center items-center gap-2">
                            <Save className="w-5 h-5"/> حفظ التقييم
                        </button>
                    </form>
                </div>
            )}

            {/* قائمة التقييمات السابقة */}
            <div className="grid gap-4">
                {evals.length === 0 ? (
                    <div className="text-center py-10 bg-gray-50 rounded-3xl border border-dashed border-gray-300">
                        <p className="text-gray-400 font-bold">لا توجد تقييمات مسجلة بعد</p>
                    </div>
                ) : evals.map((evalItem) => (
                    <div key={evalItem.id} className="bg-white p-5 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col md:flex-row gap-6 hover:shadow-md transition-shadow relative overflow-hidden group">
                        <div className={`absolute top-0 right-0 w-2 h-full ${evalItem.total_score >= 90 ? 'bg-emerald-500' : evalItem.total_score >= 75 ? 'bg-blue-500' : evalItem.total_score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                        
                        <div className="flex flex-col items-center justify-center min-w-[100px] border-l pl-6 border-gray-100">
                            <div className="relative">
                                <Star className={`w-12 h-12 ${evalItem.total_score >= 90 ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                                <span className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xs font-black text-gray-700 pt-1">
                                    {evalItem.total_score}%
                                </span>
                            </div>
                            <span className="text-sm font-bold text-gray-600 mt-2">{evalItem.month}</span>
                        </div>

                        <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div className="bg-blue-50 p-3 rounded-2xl">
                                <span className="text-[10px] text-blue-600 font-bold block mb-1">الأداء الفني</span>
                                <div className="flex items-center gap-1">
                                    <TrendingUp className="w-4 h-4 text-blue-600"/>
                                    <span className="text-lg font-black text-gray-800">{evalItem.score_performance}%</span>
                                </div>
                            </div>
                            <div className="bg-purple-50 p-3 rounded-2xl">
                                <span className="text-[10px] text-purple-600 font-bold block mb-1">الالتزام</span>
                                <div className="flex items-center gap-1">
                                    <Clock className="w-4 h-4 text-purple-600"/>
                                    <span className="text-lg font-black text-gray-800">{evalItem.score_attendance}%</span>
                                </div>
                            </div>
                            <div className="bg-orange-50 p-3 rounded-2xl">
                                <span className="text-[10px] text-orange-600 font-bold block mb-1">المظهر</span>
                                <div className="flex items-center gap-1">
                                    <User className="w-4 h-4 text-orange-600"/>
                                    <span className="text-lg font-black text-gray-800">{evalItem.score_appearance}%</span>
                                </div>
                            </div>
                            {evalItem.notes && (
                                <div className="col-span-2 md:col-span-3 bg-gray-50 p-3 rounded-2xl mt-1">
                                    <p className="text-xs text-gray-500 font-medium line-clamp-2">
                                        <span className="font-bold text-gray-700">ملاحظات:</span> {evalItem.notes}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
