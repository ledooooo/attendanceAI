import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../supabaseClient';
import { 
    Gift, CheckCircle, XCircle, PlusCircle, HelpCircle, 
    Save, Loader2, Cake, Trophy, History, ShoppingBag, 
    Ticket, BellRing, Tag, Trash2, Image as ImageIcon
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Input, Select } from '../../../components/ui/FormElements';

export default function GamificationManager() {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'requests' | 'catalog' | 'promo' | 'questions'>('requests');

    // --- States ---
    const [newQuestion, setNewQuestion] = useState({
        question_text: '', options: ['', '', '', ''], correct_answer: '', specialty: 'all', points: 10
    });

    const [newReward, setNewReward] = useState({
        title: '', quantity: 10, points_cost: 100, discount_points: '', discount_end_date: '', image_url: '' // ✅ إضافة رابط الصورة
    });

    const [newPromo, setNewPromo] = useState({
        code: '', discount_value: 50, valid_until: ''
    });

    // 1. جلب طلبات الجوائز المعلقة (تم الإصلاح وتوسيع نطاق البحث)
    const { data: pendingRequests = [], isLoading: loadingRequests } = useQuery({
        queryKey: ['admin_pending_rewards'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('rewards_redemptions')
                // استخدام علاقات مرنة لتجنب الأخطاء
                .select(`
                    *,
                    employee:employees(name),
                    reward:rewards_catalog(title)
                `)
                // توسيع البحث ليشمل العربي والانجليزي
                .in('status', ['pending', 'قيد الانتظار', 'معلق', 'new'])
                .order('created_at', { ascending: false });
            
            if (error) {
                console.error("Fetch requests error:", error);
                toast.error(`خطأ في جلب الطلبات: ${error.message}`);
                return [];
            }
            return data || [];
        }
    });

    // 2. جلب الجوائز المتاحة (المتجر)
    const { data: rewardsCatalog = [] } = useQuery({
        queryKey: ['admin_rewards_catalog'],
        queryFn: async () => {
            const { data } = await supabase.from('rewards_catalog').select('*').order('created_at', { ascending: false });
            return data || [];
        }
    });

    // 3. جلب أكواد الخصم
    const { data: promoCodes = [] } = useQuery({
        queryKey: ['admin_promo_codes'],
        queryFn: async () => {
            const { data } = await supabase.from('promo_codes').select('*').order('created_at', { ascending: false });
            return data || [];
        }
    });

    // --- Mutations ---

    // أ. معالجة طلب الجائزة (موافقة/رفض + إشعارات)
    const handleRequestMutation = useMutation({
        mutationFn: async ({ id, status, empId, cost, rewardName }: { id: string, status: 'approved' | 'rejected', empId: string, cost: number, rewardName: string }) => {
            const { error } = await supabase.from('rewards_redemptions').update({ status }).eq('id', id);
            if (error) throw error;

            let notificationMsg = '';
            
            if (status === 'rejected') {
                // استرجاع النقاط
                await supabase.rpc('increment_points', { emp_id: empId, amount: cost });
                await supabase.from('points_ledger').insert({ employee_id: empId, points: cost, reason: `استرداد نقاط (رفض طلب ${rewardName})` });
                notificationMsg = `عذراً، تم رفض طلبك للحصول على "${rewardName}". تمت إعادة ${cost} نقطة لرصيدك.`;
            } else {
                notificationMsg = `تهانينا! 🎉 تم الموافقة على طلبك للحصول على "${rewardName}". يرجى التوجه للإدارة للاستلام.`;
            }

            // إرسال إشعار للموظف
            await supabase.from('notifications').insert({
                user_id: empId,
                title: status === 'approved' ? '✅ طلب جائزة مقبول' : '❌ طلب جائزة مرفوض',
                message: notificationMsg,
                type: 'reward_update',
                is_read: false
            });
        },
        onSuccess: (_, variables) => {
            toast.success(variables.status === 'approved' ? 'تمت الموافقة وتم إرسال تنبيه للموظف' : 'تم الرفض واسترجاع النقاط');
            queryClient.invalidateQueries({ queryKey: ['admin_pending_rewards'] });
        },
        onError: () => toast.error('حدث خطأ أثناء المعالجة')
    });

    // ب. إضافة جائزة جديدة (مع الصورة وفحص الخصم)
    const addRewardMutation = useMutation({
        mutationFn: async () => {
            if (!newReward.title || newReward.points_cost <= 0) throw new Error("أدخل البيانات الأساسية بشكل صحيح");
            
            const hasDiscount = newReward.discount_points && newReward.discount_end_date;
            
            const payload = {
                title: newReward.title,
                quantity: newReward.quantity,
                points_cost: newReward.points_cost,
                discount_points: hasDiscount ? Number(newReward.discount_points) : null,
                discount_end_date: hasDiscount ? newReward.discount_end_date : null,
                image_url: newReward.image_url || null, // ✅ إضافة رابط الصورة
                is_active: true
            };

            const { data, error } = await supabase.from('rewards_catalog').insert([payload]).select();
            if (error) throw error;

            if (hasDiscount) {
                await supabase.from('notifications').insert({
                    user_id: 'all',
                    title: '🔥 عرض خاص في متجر الجوائز!',
                    message: `احصل على "${newReward.title}" بـ ${newReward.discount_points} نقطة فقط بدلاً من ${newReward.points_cost}! العرض ساري حتى ${newReward.discount_end_date}`,
                    type: 'system',
                    is_read: false
                });
            }
        },
        onSuccess: () => {
            toast.success('تمت إضافة الجائزة للمتجر');
            setNewReward({ title: '', quantity: 10, points_cost: 100, discount_points: '', discount_end_date: '', image_url: '' });
            queryClient.invalidateQueries({ queryKey: ['admin_rewards_catalog'] });
        },
        onError: (err: any) => toast.error(err.message)
    });

    // ج. إضافة كود خصم
    const addPromoMutation = useMutation({
        mutationFn: async () => {
            if (!newPromo.code || newPromo.discount_value <= 0 || !newPromo.valid_until) throw new Error("أكمل بيانات كود الخصم");
            const { error } = await supabase.from('promo_codes').insert([newPromo]);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success('تم إنشاء كود الخصم بنجاح');
            setNewPromo({ code: '', discount_value: 50, valid_until: '' });
            queryClient.invalidateQueries({ queryKey: ['admin_promo_codes'] });
        },
        onError: (err: any) => toast.error('هذا الكود موجود مسبقاً أو حدث خطأ')
    });

    // د. إضافة سؤال جديد
    const addQuestionMutation = useMutation({
        mutationFn: async () => {
            if (!newQuestion.question_text || !newQuestion.correct_answer) throw new Error("أكمل البيانات");
            const payload = {
                question_text: newQuestion.question_text,
                options: JSON.stringify(newQuestion.options),
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
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                <button 
                    onClick={() => setActiveTab('requests')}
                    className={`px-5 py-3 rounded-xl font-bold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'requests' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-500 hover:bg-gray-50 border'}`}
                >
                    <Gift className="w-4 h-4"/> الطلبات 
                    {pendingRequests.length > 0 && <span className="bg-red-500 text-white text-[10px] px-2 rounded-full">{pendingRequests.length}</span>}
                </button>
                <button 
                    onClick={() => setActiveTab('catalog')}
                    className={`px-5 py-3 rounded-xl font-bold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'catalog' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-500 hover:bg-gray-50 border'}`}
                >
                    <ShoppingBag className="w-4 h-4"/> متجر الجوائز
                </button>
                <button 
                    onClick={() => setActiveTab('promo')}
                    className={`px-5 py-3 rounded-xl font-bold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'promo' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-500 hover:bg-gray-50 border'}`}
                >
                    <Ticket className="w-4 h-4"/> أكواد الخصم
                </button>
                <button 
                    onClick={() => setActiveTab('questions')}
                    className={`px-5 py-3 rounded-xl font-bold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'questions' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-500 hover:bg-gray-50 border'}`}
                >
                    <HelpCircle className="w-4 h-4"/> بنك الأسئلة
                </button>
            </div>

            {/* 1. Content: Requests */}
            {activeTab === 'requests' && (
                <div className="bg-white rounded-[30px] border shadow-sm overflow-hidden min-h-[400px]">
                    {loadingRequests ? (
                        <div className="flex justify-center items-center h-40 text-gray-400"><Loader2 className="w-8 h-8 animate-spin" /></div>
                    ) : pendingRequests.length === 0 ? (
                        <div className="text-center py-20">
                            <CheckCircle className="w-16 h-16 mx-auto text-green-200 mb-4"/>
                            <p className="text-gray-400 font-bold">لا توجد طلبات جوائز معلقة حالياً</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-right">
                                <thead className="bg-gray-50 text-gray-600 font-bold text-sm border-b">
                                    <tr>
                                        <th className="p-4">الموظف</th>
                                        <th className="p-4">الجائزة المطلوبة</th>
                                        <th className="p-4">التكلفة المخصومة</th>
                                        <th className="p-4">التاريخ</th>
                                        <th className="p-4 text-center">الإجراء</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {pendingRequests.map((req: any) => {
                                        // تحديث طريقة عرض الأسماء لتتوافق مع استعلام Supabase الجديد
                                        const empName = req.employee?.name || req.employees?.name || 'غير معروف';
                                        const rewardTitle = req.reward?.title || req.rewards_catalog?.title || 'جائزة';
                                        return (
                                            <tr key={req.id} className="hover:bg-gray-50/50">
                                                <td className="p-4 font-bold text-gray-800">{empName}</td>
                                                <td className="p-4 text-indigo-600 font-bold">{rewardTitle}</td>
                                                <td className="p-4 text-sm font-mono bg-red-50 text-red-600 font-bold w-32 text-center border-x">-{req.cost} نقطة</td>
                                                <td className="p-4 text-xs text-gray-500">{new Date(req.created_at).toLocaleDateString('ar-EG')}</td>
                                                <td className="p-4 flex justify-center gap-2">
                                                    <button 
                                                        onClick={() => handleRequestMutation.mutate({ id: req.id, status: 'approved', empId: req.employee_id, cost: req.cost, rewardName: rewardTitle })}
                                                        className="bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-200 transition-colors flex items-center gap-1"
                                                    >
                                                        <CheckCircle className="w-3 h-3"/> تسليم
                                                    </button>
                                                    <button 
                                                        onClick={() => {
                                                            if(confirm('هل أنت متأكد من الرفض؟ سيتم استرجاع النقاط للموظف.')) {
                                                                handleRequestMutation.mutate({ id: req.id, status: 'rejected', empId: req.employee_id, cost: req.cost, rewardName: rewardTitle });
                                                            }
                                                        }}
                                                        className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-200 transition-colors flex items-center gap-1"
                                                    >
                                                        <XCircle className="w-3 h-3"/> رفض واسترجاع
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* 2. Content: Rewards Catalog (متجر الجوائز) */}
            {activeTab === 'catalog' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* إضافة جائزة */}
                    <div className="bg-white p-6 rounded-[30px] border shadow-sm h-fit">
                        <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2 border-b pb-4">
                            <PlusCircle className="w-5 h-5 text-indigo-600"/> إضافة جائزة للمتجر
                        </h3>
                        <div className="space-y-4">
                            <Input label="اسم الجائزة *" value={newReward.title} onChange={v => setNewReward({...newReward, title: v})} placeholder="مثال: إذن انصراف مبكر" />
                            <div className="grid grid-cols-2 gap-3">
                                <Input type="number" label="الكمية المتاحة *" value={newReward.quantity} onChange={v => setNewReward({...newReward, quantity: Number(v)})} />
                                <Input type="number" label="النقاط المطلوبة *" value={newReward.points_cost} onChange={v => setNewReward({...newReward, points_cost: Number(v)})} />
                            </div>
                            
                            {/* ✅ حقل إدخال رابط الصورة */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1 flex items-center gap-1">
                                    <ImageIcon className="w-4 h-4"/> رابط الصورة (URL) اختياري
                                </label>
                                <input 
                                    type="text"
                                    className="w-full p-3 rounded-xl border bg-gray-50 focus:border-indigo-500 outline-none text-sm"
                                    value={newReward.image_url}
                                    onChange={(e) => setNewReward({...newReward, image_url: e.target.value})}
                                    placeholder="https://example.com/image.png"
                                    dir="ltr"
                                />
                            </div>
                            
                            <div className="p-3 bg-yellow-50 rounded-xl border border-yellow-200 space-y-3 mt-4">
                                <label className="text-xs font-bold text-yellow-800 flex items-center gap-1"><Tag className="w-4 h-4"/> إعدادات الخصم (اختياري)</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <Input type="number" label="السعر بعد الخصم" value={newReward.discount_points} onChange={v => setNewReward({...newReward, discount_points: v})} placeholder="مثال: 50" />
                                    <Input type="date" label="ينتهي الخصم في" value={newReward.discount_end_date} onChange={v => setNewReward({...newReward, discount_end_date: v})} />
                                </div>
                                <p className="text-[9px] text-yellow-600">💡 عند تحديد خصم سيتم إرسال إشعار لجميع الموظفين بوجود عرض!</p>
                            </div>

                            <button 
                                onClick={() => addRewardMutation.mutate()}
                                disabled={addRewardMutation.isPending}
                                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-black hover:bg-indigo-700 shadow-md flex justify-center items-center gap-2"
                            >
                                {addRewardMutation.isPending ? <Loader2 className="animate-spin w-5 h-5"/> : <Save className="w-5 h-5"/>} حفظ في المتجر
                            </button>
                        </div>
                    </div>

                    {/* قائمة الجوائز */}
                    <div className="lg:col-span-2 bg-white rounded-[30px] border shadow-sm p-6">
                        <h3 className="text-lg font-black text-gray-800 mb-4 border-b pb-4">الجوائز المتاحة حالياً</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {rewardsCatalog.map((item: any) => (
                                <div key={item.id} className="border rounded-2xl flex flex-col justify-between relative overflow-hidden group hover:border-indigo-200 transition-colors bg-white">
                                    {/* عرض الصورة إن وجدت */}
                                    <div className="w-full h-32 bg-gray-100 flex items-center justify-center border-b relative">
                                        {item.image_url ? (
                                            <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                                        ) : (
                                            <Gift className="w-10 h-10 text-gray-300" />
                                        )}
                                        {item.discount_points && new Date(item.discount_end_date) >= new Date() && (
                                            <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl shadow-sm z-10">
                                                عرض خاص!
                                            </div>
                                        )}
                                    </div>

                                    <div className="p-4 flex-1 flex flex-col justify-between">
                                        <div>
                                            <h4 className="font-bold text-gray-800 text-lg mb-1">{item.title}</h4>
                                            <p className="text-xs text-gray-500 mb-3">الكمية المتبقية: <span className="font-bold text-gray-800">{item.quantity}</span></p>
                                        </div>
                                        <div className="flex items-center justify-between mt-2 pt-3 border-t">
                                            <div className="flex items-center gap-2">
                                                {item.discount_points && new Date(item.discount_end_date) >= new Date() ? (
                                                    <>
                                                        <span className="text-sm font-black text-red-600">{item.discount_points} نقطة</span>
                                                        <span className="text-xs line-through text-gray-400">{item.points_cost}</span>
                                                    </>
                                                ) : (
                                                    <span className="text-sm font-black text-indigo-600">{item.points_cost} نقطة</span>
                                                )}
                                            </div>
                                            <button 
                                                onClick={async () => {
                                                    if(confirm('حذف هذه الجائزة من المتجر؟')) {
                                                        await supabase.from('rewards_catalog').delete().eq('id', item.id);
                                                        queryClient.invalidateQueries({ queryKey: ['admin_rewards_catalog'] });
                                                    }
                                                }}
                                                className="text-gray-400 hover:text-red-500 p-1 bg-gray-50 rounded-lg hover:bg-red-50"
                                                title="حذف الجائزة"
                                            >
                                                <Trash2 className="w-4 h-4"/>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* 3. Content: Promo Codes */}
            {activeTab === 'promo' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-[30px] border shadow-sm h-fit">
                        <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2 border-b pb-4">
                            <Ticket className="w-5 h-5 text-teal-600"/> إنشاء كود خصم
                        </h3>
                        <div className="space-y-4">
                            <Input label="كود الخصم (انجليزي/أرقام) *" value={newPromo.code} onChange={v => setNewPromo({...newPromo, code: v.toUpperCase()})} placeholder="مثال: WEEKEND50" />
                            <Input type="number" label="قيمة الخصم (بالنقاط) *" value={newPromo.discount_value} onChange={v => setNewPromo({...newPromo, discount_value: Number(v)})} />
                            <Input type="date" label="صالح حتى تاريخ *" value={newPromo.valid_until} onChange={v => setNewPromo({...newPromo, valid_until: v})} />
                            
                            <button 
                                onClick={() => addPromoMutation.mutate()}
                                disabled={addPromoMutation.isPending}
                                className="w-full bg-teal-600 text-white py-3 rounded-xl font-black hover:bg-teal-700 shadow-md flex justify-center items-center gap-2 mt-4"
                            >
                                {addPromoMutation.isPending ? <Loader2 className="animate-spin w-5 h-5"/> : <Save className="w-5 h-5"/>} تفعيل الكود
                            </button>
                        </div>
                    </div>

                    <div className="lg:col-span-2 bg-white rounded-[30px] border shadow-sm p-6">
                        <h3 className="text-lg font-black text-gray-800 mb-4 border-b pb-4">الأكواد الفعالة</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-right text-sm">
                                <thead className="bg-gray-50 text-gray-600 font-bold">
                                    <tr>
                                        <th className="p-3">الكود</th>
                                        <th className="p-3">يخصم</th>
                                        <th className="p-3">تاريخ الانتهاء</th>
                                        <th className="p-3 text-center">حذف</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {promoCodes.map((promo: any) => (
                                        <tr key={promo.id}>
                                            <td className="p-3 font-mono font-bold text-teal-700 bg-teal-50 rounded-r-lg border-y border-r border-teal-100">{promo.code}</td>
                                            <td className="p-3 font-bold">{promo.discount_value} نقطة</td>
                                            <td className="p-3 text-gray-500">{new Date(promo.valid_until).toLocaleDateString('ar-EG')}</td>
                                            <td className="p-3 text-center">
                                                <button 
                                                    onClick={async () => {
                                                        if(confirm('حذف هذا الكود؟')) {
                                                            await supabase.from('promo_codes').delete().eq('id', promo.id);
                                                            queryClient.invalidateQueries({ queryKey: ['admin_promo_codes'] });
                                                        }
                                                    }}
                                                    className="text-gray-400 hover:text-red-500"
                                                >
                                                    <Trash2 className="w-4 h-4 mx-auto"/>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* 4. Content: Add Question (بنك الأسئلة) */}
            {activeTab === 'questions' && (
                <div className="bg-white p-6 rounded-[30px] border shadow-sm">
                    <h3 className="text-lg font-black text-gray-800 mb-6 flex items-center gap-2 border-b pb-4">
                        <PlusCircle className="w-5 h-5 text-blue-600"/> إضافة سؤال جديد للمسابقة اليومية
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
