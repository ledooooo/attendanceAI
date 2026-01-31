import React, { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Gift, Clock, Moon, Award, Coffee, ShoppingBag, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

// دالة لربط النص بالأيقونة
const getIcon = (name: string) => {
    switch (name) {
        case 'Clock': return <Clock className="w-6 h-6" />;
        case 'Moon': return <Moon className="w-6 h-6" />;
        case 'Award': return <Award className="w-6 h-6" />;
        case 'Coffee': return <Coffee className="w-6 h-6" />;
        default: return <Gift className="w-6 h-6" />;
    }
};

export default function RewardsStore({ employee }: { employee: Employee }) {
    const queryClient = useQueryClient();
    const [filter, setFilter] = useState('all');

    // 1. جلب الجوائز
    const { data: rewards = [], isLoading } = useQuery({
        queryKey: ['rewards_catalog'],
        queryFn: async () => {
            const { data } = await supabase.from('rewards_catalog').select('*').eq('is_active', true).order('cost', { ascending: true });
            return data || [];
        }
    });

    // 2. جلب مشترياتي السابقة
    const { data: myRedemptions = [] } = useQuery({
        queryKey: ['my_redemptions', employee.employee_id],
        queryFn: async () => {
            const { data } = await supabase.from('rewards_redemptions')
                .select('*, rewards_catalog(title)')
                .eq('employee_id', employee.employee_id)
                .order('created_at', { ascending: false });
            return data || [];
        }
    });

    // 3. عملية الشراء
    const buyMutation = useMutation({
        mutationFn: async (reward: any) => {
            // أ) التحقق من الرصيد
            if ((employee.total_points || 0) < reward.cost) throw new Error("رصيدك غير كافٍ!");

            // ب) خصم النقاط
            const { error: deductErr } = await supabase.rpc('increment_points', { 
                emp_id: employee.employee_id, 
                amount: -reward.cost // بالسالب للخصم
            });
            if (deductErr) throw deductErr;

            // ج) تسجيل عملية الشراء
            const { error: logErr } = await supabase.from('rewards_redemptions').insert({
                employee_id: employee.employee_id,
                reward_id: reward.id,
                cost: reward.cost,
                status: 'pending' // تنتظر موافقة الإدارة (أو approved تلقائي حسب رغبتك)
            });
            if (logErr) throw logErr;

            // د) تسجيل في سجل النقاط
            await supabase.from('points_ledger').insert({
                employee_id: employee.employee_id,
                points: -reward.cost,
                reason: `شراء جائزة: ${reward.title}`
            });
        },
        onSuccess: () => {
            toast.success('تم طلب الجائزة بنجاح! 🎉');
            queryClient.invalidateQueries({ queryKey: ['admin_employees'] }); // لتحديث رصيد الموظف
            queryClient.invalidateQueries({ queryKey: ['my_redemptions'] });
        },
        onError: (err: any) => toast.error(err.message)
    });

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-[2rem] p-6 text-white shadow-lg flex justify-between items-center relative overflow-hidden">
                <div className="relative z-10">
                    <h2 className="text-2xl font-black flex items-center gap-2"><ShoppingBag className="w-6 h-6"/> متجر النقاط</h2>
                    <p className="text-purple-100 text-sm mt-1">استبدل نقاطك بمكافآت حصرية</p>
                </div>
                <div className="relative z-10 bg-white/20 backdrop-blur-md px-4 py-2 rounded-xl text-center">
                    <span className="block text-xs text-purple-100 font-bold">رصيدك الحالي</span>
                    <span className="block text-2xl font-black text-yellow-300">{employee.total_points || 0}</span>
                </div>
                <Gift className="absolute -left-4 -bottom-4 w-32 h-32 text-white opacity-10 rotate-12" />
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b pb-2">
                <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${filter === 'all' ? 'bg-purple-100 text-purple-700' : 'text-gray-500 hover:bg-gray-50'}`}>الجوائز المتاحة</button>
                <button onClick={() => setFilter('my')} className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${filter === 'my' ? 'bg-purple-100 text-purple-700' : 'text-gray-500 hover:bg-gray-50'}`}>طلباتي السابقة</button>
            </div>

            {/* Content */}
            {filter === 'all' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {isLoading ? <div className="col-span-full text-center py-10"><Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-600"/></div> : 
                     rewards.map((reward: any) => (
                        <div key={reward.id} className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-purple-500 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>
                            
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
                                    {getIcon(reward.icon)}
                                </div>
                                <div className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-black">
                                    {reward.cost} نقطة
                                </div>
                            </div>
                            
                            <h3 className="font-bold text-gray-800 mb-1">{reward.title}</h3>
                            <p className="text-xs text-gray-500 mb-4 h-10 overflow-hidden">{reward.description}</p>
                            
                            <button 
                                onClick={() => {
                                    if(confirm(`هل أنت متأكد من شراء "${reward.title}" مقابل ${reward.cost} نقطة؟`)) {
                                        buyMutation.mutate(reward);
                                    }
                                }}
                                disabled={(employee.total_points || 0) < reward.cost || buyMutation.isPending}
                                className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed
                                    bg-gray-900 text-white hover:bg-purple-700 shadow-lg shadow-gray-200"
                            >
                                {(employee.total_points || 0) >= reward.cost ? 'شراء الآن' : 'رصيد غير كافٍ'}
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="space-y-3">
                    {myRedemptions.length === 0 ? <p className="text-center text-gray-400 py-10">لم تقم بأي عمليات شراء بعد</p> : 
                     myRedemptions.map((item: any) => (
                        <div key={item.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex justify-between items-center">
                            <div>
                                <h4 className="font-bold text-gray-800">{item.rewards_catalog?.title}</h4>
                                <p className="text-xs text-gray-400">{new Date(item.created_at).toLocaleDateString('ar-EG')}</p>
                            </div>
                            <div className="text-left">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                    item.status === 'approved' ? 'bg-green-100 text-green-700' : 
                                    item.status === 'rejected' ? 'bg-red-100 text-red-700' : 
                                    'bg-orange-100 text-orange-700'
                                }`}>
                                    {item.status === 'approved' ? 'تمت الموافقة' : item.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}
                                </span>
                                <p className="text-xs font-black text-gray-900 mt-1">-{item.cost} نقطة</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
