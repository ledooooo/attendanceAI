import React, { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    Gift, Clock, Award, Coffee, ShoppingBag, 
    Loader2, Tag, Image as ImageIcon, CheckCircle, XCircle, AlertCircle, History
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function RewardsStore({ employee }: { employee: Employee }) {
    const queryClient = useQueryClient();
    const [filter, setFilter] = useState<'all' | 'my'>('all');

    // 1. جلب الجوائز
    const { data: rewards = [], isLoading } = useQuery({
        queryKey: ['rewards_catalog'],
        queryFn: async () => {
            const { data } = await supabase
                .from('rewards_catalog')
                .select('*')
                .eq('is_active', true)
                .order('cost', { ascending: true });
            return data || [];
        }
    });

    // 2. جلب طلباتي السابقة (بالطريقة اليدوية المضمونة لتخطي أخطاء العلاقات ✅)
    const { data: myRedemptions = [] } = useQuery({
        queryKey: ['my_redemptions', employee.employee_id],
        queryFn: async () => {
            // أ) جلب الطلبات الخاصة بالموظف فقط
            const { data: requests, error } = await supabase.from('rewards_redemptions')
                .select('*')
                .eq('employee_id', employee.employee_id)
                .order('created_at', { ascending: false });
            
            if (error) {
                console.error("خطأ في جلب طلباتي:", error);
                return [];
            }
            if (!requests || requests.length === 0) return [];

            // ب) جلب أسماء الجوائز يدوياً
            const rewardIds = [...new Set(requests.map(r => r.reward_id))].filter(Boolean);
            const { data: rews } = await supabase.from('rewards_catalog').select('id, title').in('id', rewardIds);

            // ج) دمج البيانات
            return requests.map(req => ({
                ...req,
                reward_title: rews?.find(r => r.id === req.reward_id)?.title || 'جائزة'
            }));
        }
    });

    // --- دالة مساعدة لحساب السعر الفعلي ومعرفة وجود خصم ---
    const getRewardPricing = (reward: any) => {
        const hasDiscount = reward.discount_points && reward.discount_end_date && new Date(reward.discount_end_date) >= new Date();
        const actualCost = hasDiscount ? reward.discount_points : reward.cost;
        return { hasDiscount, actualCost };
    };

    // 3. عملية الشراء
    const buyMutation = useMutation({
        mutationFn: async (reward: any) => {
            const { actualCost } = getRewardPricing(reward);

            // أ) التحقق من الرصيد والكمية
            if ((employee.total_points || 0) < actualCost) throw new Error("رصيدك غير كافٍ!");
            if (reward.stock <= 0) throw new Error("عذراً، نفذت كمية هذه الجائزة!");

            // ب) خصم النقاط
            const { error: deductErr } = await supabase.rpc('increment_points', { 
                emp_id: employee.employee_id, 
                amount: -actualCost 
            });
            if (deductErr) throw deductErr;

            // ج) تسجيل عملية الشراء
            const { error: logErr } = await supabase.from('rewards_redemptions').insert({
                employee_id: employee.employee_id,
                reward_id: reward.id,
                cost: actualCost,
                status: 'pending'
            });
            if (logErr) throw logErr;

            // د) تسجيل في سجل النقاط
            await supabase.from('points_ledger').insert({
                employee_id: employee.employee_id,
                points: -actualCost,
                reason: `طلب جائزة: ${reward.title}`
            });

            // هـ) خصم 1 من الكمية المتاحة في المتجر
            await supabase.from('rewards_catalog').update({ stock: reward.stock - 1 }).eq('id', reward.id);
        },
        onSuccess: () => {
            toast.success('تم طلب الجائزة بنجاح! 🎉');
            queryClient.invalidateQueries({ queryKey: ['admin_employees'] }); 
            queryClient.invalidateQueries({ queryKey: ['my_redemptions'] });
            queryClient.invalidateQueries({ queryKey: ['rewards_catalog'] });
        },
        onError: (err: any) => toast.error(err.message)
    });

    return (
        <div className="space-y-6 animate-in fade-in pb-10">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-[2rem] p-6 text-white shadow-lg flex justify-between items-center relative overflow-hidden">
                <div className="relative z-10">
                    <h2 className="text-xl md:text-2xl font-black flex items-center gap-2"><ShoppingBag className="w-6 h-6"/> متجر النقاط</h2>
                    <p className="text-purple-100 text-xs md:text-sm mt-1">استبدل نقاطك بمكافآت حصرية</p>
                </div>
                <div className="relative z-10 bg-white/20 backdrop-blur-md px-4 py-2 rounded-xl text-center shadow-inner">
                    <span className="block text-[10px] md:text-xs text-purple-100 font-bold">رصيدك الحالي</span>
                    <span className="block text-2xl md:text-3xl font-black text-yellow-300 drop-shadow-md">{employee.total_points || 0}</span>
                </div>
                <Gift className="absolute -left-4 -bottom-4 w-32 h-32 text-white opacity-10 rotate-12" />
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-100 pb-2">
                <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-xl font-bold text-xs md:text-sm transition-all ${filter === 'all' ? 'bg-purple-100 text-purple-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>الجوائز المتاحة</button>
                <button onClick={() => setFilter('my')} className={`px-4 py-2 rounded-xl font-bold text-xs md:text-sm transition-all ${filter === 'my' ? 'bg-purple-100 text-purple-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>طلباتي السابقة</button>
            </div>

            {/* Content */}
            {filter === 'all' ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                    {isLoading ? <div className="col-span-full text-center py-10"><Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-600"/></div> : 
                     rewards.map((reward: any) => {
                        const { hasDiscount, actualCost } = getRewardPricing(reward);
                        const isOutOfStock = reward.stock <= 0;
                        const canAfford = (employee.total_points || 0) >= actualCost;

                        return (
                            <div key={reward.id} className={`bg-white border rounded-2xl shadow-sm flex flex-col relative overflow-hidden transition-all hover:shadow-md ${isOutOfStock ? 'opacity-70 grayscale-[50%]' : ''}`}>
                                
                                {/* صورة الجائزة */}
                                <div className="w-full h-24 md:h-32 bg-gray-50 flex items-center justify-center border-b relative">
                                    {reward.image_url ? (
                                        <img src={reward.image_url} alt={reward.title} className="w-full h-full object-cover" />
                                    ) : (
                                        <Gift className="w-8 h-8 text-gray-300" />
                                    )}
                                    
                                    {/* شريط الخصم */}
                                    {hasDiscount && !isOutOfStock && (
                                        <div className="absolute top-0 right-0 bg-red-500 text-white text-[9px] md:text-[10px] font-black px-2 py-1 rounded-bl-lg shadow-sm flex items-center gap-1">
                                            <Tag className="w-3 h-3"/> عرض!
                                        </div>
                                    )}

                                    {/* شريط نفاذ الكمية */}
                                    {isOutOfStock && (
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[1px]">
                                            <span className="bg-red-600 text-white text-xs font-black px-3 py-1 rounded-lg transform -rotate-12 border-2 border-white">نفذت الكمية</span>
                                        </div>
                                    )}
                                </div>
                                
                                {/* بيانات الجائزة */}
                                <div className="p-3 flex-1 flex flex-col justify-between">
                                    <div>
                                        <h3 className="font-bold text-gray-800 text-xs md:text-sm line-clamp-2 leading-tight mb-1">{reward.title}</h3>
                                        <p className="text-[9px] text-gray-400 font-bold mb-2">الكمية: <span className={isOutOfStock ? 'text-red-500' : 'text-gray-700'}>{reward.stock}</span></p>
                                    </div>
                                    
                                    <div className="mt-auto">
                                        <div className="flex items-center gap-2 mb-2">
                                            {hasDiscount ? (
                                                <div className="flex flex-col">
                                                    <span className="text-xs md:text-sm font-black text-red-600">{actualCost} نقطة</span>
                                                    <span className="line-through text-gray-400 text-[9px]">{reward.cost}</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs md:text-sm font-black text-indigo-600">{actualCost} نقطة</span>
                                            )}
                                        </div>
                                        
                                        <button 
                                            onClick={() => {
                                                if(confirm(`تأكيد شراء "${reward.title}" مقابل ${actualCost} نقطة؟`)) {
                                                    buyMutation.mutate(reward);
                                                }
                                            }}
                                            disabled={!canAfford || isOutOfStock || buyMutation.isPending}
                                            className={`w-full py-2 rounded-xl font-bold text-[10px] md:text-xs flex items-center justify-center gap-1 transition-all
                                                ${canAfford && !isOutOfStock 
                                                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md active:scale-95' 
                                                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                }`}
                                        >
                                            {buyMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin"/> : 
                                             isOutOfStock ? 'نفذت الكمية' :
                                             canAfford ? 'شراء' : 'نقاط غير كافية'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                     })}
                </div>
            ) : (
                <div className="space-y-3">
                    {myRedemptions.length === 0 ? (
                        <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-gray-200">
                            <History className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                            <p className="text-gray-400 font-bold text-sm">لم تقم بأي عمليات شراء بعد</p>
                        </div>
                    ) : (
                     myRedemptions.map((item: any) => (
                        <div key={item.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center transition-all hover:shadow-md">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-full ${
                                    item.status === 'approved' ? 'bg-green-50 text-green-500' : 
                                    item.status === 'rejected' ? 'bg-red-50 text-red-500' : 
                                    'bg-orange-50 text-orange-500'
                                }`}>
                                    {item.status === 'approved' ? <CheckCircle className="w-5 h-5"/> : 
                                     item.status === 'rejected' ? <XCircle className="w-5 h-5"/> : 
                                     <Clock className="w-5 h-5"/>}
                                </div>
                                <div>
                                    {/* ✅ تم تحديث متغير عرض الاسم ليكون reward_title */}
                                    <h4 className="font-bold text-gray-800 text-sm">{item.reward_title}</h4>
                                    <p className="text-[10px] text-gray-400 mt-0.5">{new Date(item.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                                </div>
                            </div>
                            <div className="text-left flex flex-col items-end gap-1">
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                    item.status === 'approved' ? 'bg-green-100 text-green-700' : 
                                    item.status === 'rejected' ? 'bg-red-100 text-red-700' : 
                                    'bg-orange-100 text-orange-700'
                                }`}>
                                    {item.status === 'approved' ? 'تم التسليم' : item.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}
                                </span>
                                <p className="text-xs font-black text-gray-900 bg-gray-50 px-2 py-1 rounded-lg border">-{item.cost} نقطة</p>
                            </div>
                        </div>
                    )))}
                </div>
            )}
        </div>
    );
}
