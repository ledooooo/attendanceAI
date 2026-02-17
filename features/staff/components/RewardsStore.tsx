import React, { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    Gift, Clock, Award, Coffee, ShoppingBag, 
    Loader2, Tag, Image as ImageIcon, CheckCircle, XCircle, AlertCircle, History, Ticket, Percent
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function RewardsStore({ employee }: { employee: Employee }) {
    const queryClient = useQueryClient();
    const [filter, setFilter] = useState<'all' | 'my' | 'promo'>('all');

    // --- حالة نافذة الشراء والكوبون ---
    const [buyModal, setBuyModal] = useState<{
        isOpen: boolean;
        reward: any | null;
        promoInput: string;
        appliedPromo: any | null;
    }>({ isOpen: false, reward: null, promoInput: '', appliedPromo: null });

    // 1. جلب الجوائز المتاحة
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

    // 2. جلب الكوبونات الفعالة
    const { data: promoCodes = [], isLoading: isLoadingPromo } = useQuery({
        queryKey: ['active_promo_codes'],
        queryFn: async () => {
            const today = new Date().toISOString().split('T')[0];
            const { data } = await supabase
                .from('promo_codes')
                .select('*')
                .eq('is_active', true)
                .gte('valid_until', today)
                .order('discount_value', { ascending: false });
            return data || [];
        }
    });

    // 3. جلب طلباتي السابقة
    const { data: myRedemptions = [], isLoading: loadingRedemptions } = useQuery({
        queryKey: ['my_redemptions', employee.employee_id, employee.id],
        queryFn: async () => {
            const { data: requests, error } = await supabase.from('rewards_redemptions')
                .select('*')
                .or(`employee_id.eq.${employee.employee_id},employee_id.eq.${employee.id}`)
                .order('created_at', { ascending: false });
            
            if (error) {
                console.error("خطأ في جلب طلباتي:", error);
                return [];
            }
            if (!requests || requests.length === 0) return [];

            const rewardIds = [...new Set(requests.map(r => r.reward_id))].filter(Boolean);
            const { data: rews } = await supabase.from('rewards_catalog').select('id, title').in('id', rewardIds);

            return requests.map(req => ({
                ...req,
                reward_title: rews?.find(r => r.id === req.reward_id)?.title || 'جائزة'
            }));
        }
    });

    // --- دالة مساعدة لحساب السعر الفعلي ومعرفة وجود خصم ---
    const getRewardPricing = (reward: any) => {
        if (!reward) return { hasDiscount: false, actualCost: 0 };
        const hasDiscount = reward.discount_points && reward.discount_end_date && new Date(reward.discount_end_date) >= new Date();
        const actualCost = hasDiscount ? reward.discount_points : reward.cost;
        return { hasDiscount, actualCost };
    };

    // --- تفعيل الكوبون داخل النافذة ---
    const handleApplyPromo = () => {
        if (!buyModal.promoInput.trim()) return;
        
        const promo = promoCodes.find(p => p.code.toLowerCase() === buyModal.promoInput.trim().toLowerCase());
        
        if (promo) {
            setBuyModal(prev => ({ ...prev, appliedPromo: promo }));
            toast.success(`تم تفعيل الخصم: ${promo.discount_value} نقطة! 🎉`);
        } else {
            setBuyModal(prev => ({ ...prev, appliedPromo: null }));
            toast.error('كوبون غير صحيح أو منتهي الصلاحية');
        }
    };

    // 4. عملية الشراء النهائية
    const buyMutation = useMutation({
        mutationFn: async ({ reward, finalCost, appliedPromoCode }: { reward: any, finalCost: number, appliedPromoCode: string | null }) => {
            
            if ((employee.total_points || 0) < finalCost) throw new Error("رصيدك غير كافٍ!");
            if (reward.stock <= 0) throw new Error("عذراً، نفذت كمية هذه الجائزة!");

            // أ) خصم النقاط (إذا كان السعر النهائي أكبر من 0)
            if (finalCost > 0) {
                const { error: deductErr } = await supabase.rpc('increment_points', { 
                    emp_id: employee.employee_id, 
                    amount: -finalCost 
                });
                if (deductErr) throw deductErr;
            }

            // ب) تسجيل عملية الشراء
            const { error: logErr } = await supabase.from('rewards_redemptions').insert({
                employee_id: employee.employee_id,
                reward_id: reward.id,
                cost: finalCost, // نسجل السعر النهائي بعد الكوبون
                status: 'pending'
            });
            if (logErr) throw logErr;

            // ج) تسجيل في سجل النقاط
            let ledgerReason = `طلب جائزة: ${reward.title}`;
            if (appliedPromoCode) ledgerReason += ` (تم استخدام كوبون: ${appliedPromoCode})`;
            
            if (finalCost > 0) {
                await supabase.from('points_ledger').insert({
                    employee_id: employee.employee_id,
                    points: -finalCost,
                    reason: ledgerReason
                });
            }

            // د) خصم 1 من الكمية المتاحة في المتجر
            await supabase.from('rewards_catalog').update({ stock: reward.stock - 1 }).eq('id', reward.id);
        },
        onSuccess: () => {
            toast.success('تم طلب الجائزة بنجاح! 🎉');
            queryClient.invalidateQueries({ queryKey: ['admin_employees'] }); 
            queryClient.invalidateQueries({ queryKey: ['my_redemptions'] });
            queryClient.invalidateQueries({ queryKey: ['rewards_catalog'] });
            setBuyModal({ isOpen: false, reward: null, promoInput: '', appliedPromo: null });
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
            <div className="flex gap-2 border-b border-gray-100 pb-2 overflow-x-auto no-scrollbar">
                <button onClick={() => setFilter('all')} className={`whitespace-nowrap px-4 py-2 rounded-xl font-bold text-xs md:text-sm transition-all ${filter === 'all' ? 'bg-purple-100 text-purple-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>الجوائز المتاحة</button>
                <button onClick={() => setFilter('my')} className={`whitespace-nowrap px-4 py-2 rounded-xl font-bold text-xs md:text-sm transition-all ${filter === 'my' ? 'bg-purple-100 text-purple-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>طلباتي السابقة</button>
                <button onClick={() => setFilter('promo')} className={`whitespace-nowrap px-4 py-2 rounded-xl font-bold text-xs md:text-sm transition-all ${filter === 'promo' ? 'bg-purple-100 text-purple-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>
                    <span className="flex items-center gap-1"><Ticket className="w-4 h-4"/> كوبونات الخصم</span>
                </button>
            </div>

            {/* Content */}
            {filter === 'all' ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                    {isLoading ? <div className="col-span-full text-center py-10"><Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-600"/></div> : 
                     rewards.length === 0 ? <div className="col-span-full text-center py-10 text-gray-400">لا توجد جوائز متاحة حالياً</div> :
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
                                    
                                    {/* شريط الخصم الأساسي */}
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
                                        <p className="text-[9px] text-gray-400 font-bold mb-2">الكمية المتاحة: <span className={isOutOfStock ? 'text-red-500' : 'text-gray-700'}>{reward.stock}</span></p>
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
                                            onClick={() => setBuyModal({ isOpen: true, reward, promoInput: '', appliedPromo: null })}
                                            disabled={!canAfford || isOutOfStock}
                                            className={`w-full py-2 rounded-xl font-bold text-[10px] md:text-xs flex items-center justify-center gap-1 transition-all
                                                ${canAfford && !isOutOfStock 
                                                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md active:scale-95' 
                                                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                }`}
                                        >
                                             {isOutOfStock ? 'نفذت الكمية' : canAfford ? 'شراء الآن' : 'نقاط غير كافية'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                     })}
                </div>
            ) : filter === 'my' ? (
                <div className="space-y-3">
                    {loadingRedemptions ? <div className="text-center py-10"><Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-600"/></div> : 
                     myRedemptions.length === 0 ? (
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
                                    <h4 className="font-bold text-gray-800 text-sm">{item.reward_title}</h4>
                                    <p className="text-[10px] text-gray-400 mt-0.5">{new Date(item.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
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
            ) : (
                /* --- التبويب للكوبونات --- */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {isLoadingPromo ? <div className="col-span-full text-center py-10"><Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-600"/></div> : 
                     promoCodes.length === 0 ? (
                        <div className="col-span-full text-center py-16 bg-white rounded-3xl border border-dashed border-gray-200">
                            <Ticket className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                            <p className="text-gray-400 font-bold text-sm">لا توجد كوبونات خصم متاحة حالياً</p>
                        </div>
                    ) : (
                     promoCodes.map((promo: any) => (
                        <div key={promo.id} className="bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-100 p-5 rounded-3xl flex justify-between items-center shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                            <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full border border-teal-100"></div>
                            <div className="absolute -right-6 top-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full border border-teal-100"></div>
                            
                            <div className="z-10 text-right pr-4">
                                <h4 className="font-black text-teal-800 text-lg mb-1">{promo.code}</h4>
                                <p className="text-xs text-teal-600 font-bold">صالح حتى: {new Date(promo.valid_until).toLocaleDateString('ar-EG')}</p>
                            </div>
                            <div className="z-10 text-center pl-4 border-r border-teal-200/50">
                                <span className="block text-2xl font-black text-emerald-600">{promo.discount_value}</span>
                                <span className="block text-[10px] font-bold text-teal-500">نقطة خصم</span>
                            </div>
                        </div>
                    )))}
                </div>
            )}

            {/* ✅ Modal الشراء والكوبونات */}
            {buyModal.isOpen && buyModal.reward && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
                        
                        {/* صورة الجائزة في رأس النافذة */}
                        <div className="h-32 bg-gray-50 flex items-center justify-center relative border-b">
                             {buyModal.reward.image_url ? (
                                <img src={buyModal.reward.image_url} alt={buyModal.reward.title} className="w-full h-full object-cover opacity-60" />
                             ) : (
                                <Gift className="w-12 h-12 text-gray-300" />
                             )}
                             <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                             <h3 className="absolute bottom-4 right-4 left-4 text-white font-black text-lg line-clamp-1 drop-shadow-md">{buyModal.reward.title}</h3>
                        </div>

                        <div className="p-6">
                            {/* إدخال الكوبون */}
                            <div className="mb-6">
                                <label className="text-xs font-bold text-gray-500 mb-2 block">هل لديك كود خصم؟</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text"
                                        placeholder="أدخل الكوبون هنا..."
                                        value={buyModal.promoInput}
                                        onChange={e => setBuyModal(prev => ({...prev, promoInput: e.target.value.toUpperCase()}))}
                                        className="flex-1 border-2 border-gray-100 bg-gray-50 rounded-xl px-4 py-2 font-black text-center uppercase outline-none focus:border-purple-300 transition-colors"
                                    />
                                    <button 
                                        onClick={handleApplyPromo}
                                        className="bg-purple-100 text-purple-700 px-4 py-2 rounded-xl font-bold hover:bg-purple-200 transition-colors"
                                    >
                                        تطبيق
                                    </button>
                                </div>
                            </div>

                            {/* حساب السعر */}
                            <div className="bg-gray-50 rounded-2xl p-4 space-y-2 border border-gray-100 text-sm font-bold">
                                <div className="flex justify-between text-gray-600">
                                    <span>سعر الجائزة:</span>
                                    <span>{getRewardPricing(buyModal.reward).actualCost} نقطة</span>
                                </div>
                                
                                {buyModal.appliedPromo && (
                                    <div className="flex justify-between text-emerald-600 animate-in slide-in-from-top-2">
                                        <span className="flex items-center gap-1"><Percent className="w-3 h-3"/> خصم الكوبون:</span>
                                        <span dir="ltr">-{buyModal.appliedPromo.discount_value} نقطة</span>
                                    </div>
                                )}
                                
                                <div className="border-t border-gray-200 pt-2 flex justify-between text-lg font-black text-indigo-700 mt-2">
                                    <span>الإجمالي المطلوب:</span>
                                    <span>{Math.max(0, getRewardPricing(buyModal.reward).actualCost - (buyModal.appliedPromo?.discount_value || 0))} نقطة</span>
                                </div>
                            </div>

                            {/* التنبيه بالرصيد */}
                            {(employee.total_points || 0) < Math.max(0, getRewardPricing(buyModal.reward).actualCost - (buyModal.appliedPromo?.discount_value || 0)) && (
                                <div className="flex items-center gap-1.5 text-xs font-bold text-red-500 bg-red-50 p-2 rounded-lg mt-4 justify-center">
                                    <AlertCircle className="w-4 h-4"/> نقاطك الحالية لا تكفي لإتمام الطلب
                                </div>
                            )}

                            {/* أزرار الإجراءات */}
                            <div className="grid grid-cols-2 gap-3 mt-6">
                                <button 
                                    onClick={() => setBuyModal({ isOpen: false, reward: null, promoInput: '', appliedPromo: null })}
                                    className="py-3 rounded-xl font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                                >
                                    إلغاء
                                </button>
                                <button 
                                    onClick={() => {
                                        const finalCost = Math.max(0, getRewardPricing(buyModal.reward).actualCost - (buyModal.appliedPromo?.discount_value || 0));
                                        buyMutation.mutate({ 
                                            reward: buyModal.reward, 
                                            finalCost, 
                                            appliedPromoCode: buyModal.appliedPromo?.code || null 
                                        });
                                    }}
                                    disabled={
                                        buyMutation.isPending || 
                                        (employee.total_points || 0) < Math.max(0, getRewardPricing(buyModal.reward).actualCost - (buyModal.appliedPromo?.discount_value || 0))
                                    }
                                    className="py-3 rounded-xl font-black text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-200 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {buyMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin"/> : 'تأكيد الشراء'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
