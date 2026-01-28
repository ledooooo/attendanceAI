import React, { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../../supabaseClient';
import { Printer, AlertTriangle, Eye, X, ChevronLeft, ChevronRight, ArrowUpDown, Filter } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';

const PAGE_SIZE = 10;

export default function StaffOVRManager() {
    // UI State
    const [page, setPage] = useState(0);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'incident_date', direction: 'desc' });
    const [selectedForPrint, setSelectedForPrint] = useState<string[]>([]);
    const [selectedReport, setSelectedReport] = useState<any>(null);
    
    // Print Ref
    const printRef = useRef(null);

    // Fetch Reports
    const { data: reports = [], isLoading } = useQuery({
        queryKey: ['staff_admin_ovr_list'], // نجلب الكل ثم نقوم بالتقسيم في الواجهة لسهولة الفلترة
        queryFn: async () => {
            const { data, error } = await supabase
                .from('ovr_reports')
                .select(`
                    *,
                    reporter:employees!reporter_id(name) 
                `)
                // ملاحظة: reporter_id قد يكون null إذا كان مجهولاً
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            return data;
        }
    });

    // 1. Sorting Logic
    const sortedReports = React.useMemo(() => {
        let sorted = [...reports];
        sorted.sort((a: any, b: any) => {
            let valA = a[sortConfig.key];
            let valB = b[sortConfig.key];

            // معالجة خاصة لاسم المبلغ
            if (sortConfig.key === 'reporter') {
                valA = a.reporter?.name || 'مجهول';
                valB = b.reporter?.name || 'مجهول';
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
        return sorted;
    }, [reports, sortConfig]);

    // 2. Pagination Logic
    const paginatedReports = sortedReports.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    const totalPages = Math.ceil(reports.length / PAGE_SIZE);

    // 3. Printing Logic
    const handlePrint = useReactToPrint({
        content: () => printRef.current,
        documentTitle: `OVR_Reports_${new Date().toISOString().split('T')[0]}`,
    });

    const toggleSort = (key: string) => {
        setSortConfig(curr => ({
            key,
            direction: curr.key === key && curr.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const toggleSelection = (id: string) => {
        setSelectedForPrint(prev => 
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const selectAllPage = () => {
        const ids = paginatedReports.map(r => r.id);
        if (ids.every(id => selectedForPrint.includes(id))) {
            setSelectedForPrint(prev => prev.filter(id => !ids.includes(id)));
        } else {
            setSelectedForPrint(prev => [...new Set([...prev, ...ids])]);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* Header Controls */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-red-50 no-print gap-4">
                <h3 className="font-bold text-red-800 flex items-center gap-2 text-lg">
                    <AlertTriangle className="w-6 h-6"/> تقارير الأحداث العارضة (OVR)
                </h3>
                
                <div className="flex gap-2 w-full md:w-auto">
                    {selectedForPrint.length > 0 && (
                        <span className="bg-red-50 text-red-600 px-3 py-2 rounded-xl text-xs font-bold flex items-center">
                            تم تحديد {selectedForPrint.length} للطباعة
                        </span>
                    )}
                    <button 
                        onClick={handlePrint} 
                        disabled={selectedForPrint.length === 0}
                        className="bg-gray-800 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-gray-900 disabled:opacity-50 transition-all flex-1 md:flex-none justify-center"
                    >
                        <Printer className="w-4 h-4"/> طباعة المحدد
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-3xl border shadow-sm overflow-hidden p-6">
                <div className="overflow-x-auto min-h-[400px]">
                    <table className="w-full text-sm text-right">
                        <thead className="bg-gray-50 font-bold border-b text-gray-600">
                            <tr>
                                <th className="p-3 w-10 text-center">
                                    <input type="checkbox" className="accent-red-600 w-4 h-4" onChange={selectAllPage} />
                                </th>
                                <th className="p-3 cursor-pointer hover:text-red-600" onClick={() => toggleSort('incident_date')}>
                                    <div className="flex items-center gap-1">التاريخ <ArrowUpDown className="w-3 h-3"/></div>
                                </th>
                                <th className="p-3">نوع الحدث</th>
                                <th className="p-3 cursor-pointer hover:text-red-600" onClick={() => toggleSort('location')}>
                                    <div className="flex items-center gap-1">الموقع <ArrowUpDown className="w-3 h-3"/></div>
                                </th>
                                <th className="p-3 cursor-pointer hover:text-red-600" onClick={() => toggleSort('reporter')}>
                                    <div className="flex items-center gap-1">المبلغ <ArrowUpDown className="w-3 h-3"/></div>
                                </th>
                                <th className="p-3 cursor-pointer hover:text-red-600" onClick={() => toggleSort('status')}>
                                    <div className="flex items-center gap-1">الحالة <ArrowUpDown className="w-3 h-3"/></div>
                                </th>
                                <th className="p-3 text-center">عرض</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {paginatedReports.map((rep: any) => (
                                <tr key={rep.id} className={`hover:bg-red-50/30 transition-colors ${selectedForPrint.includes(rep.id) ? 'bg-red-50' : ''}`}>
                                    <td className="p-3 text-center">
                                        <input 
                                            type="checkbox" 
                                            className="accent-red-600 w-4 h-4" 
                                            checked={selectedForPrint.includes(rep.id)}
                                            onChange={() => toggleSelection(rep.id)}
                                        />
                                    </td>
                                    <td className="p-3 font-mono">{new Date(rep.incident_date || rep.created_at).toLocaleDateString('ar-EG')}</td>
                                    <td className="p-3 font-bold text-gray-800">{rep.event_type || 'غير محدد'}</td>
                                    <td className="p-3">{rep.location}</td>
                                    <td className="p-3">
                                        {rep.is_anonymous ? <span className="text-gray-400 italic">مجهول</span> : 
                                         <span className="font-bold text-blue-600">{rep.reporter?.name}</span>}
                                    </td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                                            rep.status === 'new' ? 'bg-red-100 text-red-700' : 
                                            rep.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-green-100 text-green-700'
                                        }`}>
                                            {rep.status === 'new' ? 'جديد' : rep.status === 'in_progress' ? 'جاري العمل' : 'مغلق'}
                                        </span>
                                    </td>
                                    <td className="p-3 text-center">
                                        <button onClick={() => setSelectedReport(rep)} className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                                            <Eye className="w-4 h-4 text-gray-600"/>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {paginatedReports.length === 0 && (
                                <tr><td colSpan={7} className="p-10 text-center text-gray-400">لا توجد بلاغات للعرض</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="flex justify-between items-center mt-6 pt-4 border-t">
                    <button 
                        onClick={() => setPage(p => Math.max(0, p - 1))} 
                        disabled={page === 0}
                        className="px-4 py-2 rounded-xl bg-gray-100 text-gray-600 disabled:opacity-50 hover:bg-gray-200 text-sm font-bold flex items-center gap-2"
                    >
                        <ChevronRight className="w-4 h-4"/> السابق
                    </button>
                    <span className="text-sm font-bold text-gray-500">صفحة {page + 1} من {totalPages || 1}</span>
                    <button 
                        onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} 
                        disabled={page >= totalPages - 1}
                        className="px-4 py-2 rounded-xl bg-gray-100 text-gray-600 disabled:opacity-50 hover:bg-gray-200 text-sm font-bold flex items-center gap-2"
                    >
                        التالي <ChevronLeft className="w-4 h-4"/>
                    </button>
                </div>
            </div>

            {/* Hidden Print Area */}
            <div className="hidden">
                <div ref={printRef} className="p-8 dir-rtl text-right" dir="rtl">
                    {reports.filter((r: any) => selectedForPrint.includes(r.id)).map((report: any, index: number) => (
                        <div key={report.id} className="mb-8 border-b-2 border-dashed border-gray-300 pb-8 last:border-0 page-break-inside-avoid">
                            {/* Header */}
                            <div className="text-center border-b-2 border-black pb-4 mb-6">
                                <h1 className="text-2xl font-black">نموذج تقرير حدث عارض (OVR)</h1>
                                <p className="text-sm font-bold mt-2">مركز غرب المطار - إدارة الجودة</p>
                            </div>

                            {/* Info Grid */}
                            <div className="grid grid-cols-2 gap-6 text-sm mb-6">
                                <div className="bg-gray-50 p-4 border rounded-xl">
                                    <span className="block text-gray-500 text-xs font-bold mb-1">تاريخ ووقت الحدث</span>
                                    <span className="font-bold text-lg">{new Date(report.incident_date).toLocaleString('ar-EG')}</span>
                                </div>
                                <div className="bg-gray-50 p-4 border rounded-xl">
                                    <span className="block text-gray-500 text-xs font-bold mb-1">الموقع</span>
                                    <span className="font-bold text-lg">{report.location}</span>
                                </div>
                                <div className="bg-gray-50 p-4 border rounded-xl">
                                    <span className="block text-gray-500 text-xs font-bold mb-1">المبلغ</span>
                                    <span className="font-bold text-lg">{report.is_anonymous ? 'مجهول' : report.reporter?.name || 'غير محدد'}</span>
                                </div>
                                <div className="bg-gray-50 p-4 border rounded-xl">
                                    <span className="block text-gray-500 text-xs font-bold mb-1">الحالة الحالية</span>
                                    <span className="font-bold text-lg">{report.status === 'new' ? 'جديد' : 'تمت المراجعة'}</span>
                                </div>
                            </div>

                            {/* Description Box */}
                            <div className="mb-6">
                                <h3 className="font-bold text-lg mb-2 border-r-4 border-red-600 pr-2">وصف الحدث</h3>
                                <div className="p-4 border rounded-xl bg-white min-h-[100px] whitespace-pre-wrap leading-relaxed">
                                    {report.discerption || 'لا يوجد وصف'}
                                </div>
                            </div>

                            {/* Action Taken Box */}
                            <div className="mb-6">
                                <h3 className="font-bold text-lg mb-2 border-r-4 border-blue-600 pr-2">الإجراء الفوري المتخذ</h3>
                                <div className="p-4 border rounded-xl bg-white min-h-[60px] whitespace-pre-wrap leading-relaxed">
                                    {report.action_taken || 'لا يوجد إجراء مسجل'}
                                </div>
                            </div>

                            {/* Quality Response Box */}
                            <div className="mb-6">
                                <h3 className="font-bold text-lg mb-2 border-r-4 border-green-600 pr-2">رد الجودة / الإجراء التصحيحي</h3>
                                <div className="p-4 border rounded-xl bg-white min-h-[80px] whitespace-pre-wrap leading-relaxed">
                                    {report.quality_responce || 'لم يتم الرد بعد'}
                                </div>
                            </div>

                            {/* Signatures */}
                            <div className="flex justify-between mt-12 pt-8 px-12">
                                <div className="text-center">
                                    <p className="font-bold text-sm">توقيع المبلغ</p>
                                    <p className="mt-8 text-gray-300">....................</p>
                                </div>
                                <div className="text-center">
                                    <p className="font-bold text-sm">مسؤول الجودة</p>
                                    <p className="mt-8 text-gray-300">....................</p>
                                </div>
                                <div className="text-center">
                                    <p className="font-bold text-sm">مدير المركز</p>
                                    <p className="mt-8 text-gray-300">....................</p>
                                </div>
                            </div>
                            
                            {/* Page Break for multiple reports */}
                            {index < selectedForPrint.length - 1 && <div className="page-break" style={{ pageBreakAfter: 'always' }}></div>}
                        </div>
                    ))}
                </div>
            </div>

            {/* Modal for Details (View Only) */}
            {selectedReport && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 no-print">
                    <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl p-6 relative animate-in zoom-in-95 max-h-[80vh] overflow-y-auto">
                        <button onClick={() => setSelectedReport(null)} className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-red-100 hover:text-red-500"><X className="w-5 h-5"/></button>
                        <h3 className="text-xl font-black text-gray-800 mb-6 pb-4 border-b">تفاصيل البلاغ</h3>
                        
                        <div className="space-y-6">
                            <div>
                                <label className="text-xs font-bold text-gray-500 block mb-1">وصف الحدث</label>
                                <p className="text-gray-800 bg-gray-50 p-4 rounded-xl border">{selectedReport.discerption}</p>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 block mb-1">الإجراء المتخذ</label>
                                <p className="text-gray-800 bg-gray-50 p-4 rounded-xl border">{selectedReport.action_taken || '-'}</p>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 block mb-1">رد الجودة</label>
                                <p className="text-gray-800 bg-green-50 p-4 rounded-xl border border-green-100">{selectedReport.quality_responce || 'قيد المراجعة'}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
