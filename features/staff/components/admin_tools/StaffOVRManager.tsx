import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../../supabaseClient';
import { Printer, AlertTriangle, Eye, X, CheckCircle2 } from 'lucide-react';

export default function StaffOVRManager() {
    const [selectedReport, setSelectedReport] = useState<any>(null);

    const { data: reports = [], isLoading } = useQuery({
        queryKey: ['staff_admin_ovr'],
        queryFn: async () => {
            // جلب التقارير
            const { data } = await supabase
                .from('ovr_reports')
                .select('*')
                .order('created_at', { ascending: false });
            return data;
        }
    });

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-red-50 no-print">
                <h3 className="font-bold text-red-800 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5"/> تقارير الأحداث العارضة (OVR)
                </h3>
                <button onClick={() => window.print()} className="bg-gray-800 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2">
                    <Printer className="w-4 h-4"/> طباعة السجل
                </button>
            </div>

            <div className="bg-white rounded-3xl border shadow-sm overflow-hidden p-6 print:border-none print:shadow-none">
                <div className="hidden print:block text-center mb-6 pb-4 border-b">
                    <h2 className="text-xl font-black">سجل بلاغات OVR</h2>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                        <thead className="bg-gray-50 font-bold border-b">
                            <tr>
                                <th className="p-3">التاريخ</th>
                                <th className="p-3">نوع الحدث</th>
                                <th className="p-3">الموقع</th>
                                <th className="p-3">المتضرر</th>
                                <th className="p-3">الحالة</th>
                                <th className="p-3 no-print">التفاصيل</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {reports.map((rep: any) => (
                                <tr key={rep.id} className="hover:bg-red-50/30">
                                    <td className="p-3">{new Date(rep.created_at).toLocaleDateString('ar-EG')}</td>
                                    <td className="p-3 font-bold">{rep.event_type}</td>
                                    <td className="p-3">{rep.location}</td>
                                    <td className="p-3">{rep.person_affected_name || 'غير محدد'}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${rep.status === 'new' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                            {rep.status === 'new' ? 'جديد' : 'تمت المراجعة'}
                                        </span>
                                    </td>
                                    <td className="p-3 no-print">
                                        <button onClick={() => setSelectedReport(rep)} className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200">
                                            <Eye className="w-4 h-4 text-gray-600"/>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal عرض التفاصيل */}
            {selectedReport && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 no-print">
                    <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl p-6 relative animate-in zoom-in-95 max-h-[80vh] overflow-y-auto">
                        <button onClick={() => setSelectedReport(null)} className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-red-100 hover:text-red-500"><X className="w-5 h-5"/></button>
                        
                        <h3 className="text-xl font-black text-gray-800 mb-4 border-b pb-2">تفاصيل البلاغ #{selectedReport.id.slice(0,4)}</h3>
                        
                        <div className="space-y-4 text-sm">
                            <div className="bg-gray-50 p-4 rounded-2xl border">
                                <p className="font-bold text-gray-500 mb-1">وصف الحدث:</p>
                                <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{selectedReport.description}</p>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div><span className="font-bold text-gray-500">التصنيف:</span> {selectedReport.category || '-'}</div>
                                <div><span className="font-bold text-gray-500">مستوى الخطورة:</span> {selectedReport.risk_level || '-'}</div>
                                <div><span className="font-bold text-gray-500">الإجراء المتخذ:</span> {selectedReport.immediate_action || 'لا يوجد'}</div>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end">
                            <button onClick={() => window.print()} className="bg-gray-800 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2">
                                <Printer className="w-4 h-4"/> طباعة التفاصيل
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
