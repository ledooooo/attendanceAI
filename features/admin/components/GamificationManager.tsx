import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../supabaseClient';
import { 
    Gift, CheckCircle, XCircle, PlusCircle, HelpCircle, 
    Save, Loader2, Cake, Trophy, History 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Input, Select } from '../../../components/ui/FormElements';

export default function GamificationManager() {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'requests' | 'questions'>('requests');

    // --- State للأسئلة الجديدة ---
    const [newQuestion, setNewQuestion] = useState({
        question_text: '',
        options: ['', '', '', ''], // 4 خيارات
        correct_answer: '',
        specialty: 'all',
        points: 10
    });

    // 1. جلب طلبات الجوائز المعلقة
    const { data: pendingRequests = [] } = useQuery({
        queryKey: ['admin_pending_rewards'],
        queryFn: async () => {
            const { data } = await supabase
                .from('rewards_redemptions')
                .select('*, employees(name), rewards_catalog(title)')
                .eq('status', 'pending')
                .order('created_at', { ascending: false });
            return data || [];
        }
    });

    // 2. معالجة الطلب (قبول/رفض)
    const handleRequestMutation = useMutation({
        mutationFn: async ({ id, status, empId, cost }: { id: string, status: 'approved' | 'rejected', empId: string, cost: number }) => {
            // تحديث حالة الطلب
            const { error } = await supabase
                .from('rewards_redemptions')
                .update({ status })
                .eq('id', id);
            
            if (error) throw error;

            // في حالة الرفض، نعيد النقاط للموظف
            if (status === 'rejected') {
                await supabase.rpc('increment_points', { 
                    emp_id: empId, 
                    amount: cost 
                });
                // نسجل سبب الاسترجاع
                await supabase.from('points_ledger').insert({
                    employee_id: empId,
                    points: cost,
                    reason: 'استرداد نقاط (رفض طلب جائزة)'
                });
            }
        },
        onSuccess: (_, variables) => {
            toast.success(variables.status === 'approved' ? 'تمت الموافقة على الطلب' : 'تم رفض الطلب واسترجاع النقاط');
            queryClient.invalidateQueries({ queryKey: ['admin_pending_rewards'] });
        },
        onError: () => toast.error('حدث خطأ أثناء المعالجة')
    });

    // 3. إضافة سؤال جديد
    const addQuestionMutation = useMutation({
        mutationFn: async () => {
            if (!newQuestion.question_text || !newQuestion.correct_answer) throw new Error("أكمل البيانات");
            
            const payload = {
                question_text: newQuestion.question_text,
                options: JSON.stringify(newQuestion.options), // تحويل المصفوفة لنص JSON
                correct_answer: newQuestion.correct_answer,
                specialty: newQuestion.specialty,
                points: newQuestion.points
            };

            const { error } = await supabase.from('quiz_questions').insert([payload]);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success('تم إضافة السؤال بنك الأسئلة');
            setNewQuestion({ question_text: '', options: ['', '', '', ''], correct_answer: '', specialty: 'all', points: 10 });
        },
        onError: (err: any) => toast.error(err.message)
    });

    // 4. فحص أعياد الميلاد يدوياً
    const checkBirthdays = async () => {
        const loadingToast = toast.loading('جاري فحص أعياد الميلاد...');
        try {
            const { error } = await supabase.rpc('check_birthdays_daily');
            if (error) throw error;
            toast.success('تم توزيع هدايا عيد الميلاد لمن يستحق!', { id: loadingToast });
        } catch (err) {
            toast.error('حدث خطأ', { id: loadingToast });
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            
            {/* Header Stats & Actions */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-3xl shadow-sm border gap-4">
                <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
                    <Trophy className="w-6 h-6 text-yellow-500"/> إدارة التحفيز والجوائز
                </h2>
                <button 
                    onClick={checkBirthdays}
                    className="bg-pink-50 text-pink-600 px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-pink-100 transition-colors border border-pink-200"
                >
                    <Cake className="w-4 h-4"/> فحص أعياد الميلاد اليوم
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                <button 
                    onClick={() => setActiveTab('requests')}
                    className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 ${activeTab === 'requests' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                >
                    <Gift className="w-4 h-4"/> طلبات الجوائز 
                    {pendingRequests.length > 0 && <span className="bg-red-500 text-white text-[10px] px-2 rounded-full">{pendingRequests.length}</span>}
                </button>
                <button 
                    onClick={() => setActiveTab('questions')}
                    className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 ${activeTab === 'questions' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                >
                    <HelpCircle className="w-4 h-4"/> بنك الأسئلة
                </button>
            </div>

            {/* Content: Requests */}
            {activeTab === 'requests' && (
                <div className="bg-white rounded-[30px] border shadow-sm overflow-hidden">
                    {pendingRequests.length === 0 ? (
                        <div className="text-center py-20">
                            <CheckCircle className="w-16 h-16 mx-auto text-green-200 mb-4"/>
                            <p className="text-gray-400 font-bold">لا توجد طلبات جوائز معلقة حالياً</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-right">
                                <thead className="bg-gray-50 text-gray-600 font-bold text-sm">
                                    <tr>
                                        <th className="p-4">الموظف</th>
                                        <th className="p-4">الجائزة المطلوبة</th>
                                        <th className="p-4">التكلفة</th>
                                        <th className="p-4">التاريخ</th>
                                        <th className="p-4 text-center">الإجراء</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {pendingRequests.map((req: any) => (
                                        <tr key={req.id} className="hover:bg-gray-50/50">
                                            <td className="p-4 font-bold text-gray-800">{req.employees?.name}</td>
                                            <td className="p-4 text-indigo-600 font-bold">{req.rewards_catalog?.title}</td>
                                            <td className="p-4 text-sm font-mono">{req.cost} نقطة</td>
                                            <td className="p-4 text-xs text-gray-500">{new Date(req.created_at).toLocaleDateString('ar-EG')}</td>
                                            <td className="p-4 flex justify-center gap-2">
                                                <button 
                                                    onClick={() => handleRequestMutation.mutate({ id: req.id, status: 'approved', empId: req.employee_id, cost: req.cost })}
                                                    className="bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-200 transition-colors flex items-center gap-1"
                                                >
                                                    <CheckCircle className="w-3 h-3"/> موافقة
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        if(confirm('هل أنت متأكد من الرفض؟ سيتم استرجاع النقاط للموظف.')) {
                                                            handleRequestMutation.mutate({ id: req.id, status: 'rejected', empId: req.employee_id, cost: req.cost });
                                                        }
                                                    }}
                                                    className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-200 transition-colors flex items-center gap-1"
                                                >
                                                    <XCircle className="w-3 h-3"/> رفض
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Content: Add Question */}
            {activeTab === 'questions' && (
                <div className="bg-white p-6 rounded-[30px] border shadow-sm">
                    <h3 className="text-lg font-black text-gray-800 mb-6 flex items-center gap-2 border-b pb-4">
                        <PlusCircle className="w-5 h-5 text-blue-600"/> إضافة سؤال جديد للمسابقة
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <Input 
                                label="نص السؤال" 
                                value={newQuestion.question_text} 
                                onChange={v => setNewQuestion({...newQuestion, question_text: v})} 
                                placeholder="مثال: كم عدد..."
                            />
                            
                            <div className="grid grid-cols-2 gap-3">
                                {[0, 1, 2, 3].map((idx) => (
                                    <div key={idx}>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">الخيار {idx + 1}</label>
                                        <input 
                                            className="w-full p-3 rounded-xl border bg-gray-50 focus:border-blue-500 outline-none text-sm"
                                            value={newQuestion.options[idx]}
                                            onChange={(e) => {
                                                const newOptions = [...newQuestion.options];
                                                newOptions[idx] = e.target.value;
                                                setNewQuestion({...newQuestion, options: newOptions});
                                            }}
                                            placeholder={`خيار ${idx + 1}`}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <Input 
                                label="الإجابة الصحيحة (يجب أن تطابق أحد الخيارات)" 
                                value={newQuestion.correct_answer} 
                                onChange={v => setNewQuestion({...newQuestion, correct_answer: v})} 
                            />
                            
                            <div className="grid grid-cols-2 gap-4">
                                <Select 
                                    label="التخصص المستهدف" 
                                    options={['all', 'أسنان', 'تمريض', 'صيدلة', 'إداري']} 
                                    value={newQuestion.specialty} 
                                    onChange={v => setNewQuestion({...newQuestion, specialty: v})} 
                                />
                                <Input 
                                    type="number" 
                                    label="النقاط" 
                                    value={newQuestion.points} 
                                    onChange={v => setNewQuestion({...newQuestion, points: Number(v)})} 
                                />
                            </div>

                            <button 
                                onClick={() => addQuestionMutation.mutate()}
                                disabled={addQuestionMutation.isPending}
                                className="w-full mt-6 bg-blue-600 text-white py-3 rounded-xl font-black hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
                            >
                                {addQuestionMutation.isPending ? <Loader2 className="animate-spin w-5 h-5"/> : <Save className="w-5 h-5"/>}
                                حفظ السؤال
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
