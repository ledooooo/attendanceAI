import React, { useState, useMemo } from 'react';
import { Employee } from '../../../types';
import { supabase } from '../../../supabaseClient';
import { 
    Search, Printer, Syringe, CheckCircle2, AlertCircle, XCircle, 
    Plus, Save, X, Loader2 
} from 'lucide-react';
import { ExcelUploadButton } from '../../../components/ui/ExcelUploadButton';
import toast from 'react-hot-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export default function VaccinationsTab({ employees }: { employees: Employee[] }) {
    const queryClient = useQueryClient();

    // UI State
    const [searchTerm, setSearchTerm] = useState('');
    const [filterSpecialty, setFilterSpecialty] = useState('all');
    const [filterStatus, setFilterStatus] = useState('نشط');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
    
    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [selectedEmpId, setSelectedEmpId] = useState('');
    const [modalData, setModalData] = useState<any>({});

    // استخراج التخصصات
    const specialties = ['all', ...Array.from(new Set(employees.map(e => e.specialty))).filter(Boolean)];

    // 1. الفلترة والبحث
    const filteredData = useMemo(() => {
        return employees.filter(emp => {
            const term = searchTerm.toLowerCase();
            const matchSearch = 
                emp.name.toLowerCase().includes(term) || 
                (emp.national_id && emp.national_id.includes(term)) ||
                (emp.employee_id && emp.employee_id.toLowerCase().includes(term));
            
            const matchSpec = filterSpecialty === 'all' || emp.specialty === filterSpecialty;
            const matchStatus = filterStatus === 'all' || (filterStatus === 'نشط' ? emp.status === 'نشط' : emp.status !== 'نشط');

            return matchSearch && matchSpec && matchStatus;
        }).sort((a: any, b: any) => {
            if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
            if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [employees, searchTerm, filterSpecialty, filterStatus, sortConfig]);

    // 2. الإحصائيات
    const stats = useMemo(() => {
        const total = filteredData.length;
        let dose0 = 0, dose1 = 0, dose2 = 0, dose3 = 0;
        filteredData.forEach(emp => {
            let count = 0;
            if (emp.hep_b_dose1) count++;
            if (emp.hep_b_dose2) count++;
            if (emp.hep_b_dose3) count++;
            if (count === 0) dose0++; else if (count === 1) dose1++; else if (count === 2) dose2++; else if (count === 3) dose3++;
        });
        return { total, dose0, dose1, dose2, dose3 };
    }, [filteredData]);

    // ✅ دالة تنسيق التاريخ الآمنة (تمنع الكراش)
    const formatDate = (val: any) => {
        if (!val) return null;
        let date;

        // معالجة تواريخ إكسيل الرقمية
        if (typeof val === 'number') {
            date = new Date(Math.round((val - 25569) * 86400 * 1000));
        } else {
            date = new Date(val);
        }

        // التحقق من صلاحية التاريخ
        if (isNaN(date.getTime())) {
            return null; 
        }

        return date.toISOString().split('T')[0];
    };

    // ✅ 3. معالجة ملف الإكسيل (Import Logic - Fixed)
    const handleExcelImport = async (data: any[]) => {
        if (!data || data.length === 0) {
            toast.error("الملف فارغ!");
            return;
        }

        // 1. تنظيف أسماء الأعمدة (تحويل لـ lowercase وإزالة المسافات)
        const cleanData = data.map(row => {
            const newRow: any = {};
            Object.keys(row).forEach(key => {
                newRow[key.trim().toLowerCase()] = row[key]; 
            });
            return newRow;
        });

        // 2. تجهيز البيانات للتحديث
        const updates = cleanData.map((row: any) => {
            // البحث عن الكود الوظيفي (employee_id)
            const empId = row['employee_id'] || row['code'] || row['id'];
            
            if (!empId) return null;

            return {
                employee_id: String(empId),
                hep_b_dose1: formatDate(row['hep_b_dose1']),
                hep_b_dose2: formatDate(row['hep_b_dose2']),
                hep_b_dose3: formatDate(row['hep_b_dose3']),
                hep_b_location: row['hep_b_location'] || row['location'],
                hep_b_notes: row['hep_b_notes'] || row['notes']
            };
        }).filter(Boolean);

        if (updates.length === 0) {
            toast.error("لم يتم العثور على عمود 'employee_id' في الملف");
            return;
        }

        // 3. تنفيذ التحديث
        let successCount = 0;
        let errorCount = 0;
        const toastId = toast.loading(`جاري معالجة ${updates.length} موظف...`);

        // استخدام Loop للتحديث (يمكن استبدالها بـ Upsert إذا كنت تفضل السرعة القصوى، لكن Update آمن لعدم إنشاء موظفين جدد بالخطأ)
        for (const update of updates) {
            const { error } = await supabase
                .from('employees')
                .update({
                    hep_b_dose1: update.hep_b_dose1,
                    hep_b_dose2: update.hep_b_dose2,
                    hep_b_dose3: update.hep_b_dose3,
                    hep_b_location: update.hep_b_location,
                    hep_b_notes: update.hep_b_notes
                })
                .eq('employee_id', update.employee_id);
            
            if (!error) successCount++;
            else {
                console.error("Error updating:", update.employee_id, error);
                errorCount++;
            }
        }

        toast.dismiss(toastId);
        if (successCount > 0) toast.success(`تم تحديث ${successCount} سجل بنجاح`);
        if (errorCount > 0) toast.error(`فشل تحديث ${errorCount} سجل (تأكد من صحة الأكواد)`);
        
        queryClient.invalidateQueries({ queryKey: ['admin_employees'] });
    };

    // 4. الحفظ اليدوي (Mutation)
    const saveMutation = useMutation({
        mutationFn: async (data: any) => {
            const { error } = await supabase
                .from('employees')
                .update({
                    hep_b_dose1: data.d1 || null,
                    hep_b_dose2: data.d2 || null,
                    hep_b_dose3: data.d3 || null,
                    hep_b_location: data.loc,
                    hep_b_notes: data.notes
                })
                .eq('employee_id', data.empId);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("تم الحفظ");
            setShowModal(false);
            queryClient.invalidateQueries({ queryKey: ['admin_employees'] });
        },
        onError: () => toast.error("فشل الحفظ")
    });

    // فتح المودال لموظف محدد أو جديد
    const openModal = (emp?: Employee) => {
        if (emp) {
            setSelectedEmpId(emp.employee_id);
            setModalData({
                d1: emp.hep_b_dose1,
                d2: emp.hep_b_dose2,
                d3: emp.hep_b_dose3,
                loc: emp.hep_b_location,
                notes: emp.hep_b_notes
            });
        } else {
            setSelectedEmpId('');
            setModalData({});
        }
        setShowModal(true);
    };

    const getPercentage = (val: number) => stats.total > 0 ? Math.round((val / stats.total) * 100) : 0;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* CSS للطباعة */}
            <style>
                {`
                    @media print {
                        @page { size: A4 landscape; margin: 10mm; }
                        body * { visibility: hidden; }
                        #vaccine-print-area, #vaccine-print-area * { visibility: visible; }
                        #vaccine-print-area { position: absolute; left: 0; top: 0; width: 100%; }
                        .no-print { display: none !important; }
                        table { width: 100%; font-size: 10px; border-collapse: collapse; }
                        th, td { border: 1px solid #333; padding: 4px; text-align: center; }
                        th { background-color: #eee !important; font-weight: bold; }
                    }
                `}
            </style>

            {/* الإحصائيات */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 no-print">
                <StatCard label="إجمالي الموظفين" value={stats.total} color="blue" icon={<Syringe/>} />
                <StatCard label="مكتمل (3 جرعات)" value={stats.dose3} sub={`${getPercentage(stats.dose3)}%`} color="green" icon={<CheckCircle2/>} />
                <StatCard label="جزئي (1-2)" value={stats.dose1 + stats.dose2} sub={`${getPercentage(stats.dose1 + stats.dose2)}%`} color="orange" icon={<AlertCircle/>} />
                <StatCard label="لم يبدأ" value={stats.dose0} sub={`${getPercentage(stats.dose0)}%`} color="red" icon={<XCircle/>} />
            </div>

            {/* شريط الأدوات */}
            <div className="flex flex-col xl:flex-row gap-4 bg-gray-50 p-4 rounded-2xl border no-print items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                        type="text" 
                        placeholder="بحث (اسم، كود، رقم قومي)..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pr-10 pl-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                </div>
                
                <div className="flex gap-2 w-full xl:w-auto overflow-x-auto pb-2 xl:pb-0">
                    <select value={filterSpecialty} onChange={(e) => setFilterSpecialty(e.target.value)} className="p-3 rounded-xl border bg-white font-bold text-sm">
                        <option value="all">كل التخصصات</option>
                        {specialties.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    
                    <button onClick={() => openModal()} className="bg-emerald-600 text-white px-4 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-700 whitespace-nowrap text-sm">
                        <Plus className="w-4 h-4"/> تسجيل يدوي
                    </button>

                    <ExcelUploadButton onData={handleExcelImport} label="استيراد Excel" />
                    
                    <button onClick={() => window.print()} className="bg-blue-600 text-white px-4 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 whitespace-nowrap text-sm">
                        <Printer className="w-4 h-4"/> طباعة
                    </button>
                </div>
            </div>

            {/* الجدول */}
            <div id="vaccine-print-area" className="bg-white p-6 rounded-3xl border shadow-sm overflow-hidden min-h-[500px]">
                <div className="hidden print:block text-center mb-6 pb-2 border-b">
                    <h2 className="text-xl font-black">سجل تطعيمات الالتهاب الكبدي الفيروسي (B)</h2>
                    <p className="text-sm">تاريخ التقرير: {new Date().toLocaleDateString('ar-EG')}</p>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                        <thead className="bg-gray-50 text-gray-700 border-b-2 border-gray-200">
                            <tr>
                                <th className="p-3 font-black w-[15%]">الاسم</th>
                                <th className="p-3 font-black w-[8%]">الكود</th>
                                <th className="p-3 font-black w-[12%]">الرقم القومي</th>
                                <th className="p-3 font-black w-[10%]">التخصص</th>
                                <th className="p-3 font-black text-center bg-blue-50 w-[10%]">الجرعة 1</th>
                                <th className="p-3 font-black text-center bg-blue-50 w-[10%]">الجرعة 2</th>
                                <th className="p-3 font-black text-center bg-blue-50 w-[10%]">الجرعة 3</th>
                                <th className="p-3 font-black w-[10%]">المكان</th>
                                <th className="p-3 font-black w-[15%]">ملاحظات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredData.map((emp) => (
                                <tr key={emp.id} onClick={() => openModal(emp)} className="hover:bg-blue-50/50 transition-colors cursor-pointer group">
                                    <td className="p-2 font-bold text-gray-800">{emp.name}</td>
                                    <td className="p-2 font-mono text-xs text-blue-600 font-bold">{emp.employee_id}</td>
                                    <td className="p-2 font-mono text-xs">{emp.national_id || '-'}</td>
                                    <td className="p-2 text-xs">{emp.specialty}</td>
                                    
                                    <td className="p-2 text-center border-l border-r border-gray-100">
                                        {emp.hep_b_dose1 ? <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-[10px] font-bold">{emp.hep_b_dose1}</span> : '-'}
                                    </td>
                                    <td className="p-2 text-center border-r border-gray-100">
                                        {emp.hep_b_dose2 ? <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-[10px] font-bold">{emp.hep_b_dose2}</span> : '-'}
                                    </td>
                                    <td className="p-2 text-center border-r border-gray-100">
                                        {emp.hep_b_dose3 ? <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-[10px] font-bold">{emp.hep_b_dose3}</span> : '-'}
                                    </td>

                                    <td className="p-2 text-xs truncate max-w-[100px]">{emp.hep_b_location}</td>
                                    <td className="p-2 text-xs truncate max-w-[150px]">{emp.hep_b_notes}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal تسجيل/تحديث البيانات */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 no-print">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl animate-in zoom-in-95">
                        <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-3xl">
                            <h3 className="font-black text-lg flex items-center gap-2">
                                <Syringe className="text-emerald-600"/> تحديث بيانات التطعيم
                            </h3>
                            <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-400 hover:text-red-500"/></button>
                        </div>
                        
                        <div className="p-6 space-y-4">
                            {!selectedEmpId ? (
                                <div>
                                    <label className="block text-sm font-bold text-gray-600 mb-1">اختر الموظف</label>
                                    <select 
                                        className="w-full p-3 rounded-xl border bg-gray-50 font-bold"
                                        onChange={(e) => {
                                            const emp = employees.find(em => em.employee_id === e.target.value);
                                            if(emp) openModal(emp);
                                        }}
                                    >
                                        <option value="">-- ابحث في القائمة --</option>
                                        {employees.map(e => <option key={e.id} value={e.employee_id}>{e.name} ({e.employee_id})</option>)}
                                    </select>
                                </div>
                            ) : (
                                <div className="text-center bg-blue-50 p-2 rounded-xl mb-4">
                                    <p className="font-bold text-blue-800">
                                        {employees.find(e => e.employee_id === selectedEmpId)?.name}
                                    </p>
                                    <p className="text-xs text-blue-600">كود: {selectedEmpId}</p>
                                </div>
                            )}

                            {selectedEmpId && (
                                <>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div>
                                            <label className="text-xs font-bold block mb-1">الجرعة 1</label>
                                            <input type="date" value={modalData.d1 || ''} onChange={e => setModalData({...modalData, d1: e.target.value})} className="w-full p-2 border rounded-lg text-sm" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold block mb-1">الجرعة 2</label>
                                            <input type="date" value={modalData.d2 || ''} onChange={e => setModalData({...modalData, d2: e.target.value})} className="w-full p-2 border rounded-lg text-sm" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold block mb-1">الجرعة 3</label>
                                            <input type="date" value={modalData.d3 || ''} onChange={e => setModalData({...modalData, d3: e.target.value})} className="w-full p-2 border rounded-lg text-sm" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold block mb-1">مكان التطعيم</label>
                                        <input type="text" value={modalData.loc || ''} onChange={e => setModalData({...modalData, loc: e.target.value})} className="w-full p-3 border rounded-xl" placeholder="مثال: المستشفى..." />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold block mb-1">ملاحظات</label>
                                        <textarea value={modalData.notes || ''} onChange={e => setModalData({...modalData, notes: e.target.value})} className="w-full p-3 border rounded-xl h-20" placeholder="أي ملاحظات..." />
                                    </div>

                                    <button 
                                        onClick={() => saveMutation.mutate({ empId: selectedEmpId, ...modalData })} 
                                        disabled={saveMutation.isPending}
                                        className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 flex justify-center gap-2"
                                    >
                                        {saveMutation.isPending ? <Loader2 className="animate-spin"/> : <Save className="w-5 h-5"/>} حفظ البيانات
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// مكون فرعي للبطاقات
const StatCard = ({ label, value, sub, color, icon }: any) => (
    <div className={`bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between group hover:border-${color}-200 transition-all`}>
        <div>
            <p className="text-xs text-gray-400 font-bold mb-1">{label}</p>
            <div className="flex items-baseline gap-2">
                <h4 className={`text-2xl font-black text-gray-800 group-hover:text-${color}-600 transition-colors`}>{value}</h4>
                {sub && <span className={`text-xs font-bold text-${color}-500 bg-${color}-50 px-1.5 py-0.5 rounded`}>{sub}</span>}
            </div>
        </div>
        <div className={`w-10 h-10 rounded-full bg-${color}-50 flex items-center justify-center text-${color}-500 group-hover:scale-110 transition-transform`}>
            {icon}
        </div>
    </div>
);
