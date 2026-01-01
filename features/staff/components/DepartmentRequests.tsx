import React, { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, LeaveRequest } from '../../../types';
import { 
    CheckCircle2, XCircle, Clock, User, FileText, 
    Check, X, Filter, Search, Calendar, AlertCircle 
} from 'lucide-react';

export default function DepartmentRequests({ hod }: { hod: Employee }) {
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // --- حالات الفلترة ---
    const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterType, setFilterType] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    // جلب الطلبات
    const fetchDeptRequests = async () => {
        setLoading(true);
        try {
            // 1. جلب موظفي القسم (نفس التخصص) مع استبعاد رئيس القسم
            const { data: deptEmployees } = await supabase
                .from('employees')
                .select('employee_id, name')
                .eq('specialty', hod.specialty)
                .neq('employee_id', hod.employee_id);

            if (!deptEmployees || deptEmployees.length === 0) {
                setRequests([]);
                setLoading(false);
                return;
            }

            const empIds = deptEmployees.map(e => e.employee_id);

            // 2. جلب الطلبات بناءً على الشهر المحدد
            const startOfMonth = `${filterMonth}-01`;
            const endOfMonth = `${filterMonth}-31`;

            const { data: reqs } = await supabase
                .from('leave_requests')
                .select('*')
                .in('employee_id', empIds)
                .gte('start_date', startOfMonth)
                .lte('start_date', endOfMonth)
                .order('created_at', { ascending: false });

            // 3. دمج أسماء الموظفين
            const enrichedRequests = (reqs || []).map(r => {
                const emp = deptEmployees.find(e => e.employee_id === r.employee_id);
                return { 
                    ...r, 
                    employee_name: emp ? emp.name : 'غير معروف',
                    employee_code: r.employee_id 
                };
            });

            setRequests(enrichedRequests);
        } catch (error) {
            console.error("Error fetching dept requests:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (hod) fetchDeptRequests();
    }, [hod, filterMonth]);

    // تنفيذ الفلترة المحلية
    const filteredRequests = requests.filter(req => {
        if (filterStatus !== 'all' && req.status !== filterStatus) return false;
        if (filterType !== 'all' && req.type !== filterType) return false;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            const nameMatch = req.employee_name?.toLowerCase().includes(term);
            const codeMatch = req.employee_code?.toLowerCase().includes(term);
            if (!nameMatch && !codeMatch) return false;
        }
        return true;
    });

    // دالة اتخاذ القرار (تعديل الحالة إلى "موافقة رئيس القسم")
    const handleAction = async (id: string, action: 'approve' | 'reject') => {
        const newStatus = action === 'approve' ? 'موافقة_رئيس_القسم' : 'مرفوض';
        const confirmMsg = action === 'approve' ? 'الموافقة المبدئية ورفعه للمدير' : 'رفض الطلب نهائياً';

        if (!confirm(`هل أنت متأكد من ${confirmMsg}؟`)) return;

        const { error } = await supabase
            .from('leave_requests')
            .update({ 
                status: newStatus,
                approved_by: hod.name // تسجيل اسم رئيس القسم
            })
            .eq('id', id);

        if (!error) {
            setRequests(prev => prev.map(r => r.id === id ? { ...r, status: newStatus, approved_by: hod.name } : r));
            alert('تم تسجيل الإجراء بنجاح');
        } else {
            alert('حدث خطأ أثناء التحديث');
        }
    };

    // ألوان الحالة
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'مقبول': return 'bg-green-100 text-green-700 border-green-200';
            case 'مرفوض': return 'bg-red-100 text-red-700 border-red-200';
            case 'موافقة_رئيس_القسم': return 'bg-blue-100 text-blue-700 border-blue-200';
            default: return 'bg-yellow-100 text-yellow-700 border-yellow-200';
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            {/* Header & Filters */}
            <div className="bg-white p-6 rounded-[30px] border border-gray-100 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                        <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                            <FileText className="w-6 h-6 text-purple-600"/> إدارة قسم {hod.specialty}
                        </h3>
                        <p className="text-gray-500 text-xs font-bold mt-1">
                            إجمالي الطلبات: {filteredRequests.length}
                        </p>
                    </div>
                    
                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-xl border border-gray-200">
                        <Calendar className="w-4 h-4 text-gray-400"/>
                        <input 
                            type="month" 
                            value={filterMonth}
                            onChange={(e) => setFilterMonth(e.target.value)}
                            className="bg-transparent border-none outline-none text-sm font-bold text-gray-700"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                        <input 
                            type="text" 
                            placeholder="بحث باسم الموظف أو الكود..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pr-9 pl-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-100 outline-none"
                        />
                    </div>
                    
                    <div className="relative">
                        <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                        <select 
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="w-full pr-9 pl-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-100 outline-none appearance-none"
                        >
                            <option value="all">كل الحالات</option>
                            <option value="قيد الانتظار">قيد الانتظار (جديد)</option>
                            <option value="موافقة_رئيس_القسم">موافقة رئيس القسم</option>
                            <option value="مقبول">مقبول نهائي</option>
                            <option value="مرفوض">مرفوض</option>
                        </select>
                    </div>

                    <div className="relative">
                        <FileText className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                        <select 
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="w-full pr-9 pl-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-100 outline-none appearance-none"
                        >
                            <option value="all">كل الأنواع</option>
                            <option value="إجازة اعتيادية">إجازة اعتيادية</option>
                            <option value="إجازة عارضة">إجازة عارضة</option>
                            <option value="مأمورية">مأمورية</option>
                            <option value="مرضي">مرضي</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Requests List */}
            {loading ? (
                <div className="text-center py-10 text-gray-400">جاري تحميل البيانات...</div>
            ) : filteredRequests.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-[30px] border border-dashed border-gray-200">
                    <CheckCircle2 className="w-16 h-16 text-gray-300 mx-auto mb-4"/>
                    <p className="text-gray-500 font-bold">لا توجد طلبات تطابق الفلتر الحالي</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {filteredRequests.map(req => (
                        <div key={req.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
                            {/* Card Header */}
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center border border-purple-100">
                                        <User className="w-5 h-5 text-purple-600"/>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                                            {req.employee_name}
                                            <span className="bg-gray-100 text-gray-500 text-[10px] px-1.5 py-0.5 rounded font-mono">
                                                {req.employee_code}
                                            </span>
                                        </h4>
                                        <span className="text-[10px] text-gray-400 font-bold flex items-center gap-1">
                                            <Clock className="w-3 h-3"/> {new Date(req.created_at).toLocaleDateString('ar-EG')}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${getStatusColor(req.status)}`}>
                                        {req.status === 'موافقة_رئيس_القسم' ? 'موافقة مبدئية' : req.status}
                                    </span>
                                    <span className="text-[10px] text-gray-500 font-bold">{req.type}</span>
                                </div>
                            </div>

                            {/* Details */}
                            <div className="flex items-center gap-4 text-xs text-gray-600 bg-gray-50 p-3 rounded-xl mb-4 border border-gray-100">
                                <div className="flex items-center gap-1">
                                    <span className="text-gray-400 font-bold">من:</span>
                                    <span className="font-bold font-mono text-gray-800">{req.start_date}</span>
                                </div>
                                <div className="w-px h-3 bg-gray-300"></div>
                                <div className="flex items-center gap-1">
                                    <span className="text-gray-400 font-bold">إلى:</span>
                                    <span className="font-bold font-mono text-gray-800">{req.end_date}</span>
                                </div>
                            </div>

                            {req.notes && (
                                <div className="text-xs text-gray-500 mb-4 bg-yellow-50/50 p-2 rounded-lg border border-yellow-100 flex gap-2">
                                    <AlertCircle className="w-4 h-4 text-yellow-500 shrink-0"/>
                                    <span className="italic">"{req.notes}"</span>
                                </div>
                            )}

                            {/* Actions (Only for pending requests) */}
                            {(req.status === 'قيد الانتظار' || req.status === 'معلق') ? (
                                <div className="flex gap-2 pt-2 border-t border-gray-50">
                                    <button 
                                        onClick={() => handleAction(req.id, 'approve')}
                                        className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl text-xs font-bold hover:bg-emerald-700 flex items-center justify-center gap-1 transition-all shadow-sm active:scale-95"
                                    >
                                        <Check className="w-4 h-4"/> موافقة ورفع للمدير
                                    </button>
                                    <button 
                                        onClick={() => handleAction(req.id, 'reject')}
                                        className="flex-1 bg-white text-red-600 border border-red-100 py-2.5 rounded-xl text-xs font-bold hover:bg-red-50 flex items-center justify-center gap-1 transition-all active:scale-95"
                                    >
                                        <X className="w-4 h-4"/> رفض
                                    </button>
                                </div>
                            ) : (
                                <div className="pt-2 border-t border-gray-50 text-center">
                                    <span className="text-[10px] text-gray-400 font-bold">
                                        تم اتخاذ الإجراء ({req.status === 'موافقة_رئيس_القسم' ? 'بانتظار المدير' : req.status})
                                    </span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
