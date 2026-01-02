import React, { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { OVRReport } from '../../../types';
import { AlertTriangle, CheckCircle2, Clock, MessageSquare, Send, User, EyeOff } from 'lucide-react';

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
            // ✅ استخدام maybeSingle لتجنب خطأ 406
            const { data: emp, error } = await supabase
                .from('employees')
                .select('role')
                .eq('id', user.id)
                .maybeSingle();
            
            if (error) console.error("Error fetching role:", error.message);

            const role = emp?.role || 'user';
            setUserRole(role);
            fetchReports(role);
        }
    };

    const fetchReports = async (role: string) => {
        let query = supabase.from('ovr_reports').select('*').order('created_at', { ascending: false });

        // إذا كان مديراً، يرى فقط ما تم الرد عليه (حسب طلبك)
        // ملاحظة: RLS في القاعدة يضمن ذلك أيضاً، لكن الفلترة هنا للواجهة
        if (role === 'admin') {
            query = query.neq('status', 'new');
        }

        const { data } = await query;
        if (data) setReports(data as any);
    };

    const handleSubmitResponse = async () => {
        if (!selectedReport || !response) return;
        setLoading(true);

        const { error } = await supabase
            .from('ovr_reports')
            .update({
                quality_response: response,
                status: 'closed' 
            })
            .eq('id', selectedReport.id);

        if (!error) {
            // إشعار للموظف
            await supabase.from('notifications').insert({
                user_id: selectedReport.reporter_id, // هنا نستخدم الكود الوظيفي للإشعار حتى لو كان مجهولاً
                title: 'تم الرد على تقرير OVR',
                message: 'قام قسم الجودة بالرد على التقرير الذي أرسلته. يرجى المراجعة.',
                is_read: false
            });

            alert('تم اعتماد الرد بنجاح ✅');
            setResponse('');
            setSelectedReport(null);
            fetchReports(userRole);
        } else {
            alert('حدث خطأ: ' + error.message);
        }
        setLoading(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <AlertTriangle className="w-8 h-8 text-red-600"/> 
                <div>
                    <h2 className="text-2xl font-black text-gray-800">إدارة الجودة (OVR)</h2>
                    <p className="text-xs text-gray-500 font-bold">
                        {userRole === 'admin' ? 'عرض أرشيف الحوادث التي تم التعامل معها' : 'مراجعة والرد على الحوادث الجديدة'}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* قائمة التقارير */}
                <div className="space-y-3 h-[600px] overflow-y-auto custom-scrollbar pr-2">
                    {reports.length === 0 && <p className="text-gray-400 text-center py-10">لا توجد تقارير للعرض</p>}
                    {reports.map(rep => (
                        <div key={rep.id} onClick={() => setSelectedReport(rep)} 
                             className={`p-4 rounded-2xl border cursor-pointer transition-all relative ${selectedReport?.id === rep.id ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white hover:border-red-200'}`}>
                            
                            {rep.status === 'new' && <span className="absolute top-4 left-4 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
                            
                            <div className="flex justify-between items-start mb-2">
                                <span className="font-bold text-gray-800 flex items-center gap-2">
                                    {rep.is_anonymous ? (
                                        <><EyeOff className="w-4 h-4 text-gray-400"/> فاعل خير (مجهول)</>
                                    ) : (
                                        <><User className="w-4 h-4 text-blue-500"/> {rep.reporter_name}</>
                                    )}
                                </span>
                                <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${rep.status === 'new' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                    {rep.status === 'new' ? 'جديد' : 'مغلق'}
                                </span>
                            </div>
                            <p className="text-sm text-gray-600 line-clamp-2 mb-2">{rep.description}</p>
                            <div className="flex gap-4 text-[10px] text-gray-400 font-bold">
                                <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> {rep.incident_date}</span>
                                <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> {rep.location}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* تفاصيل التقرير والرد */}
                <div className="bg-white p-6 rounded-[30px] border shadow-sm h-fit sticky top-4">
                    {selectedReport ? (
                        <>
                            <div className="border-b pb-4 mb-4">
                                <h3 className="font-black text-lg text-gray-800 mb-2">تفاصيل الواقعة</h3>
                                <div className="flex gap-2 mb-4">
                                    <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-lg text-xs font-bold">{selectedReport.incident_date}</span>
                                    <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-lg text-xs font-bold">{selectedReport.incident_time}</span>
                                    <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-lg text-xs font-bold">{selectedReport.location}</span>
                                </div>
                                <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-xl border mb-4">
                                    {selectedReport.description}
                                </p>
                                {selectedReport.action_taken && (
                                    <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                                        <span className="text-xs font-bold text-blue-600 block mb-1">الإجراء الفوري المتخذ من الموظف:</span>
                                        <p className="text-sm text-blue-800">{selectedReport.action_taken}</p>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3">
                                <h4 className="font-bold text-gray-800 flex items-center gap-2">
                                    <MessageSquare className="w-5 h-5 text-emerald-600"/> رد / إجراء إدارة الجودة
                                </h4>
                                {selectedReport.status !== 'new' ? (
                                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 text-emerald-800 text-sm font-medium">
                                        {selectedReport.quality_response}
                                    </div>
                                ) : (
                                    <>
                                        {/* زر الرد يظهر فقط لمسؤول الجودة (أو الأدمن إذا أردت السماح له أيضاً) */}
                                        {userRole !== 'user' && (
                                            <>
                                                <textarea 
                                                    className="w-full p-4 rounded-xl border-2 border-gray-100 focus:border-emerald-500 outline-none text-sm h-32 resize-none transition-all"
                                                    placeholder="اكتب الإجراء التصحيحي أو الرد هنا ليظهر للموظف والمدير..."
                                                    value={response}
                                                    onChange={e => setResponse(e.target.value)}
                                                ></textarea>
                                                <button 
                                                    onClick={handleSubmitResponse}
                                                    disabled={loading || !response}
                                                    className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all flex justify-center items-center gap-2 shadow-lg shadow-emerald-200"
                                                >
                                                    <Send className="w-4 h-4 rtl:rotate-180"/> اعتماد الرد وإغلاق التقرير
                                                </button>
                                            </>
                                        )}
                                    </>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-20 text-gray-400">
                            <AlertTriangle className="w-16 h-16 mx-auto mb-4 opacity-20"/>
                            <p>اختر تقريراً من القائمة لعرض التفاصيل</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
