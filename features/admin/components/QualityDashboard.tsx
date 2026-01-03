import React, { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { OVRReport } from '../../../types';
import { AlertTriangle, Clock, MessageSquare, Send, User, EyeOff, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function QualityDashboard() {
    const [reports, setReports] = useState<OVRReport[]>([]);
    const [selectedReport, setSelectedReport] = useState<OVRReport | null>(null);
    const [response, setResponse] = useState('');
    const [loading, setLoading] = useState(false);
    const [userRole, setUserRole] = useState<string>('');

    useEffect(() => {
        checkUserRoleAndFetch();
    }, []);

    const checkUserRoleAndFetch = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data: emp } = await supabase
                .from('employees')
                .select('role')
                .eq('id', user.id)
                .maybeSingle();
            
            const role = emp?.role || 'user';
            setUserRole(role);
            fetchReports(role);
        }
    };

    const fetchReports = async (role: string) => {
        // المدير ومسؤول الجودة يرون كل شيء (الجديد والمغلق)
        let query = supabase.from('ovr_reports').select('*').order('created_at', { ascending: false });
        const { data } = await query;
        if (data) setReports(data as any);
    };

    const handleSubmitResponse = async () => {
        if (!selectedReport || !response) return;
        setLoading(true);

        // 1. تحديث التقرير
        const { error } = await supabase
            .from('ovr_reports')
            .update({
                quality_response: response,
                status: 'closed' 
            })
            .eq('id', selectedReport.id);

        if (!error) {
            // 2. إشعار للموظف صاحب التقرير
            await supabase.from('notifications').insert({
                user_id: selectedReport.reporter_id,
                title: 'تم الرد على تقرير OVR',
                message: 'قام قسم الجودة بالرد على التقرير الذي أرسلته. يرجى المراجعة.',
                is_read: false
            });

            // 3. ✅ إشعار للمدير (Admin) بأن هناك تقرير تم إغلاقه
            // نجلب كل المديرين
            const { data: admins } = await supabase
                .from('employees')
                .select('employee_id')
                .eq('role', 'admin');

            if (admins && admins.length > 0) {
                const adminNotifications = admins.map(admin => ({
                    user_id: admin.employee_id,
                    title: 'تقرير جودة مكتمل',
                    message: `قام مسؤول الجودة بالرد وإغلاق التقرير الخاص بـ ${selectedReport.is_anonymous ? 'فاعل خير' : selectedReport.reporter_name}. يرجى الاطلاع.`,
                    is_read: false
                }));
                await supabase.from('notifications').insert(adminNotifications);
            }

            alert('تم اعتماد الرد وتنبيه المدير والموظف ✅');
            setResponse('');
            setSelectedReport(null);
            fetchReports(userRole);
        } else {
            alert('حدث خطأ: ' + error.message);
        }
        setLoading(false);
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="flex items-center gap-3">
                <div className="bg-red-100 p-2 rounded-full">
                    <AlertTriangle className="w-6 h-6 text-red-600"/> 
                </div>
                <div>
                    <h2 className="text-2xl font-black text-gray-800">إدارة الجودة (OVR)</h2>
                    <p className="text-xs text-gray-500 font-bold">
                        {userRole === 'admin' ? 'متابعة الحوادث والتقارير المكتملة' : 'مراجعة والرد على الحوادث الجديدة'}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative">
                
                {/* القائمة */}
                <div className={`space-y-3 h-[600px] overflow-y-auto custom-scrollbar pr-2 ${selectedReport ? 'hidden lg:block' : 'block'}`}>
                    {reports.length === 0 && (
                        <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed">
                            <p className="text-gray-400 font-bold">لا توجد تقارير للعرض</p>
                        </div>
                    )}
                    {reports.map(rep => (
                        <div key={rep.id} onClick={() => setSelectedReport(rep)} 
                             className={`p-4 rounded-2xl border cursor-pointer transition-all relative group hover:shadow-md ${selectedReport?.id === rep.id ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white hover:border-red-200'}`}>
                            
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
                    ))}
                </div>

                {/* التفاصيل والرد */}
                <div className={`bg-white p-6 rounded-[30px] border shadow-sm h-fit sticky top-4 ${selectedReport ? 'block' : 'hidden lg:block'}`}>
                    {selectedReport ? (
                        <>
                            <button onClick={() => setSelectedReport(null)} className="lg:hidden flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-4 text-sm font-bold">
                                <ArrowRight className="w-4 h-4"/> رجوع للقائمة
                            </button>

                            <div className="border-b pb-4 mb-4">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-black text-lg text-gray-800">تفاصيل الواقعة</h3>
                                    <span className="text-[10px] bg-gray-100 px-2 py-1 rounded text-gray-500 font-mono">#{selectedReport.id.slice(0,6)}</span>
                                </div>
                                <div className="flex gap-2 mb-4 flex-wrap">
                                    <span className="bg-orange-50 text-orange-700 px-3 py-1 rounded-lg text-xs font-bold border border-orange-100">{selectedReport.incident_date}</span>
                                    <span className="bg-orange-50 text-orange-700 px-3 py-1 rounded-lg text-xs font-bold border border-orange-100">{selectedReport.incident_time}</span>
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
                                            <>
                                                <textarea 
                                                    className="w-full p-4 rounded-xl border-2 border-gray-200 focus:border-emerald-500 outline-none text-sm h-32 resize-none transition-all focus:bg-emerald-50/10"
                                                    placeholder="اكتب الإجراء التصحيحي واعتمده..."
                                                    value={response}
                                                    onChange={e => setResponse(e.target.value)}
                                                ></textarea>
                                                <button 
                                                    onClick={handleSubmitResponse}
                                                    disabled={loading || !response}
                                                    className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all flex justify-center items-center gap-2 shadow-lg shadow-emerald-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {loading ? 'جاري الحفظ...' : <><Send className="w-4 h-4 rtl:rotate-180"/> اعتماد الرد وإغلاق التقرير</>}
                                                </button>
                                            </>
                                        ) : (
                                            <p className="text-center text-xs text-gray-400 bg-gray-50 p-2 rounded">بانتظار رد مسؤول الجودة...</p>
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
