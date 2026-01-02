import React, { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { OVRReport } from '../../../types';
import { AlertTriangle, CheckCircle2, Clock, MessageSquare, Send } from 'lucide-react';

export default function QualityDashboard() {
    const [reports, setReports] = useState<OVRReport[]>([]);
    const [selectedReport, setSelectedReport] = useState<OVRReport | null>(null);
    const [response, setResponse] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
        const { data } = await supabase
            .from('ovr_reports')
            .select('*')
            .order('created_at', { ascending: false });
        if (data) setReports(data as any);
    };

    const handleSubmitResponse = async () => {
        if (!selectedReport || !response) return;
        setLoading(true);

        // 1. تحديث التقرير برد الجودة وتغيير الحالة
        const { error } = await supabase
            .from('ovr_reports')
            .update({
                quality_response: response,
                status: 'closed' // أو 'reviewed'
            })
            .eq('id', selectedReport.id);

        if (!error) {
            // 2. إرسال نسخة للمدير (Admin) عبر الرسائل
            const adminMsg = `
نسخة من تقرير OVR رقم #${selectedReport.id.slice(0, 5)}
-----------------------
المبلغ: ${selectedReport.reporter_name}
الوصف: ${selectedReport.description}
-----------------------
رد الجودة:
${response}
            `.trim();

            await supabase.from('messages').insert({
                from_user: 'Quality Manager',
                to_user: 'admin',
                content: adminMsg,
                is_read: false
            });

            alert('تم حفظ الرد وإرسال نسخة للمدير بنجاح ✅');
            setResponse('');
            setSelectedReport(null);
            fetchReports();
        } else {
            alert('حدث خطأ: ' + error.message);
        }
        setLoading(false);
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                <AlertTriangle className="w-8 h-8 text-red-600"/> تقارير الحوادث (OVR)
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* قائمة التقارير */}
                <div className="space-y-4">
                    {reports.map(rep => (
                        <div key={rep.id} onClick={() => setSelectedReport(rep)} 
                             className={`p-4 rounded-2xl border cursor-pointer transition-all ${selectedReport?.id === rep.id ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white hover:border-red-200'}`}>
                            <div className="flex justify-between items-start mb-2">
                                <span className="font-bold text-gray-800">{rep.reporter_name}</span>
                                <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${rep.status === 'new' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                    {rep.status === 'new' ? 'جديد' : 'تم الرد'}
                                </span>
                            </div>
                            <p className="text-sm text-gray-600 line-clamp-2">{rep.description}</p>
                            <div className="flex gap-4 mt-3 text-[10px] text-gray-400 font-bold">
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
                                <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-xl border">
                                    {selectedReport.description}
                                </p>
                                {selectedReport.action_taken && (
                                    <div className="mt-3">
                                        <span className="text-xs font-bold text-gray-500 block mb-1">الإجراء الفوري:</span>
                                        <p className="text-sm text-gray-700">{selectedReport.action_taken}</p>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3">
                                <h4 className="font-bold text-gray-800 flex items-center gap-2">
                                    <MessageSquare className="w-5 h-5 text-blue-600"/> رد إدارة الجودة
                                </h4>
                                {selectedReport.status === 'closed' ? (
                                    <div className="bg-green-50 p-4 rounded-xl border border-green-100 text-green-800 text-sm font-medium">
                                        {selectedReport.quality_response}
                                    </div>
                                ) : (
                                    <>
                                        <textarea 
                                            className="w-full p-4 rounded-xl border-2 border-gray-100 focus:border-blue-500 outline-none text-sm h-32 resize-none"
                                            placeholder="اكتب الإجراء التصحيحي أو الرد هنا..."
                                            value={response}
                                            onChange={e => setResponse(e.target.value)}
                                        ></textarea>
                                        <button 
                                            onClick={handleSubmitResponse}
                                            disabled={loading || !response}
                                            className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex justify-center items-center gap-2"
                                        >
                                            <Send className="w-4 h-4 rtl:rotate-180"/> اعتماد الرد وإرسال نسخة للمدير
                                        </button>
                                    </>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-20 text-gray-400">
                            <AlertTriangle className="w-16 h-16 mx-auto mb-4 opacity-20"/>
                            <p>اختر تقريراً من القائمة لعرض التفاصيل والرد</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
