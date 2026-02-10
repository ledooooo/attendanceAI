import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useQuery } from '@tanstack/react-query';
import StaffTrainingCenter from '../features/staff/components/StaffTrainingCenter'; // تأكد من المسار
import { Loader2, AlertOctagon } from 'lucide-react';

export default function MandatoryTrainingGuard({ children, employeeId }: { children: React.ReactNode, employeeId: string }) {
    // البحث عن تدريب إجباري غير مكتمل
    const { data: blockingTraining, isLoading, refetch } = useQuery({
        queryKey: ['global_mandatory_check', employeeId],
        queryFn: async () => {
            // 1. كل التدريبات الإلزامية
            const { data: mandatory } = await supabase.from('trainings').select('*').eq('is_mandatory', true);
            if (!mandatory?.length) return null;

            // 2. التدريبات المكتملة للموظف
            const { data: completed } = await supabase.from('employee_trainings')
                .select('training_id')
                .eq('employee_id', employeeId)
                .eq('status', 'completed');
            
            const completedIds = completed?.map(c => c.training_id) || [];

            // 3. إرجاع أول تدريب غير مكتمل
            return mandatory.find(t => !completedIds.includes(t.id)) || null;
        },
        // تحديث كل دقيقة للتأكد
        refetchInterval: 60000 
    });

    if (isLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin w-10 h-10 text-indigo-600"/></div>;

    // 🛑 إذا وجد تدريب إجباري، اعرض شاشة التدريب فقط واحجب باقي التطبيق
    if (blockingTraining) {
        return (
            <div className="fixed inset-0 z-[9999] bg-gray-100 flex flex-col items-center justify-center p-4">
                <div className="bg-red-600 text-white px-6 py-3 rounded-full mb-4 flex items-center gap-2 shadow-lg animate-bounce">
                    <AlertOctagon className="w-6 h-6" />
                    <span className="font-bold">تنبيه: يجب إتمام هذا التدريب للدخول للنظام</span>
                </div>
                
                {/* نمرر التدريب مباشرة للمكون لفتحه فوراً */}
                <div className="w-full max-w-4xl h-[85vh] bg-white rounded-3xl shadow-2xl overflow-hidden border-4 border-red-500">
                    <StaffTrainingCenter 
                        employee={{ employee_id: employeeId } as any} 
                        forcedTraining={blockingTraining} // خاصية جديدة سنضيفها
                        onComplete={() => refetch()} // عند الانتهاء نعيد الفحص لفتح التطبيق
                    />
                </div>
            </div>
        );
    }

    // ✅ إذا لم يوجد تدريب، اعرض التطبيق عادي
    return <>{children}</>;
}
