import React, { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { OVRReport } from '../../../types';
import toast from 'react-hot-toast';
import { AlertTriangle, Clock, MessageSquare, Send, User, EyeOff, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
// 1. ✅ Import React Query
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function QualityDashboard() {
    const queryClient = useQueryClient();
    
    // UI State
    const [selectedReport, setSelectedReport] = useState<OVRReport | null>(null);
    const [response, setResponse] = useState('');

    // ------------------------------------------------------------------
    // 1. 📥 Fetch User Role & Reports (Parallel Queries)
    // ------------------------------------------------------------------

    // A) Get Current User Role
    const { data: userRole = 'user' } = useQuery({
        queryKey: ['current_user_role_quality'],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return 'user';
            
            const { data: emp } = await supabase
                .from('employees')
                .select('role')
                .eq('id', user.id)
                .maybeSingle();
            
            return emp?.role || 'user';
        },
        staleTime: Infinity, // Role rarely changes during session
    });

    // B) Fetch OVR Reports
    const { data: reports = [], isLoading: loadingReports } = useQuery({
        queryKey: ['ovr_reports_list'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('ovr_reports')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            return data as OVRReport[];
        },
        // Auto refetch every 30 seconds to catch new incidents
        refetchInterval: 30000, 
    });

    // ------------------------------------------------------------------
    // 2. 🛠️ Submit Response & Notify (Complex Mutation)
    // ------------------------------------------------------------------
// ------------------------------------------------------------------
    // 2. 🛠️ Submit Response & Notify (Complex Mutation)
    // ------------------------------------------------------------------
    const responseMutation = useMutation({
        mutationFn: async () => {
            if (!selectedReport || !response) throw new Error("بيانات ناقصة");

            // 1. Update Report to Closed
            const { error: updateError } = await supabase
                .from('ovr_reports')
                .update({
                    quality_response: response,
                    status: 'closed' 
                })
                .eq('id', selectedReport.id);

            if (updateError) throw updateError;

            // 2. Notify Reporter (إذا لم يكن التقرير مجهولاً وكان هناك ID للمبلغ)
            if (selectedReport.reporter_id) {
                const reporterTitle = 'تم الرد على تقرير OVR';
                const reporterMsg = 'قام قسم الجودة بالرد على التقرير الذي أرسلته.';

                await supabase.from('notifications').insert({
                    user_id: String(selectedReport.reporter_id),
                    title: reporterTitle,
                    message: reporterMsg,
                    type: 'ovr_reply',
                    is_read: false
                });

                // ✅ إرسال إشعار لحظي للمبلغ
                supabase.functions.invoke('send-push-notification', {
                    body: {
                        userId: String(selectedReport.reporter_id),
                        title: reporterTitle,
                        body: reporterMsg,
                        url: '/staff?tab=ovr'
                    }
                }).catch(err => console.error("Push error reporter:", err));
            }

            // 3. Notify Admins
            const { data: admins } = await supabase
                .from('employees')
                .select('employee_id')
                .eq('role', 'admin');

            if (admins && admins.length > 0) {
                const adminTitle = '🔴 تقرير جودة تم إغلاقه';
                const adminMsg = `قام مسؤول الجودة بالرد على واقعة ${selectedReport.is_anonymous ? 'مجهولة' : selectedReport.reporter_name}.`;

                const adminNotifications = admins.map(admin => ({
                    user_id: String(admin.employee_id),
                    title: adminTitle,
                    message: adminMsg,
                    type: 'ovr_report',
                    is_read: false
                }));
                
                await supabase.from('notifications').insert(adminNotifications);

                // ✅ إرسال إشعار لحظي للمديرين بشكل متوازي
                Promise.all(
                    admins.map(admin =>
                        supabase.functions.invoke('send-push-notification', {
                            body: {
                                userId: String(admin.employee_id),
                                title: adminTitle,
                                body: adminMsg,
                                url: '/admin?tab=quality'
                            }
                        })
                    )
                ).catch(err => console.error("Push error admin:", err));
            }
        },
        onSuccess: () => {
            toast.success('تم اعتماد الرد وتنبيه الأطراف المعنية ✅');
            queryClient.invalidateQueries({ queryKey: ['ovr_reports_list'] });
            
            setResponse('');
            setSelectedReport(null);
        },
        onError: (err: any) => {
            toast.error('حدث خطأ: ' + err.message);
        }
    });
    
    // ------------------------------------------------------------------
    // 3. 🎨 UI Render
    // ------------------------------------------------------------------

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center gap-3">
                <div className="bg-red-100 p-2.5 rounded-full shadow-sm">
                    <AlertTriangle className="w-6 h-6 text-red-600"/> 
                </div>
                <div>
                    <h2 className="text-2xl font-black text-gray-800">إدارة الجودة (OVR)</h2>
                    <p className="text-xs text-gray-500 font-bold mt-1">
                        {userRole === 'admin' ? 'الأرشيف والمتابعة' : 'مراجعة الحوادث والرد عليها'}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative">
                
                {/* 1. Side List */}
                <div className={`space-y-3 h-[600px] overflow-y-auto custom-scrollbar pr-2 pb-20 ${selectedReport ? 'hidden lg:block' : 'block'}`}>
                    {loadingReports ? (
                        <div className="text-center py-10 flex flex-col items-center gap-2 text-gray-400">
                            <Loader2 className="w-8 h-8 animate-spin text-emerald-500"/> جاري تحميل التقارير...
                        </div>
                    ) : reports.length === 0 ? (
                        <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed">
                            <p className="text-gray-400 font-bold">لا توجد تقارير حالياً</p>
                        </div>
                    ) : (
                        reports.map(rep => (
                            <div key={rep.id} onClick={() => setSelectedReport(rep)} 
                                 className={`p-4 rounded-2xl border cursor-pointer transition-all relative group hover:shadow-md ${selectedReport?.id === rep.id ? 'border-red-500 bg-red-50 shadow-md' : 'border-gray-200 bg-white hover:border-red-200'}`}>
                                
                                <div className="flex justify-between items-start mb-2">
                                    <span className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                                        {rep.is_anonymous ? (
                                            <><EyeOff className="w-4 h-4 text-gray-400"/> مجهول</>
                                        ) : (
                                            <><User className="w-4 h-4 text-blue-500"/> {rep.reporter_name}</>
                                        )}
                                    </span>
                                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 ${rep.status === 'new' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                        {rep.status === 'new' ? 'جديد' : <><CheckCircle2 className="w-3 h-3"/> تم الرد</>}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-600 line-clamp-2 mb-3 leading-relaxed">{rep.description}</p>
                                <div className="flex gap-3 text-[10px] text-gray-400 font-bold border-t pt-2">
                                    <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> {rep.incident_date}</span>
                                    <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> {rep.location}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* 2. Detail View */}
                <div className={`bg-white p-6 rounded-[30px] border shadow-sm h-fit sticky top-4 animate-in slide-in-from-bottom-5 duration-300 ${selectedReport ? 'block' : 'hidden lg:block'}`}>
                    {selectedReport ? (
                        <>
                            <button 
                                onClick={() => setSelectedReport(null)} 
                                className="lg:hidden w-full py-3 mb-4 bg-gray-100 rounded-xl flex items-center justify-center gap-2 text-gray-600 font-bold hover:bg-gray-200"
                            >
                                <ArrowRight className="w-4 h-4"/> رجوع للقائمة
                            </button>

                            <div className="border-b pb-4 mb-4">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-black text-lg text-gray-800">تفاصيل الواقعة</h3>
                                    <span className="text-[10px] bg-gray-100 px-2 py-1 rounded text-gray-500 font-mono">#{selectedReport.id.slice(0,6)}</span>
                                </div>
                                
                                <div className="flex gap-2 mb-4 flex-wrap">
                                    <span className="bg-orange-50 text-orange-700 px-3 py-1 rounded-lg text-xs font-bold border border-orange-100">{selectedReport.incident_date}</span>
                                    <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-lg text-xs font-bold">{selectedReport.location}</span>
                                </div>
                                
                                <p className="text-sm text-gray-700 leading-loose bg-gray-50 p-4 rounded-xl border border-gray-200 mb-4">
                                    {selectedReport.description}
                                </p>
                                
                                {selectedReport.action_taken && (
                                    <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                                        <span className="text-xs font-bold text-blue-600 block mb-1">الإجراء الفوري من الموظف:</span>
                                        <p className="text-xs text-blue-800">{selectedReport.action_taken}</p>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3">
                                <h4 className="font-bold text-gray-800 flex items-center gap-2">
                                    <MessageSquare className="w-5 h-5 text-emerald-600"/> رد / إجراء إدارة الجودة
                                </h4>
                                
                                {selectedReport.status !== 'new' ? (
                                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 text-emerald-900 text-sm font-medium leading-relaxed relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-1 h-full bg-emerald-500"></div>
                                        {selectedReport.quality_response}
                                    </div>
                                ) : (
                                    <>
                                        {(userRole === 'quality_manager' || userRole === 'admin') ? (
                                            <div className="animate-in fade-in zoom-in-95">
                                                <textarea 
                                                    className="w-full p-4 rounded-xl border-2 border-gray-200 focus:border-emerald-500 outline-none text-sm h-32 resize-none transition-all focus:bg-emerald-50/10 mb-3"
                                                    placeholder="اكتب الإجراء التصحيحي هنا لاعتماده وإغلاق التقرير..."
                                                    value={response}
                                                    onChange={e => setResponse(e.target.value)}
                                                ></textarea>
                                                <button 
                                                    onClick={() => responseMutation.mutate()}
                                                    disabled={responseMutation.isPending || !response}
                                                    className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all flex justify-center items-center gap-2 shadow-lg shadow-emerald-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {responseMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin"/> جاري الحفظ...</> : <><Send className="w-4 h-4 rtl:rotate-180"/> اعتماد الرد وإغلاق التقرير</>}
                                                </button>
                                            </div>
                                        ) : (
                                            <p className="text-center text-xs text-gray-400 bg-gray-50 p-4 rounded-xl border border-dashed">
                                                بانتظار مراجعة واعتماد مسؤول الجودة...
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-32 text-gray-300 hidden lg:block">
                            <AlertTriangle className="w-20 h-20 mx-auto mb-4 opacity-10"/>
                            <p className="font-bold">اختر تقريراً لعرض التفاصيل</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
