import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../supabaseClient';
import { Employee } from '../../../../types';
import { Search, Syringe, Printer, Save, Loader2, ArrowUpDown, PieChart } from 'lucide-react';
import toast from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';

export default function StaffVaccineManager() {
    const queryClient = useQueryClient();
    const componentRef = useRef(null);
    const statsRef = useRef(null);

    // --- State ---
    const [search, setSearch] = useState('');
    const [filterSpecialty, setFilterSpecialty] = useState('all');
    const [filterStatus, setFilterStatus] = useState('active_only'); 
    const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'specialty'; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
    const [editingId, setEditingId] = useState<string | null>(null);
    const [tempData, setTempData] = useState<any>({});

    // --- Query ---
    const { data: employees = [], isLoading } = useQuery({
        queryKey: ['vaccine_staff_list'],
        queryFn: async () => {
            const { data } = await supabase.from('employees').select('*').order('name');
            return data as Employee[];
        },
        staleTime: 1000 * 60 * 10
    });

    // --- Processing ---
    const filteredData = useMemo(() => {
        let data = employees.filter(item => {
            const term = search.toLowerCase();
            const matchesSearch = item.name.toLowerCase().includes(term) || item.employee_id.includes(term);
            const matchesSpec = filterSpecialty === 'all' || item.specialty === filterSpecialty;
            
            let matchesStatus = true;
            if (filterStatus === 'active_only') matchesStatus = item.status === 'نشط';
            else if (filterStatus !== 'all') matchesStatus = item.status === filterStatus;

            return matchesSearch && matchesSpec && matchesStatus;
        });

        data.sort((a, b) => {
            const valA = a[sortConfig.key] || '';
            const valB = b[sortConfig.key] || '';
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return data;
    }, [employees, search, filterSpecialty, filterStatus, sortConfig]);

    // --- Statistics Logic ---
    const stats = useMemo(() => {
        const total = employees.length;
        const activeForce = employees.filter(e => e.status === 'نشط').length; // القوة الفعلية للنسب
        
        let d3 = 0, d2 = 0, d1 = 0, d0 = 0;
        let notEligible = 0; // غير مستحق (مناعة/أجسام مضادة)
        let leaves = employees.filter(e => e.status === 'إجازة').length;
        
        // العاملين الواجب تطعيمهم (نشط + لم يكمل 3 جرعات + مستحق)
        let needVaccineList: Employee[] = [];

        filteredData.forEach(emp => {
            // التحقق من "غير مستحق" بناءً على الملاحظات
            const isNotEligible = emp.hep_b_notes && (emp.hep_b_notes.includes('مناعة') || emp.hep_b_notes.includes('غير مستحق'));
            
            if (isNotEligible) {
                notEligible++;
            } else {
                let doses = 0;
                if (emp.hep_b_dose1) doses++;
                if (emp.hep_b_dose2) doses++;
                if (emp.hep_b_dose3) doses++;

                if (doses === 3) d3++;
                else if (doses === 2) d2++;
                else if (doses === 1) d1++;
                else d0++;

                // تحديد من يحتاج تطعيم (نشط وغير مكتمل)
                if (emp.status === 'نشط' && doses < 3) {
                    needVaccineList.push(emp);
                }
            }
        });

        return {
            total,
            activeForce,
            d3, d2, d1, d0,
            notEligible,
            leaves,
            needVaccineList,
            // النسب من القوة الفعلية (Active Force)
            p3: activeForce ? Math.round((d3 / activeForce) * 100) : 0,
            p2: activeForce ? Math.round((d2 / activeForce) * 100) : 0,
            p1: activeForce ? Math.round((d1 / activeForce) * 100) : 0,
            p0: activeForce ? Math.round((d0 / activeForce) * 100) : 0,
        };
    }, [filteredData, employees]);

    // --- Mutation ---
    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string, data: any }) => {
            await supabase.from('employees').update(data).eq('id', id);
        },
        onSuccess: () => {
            toast.success('تم التحديث');
            setEditingId(null);
            queryClient.invalidateQueries({ queryKey: ['vaccine_staff_list'] });
        },
        onError: () => toast.error('فشل الحفظ')
    });

    // --- Actions ---
    const startEdit = (emp: Employee) => {
        setEditingId(emp.id);
        setTempData({
            hep_b_dose1: emp.hep_b_dose1,
            hep_b_dose2: emp.hep_b_dose2,
            hep_b_dose3: emp.hep_b_dose3,
            hep_b_location: emp.hep_b_location
        });
    };

    const toggleSort = (key: 'name' | 'specialty') => {
        setSortConfig(curr => ({
            key,
            direction: curr.key === key && curr.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const handlePrintTable = useReactToPrint({
        content: () => componentRef.current,
        documentTitle: `Vaccine_List_${new Date().toISOString().split('T')[0]}`,
    });

    const handlePrintStats = useReactToPrint({
        content: () => statsRef.current,
        documentTitle: `Vaccine_Stats_${new Date().toISOString().split('T')[0]}`,
    });

    return (
        <div className="space-y-6 animate-in fade-in pb-20">
            
            {/* Filters & Controls */}
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 space-y-4 no-print">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="relative md:col-span-2">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4"/>
                        <input placeholder="بحث بالاسم أو الكود..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pr-9 pl-4 py-2 rounded-xl border bg-gray-50 outline-none text-sm"/>
                    </div>
                    <select value={filterSpecialty} onChange={e => setFilterSpecialty(e.target.value)} className="p-2 rounded-xl border bg-gray-50 outline-none text-sm font-bold">
                        <option value="all">كل التخصصات</option>
                        {Array.from(new Set(employees.map(e => e.specialty))).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="p-2 rounded-xl border bg-gray-50 outline-none text-sm font-bold">
                        <option value="active_only">القوة الفعلية (نشط)</option>
                        <option value="all">الكل</option>
                        <option value="موقوف">موقوف</option>
                        <option value="إجازة">إجازة</option>
                    </select>
                </div>
                
                <div className="flex flex-wrap gap-2 justify-between items-center border-t pt-4">
                    <div className="flex gap-2">
                        <button onClick={() => toggleSort('name')} className="px-3 py-1.5 rounded-lg border text-xs font-bold hover:bg-gray-50 flex items-center gap-1">الاسم <ArrowUpDown className="w-3 h-3"/></button>
                        <button onClick={() => toggleSort('specialty')} className="px-3 py-1.5 rounded-lg border text-xs font-bold hover:bg-gray-50 flex items-center gap-1">التخصص <ArrowUpDown className="w-3 h-3"/></button>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handlePrintStats} className="bg-orange-50 text-orange-600 border border-orange-200 px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-orange-100">
                            <PieChart className="w-4 h-4"/> طباعة الإحصائيات
                        </button>
                        <button onClick={handlePrintTable} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-blue-700">
                            <Printer className="w-4 h-4"/> طباعة الجدول
                        </button>
                    </div>
                </div>
            </div>

            {/* --- Table View (Printable) --- */}
            <div ref={componentRef} className="bg-white rounded-3xl border shadow-sm p-6 overflow-hidden print:p-0 print:border-none print:shadow-none" dir="rtl">
                <div className="hidden print:block text-center mb-4 border-b-2 border-black pb-2">
                    <p className="text-[12px] font-bold font-mono text-black">
                        مركز غرب المطار - بيان تطعيمات الالتهاب الكبدي الوبائي (B) - تحريراً في: {new Date().toLocaleDateString('ar-EG')}
                    </p>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right border-collapse">
                        <thead className="bg-gray-100 font-bold border-b-2 border-black text-gray-700">
                            <tr>
                                <th className="p-2 border border-gray-400 w-8">م</th>
                                <th className="p-2 border border-gray-400">الاسم</th>
                                <th className="p-2 border border-gray-400 w-24">التخصص</th>
                                <th className="p-2 border border-gray-400 w-24 text-center">الجرعة 1</th>
                                <th className="p-2 border border-gray-400 w-24 text-center">الجرعة 2</th>
                                <th className="p-2 border border-gray-400 w-24 text-center">الجرعة 3</th>
                                <th className="p-2 border border-gray-400 w-32">المكان</th>
                                <th className="p-2 border border-gray-400 w-10 text-center no-print">إجراء</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {isLoading ? <tr><td colSpan={8} className="p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto"/></td></tr> :
                             filteredData.map((emp, idx) => (
                                <tr key={emp.id} className={`border-b border-gray-300 ${editingId === emp.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                                    <td className="p-2 border border-gray-300 text-center">{idx + 1}</td>
                                    <td className="p-2 border border-gray-300 font-bold">{emp.name}</td>
                                    <td className="p-2 border border-gray-300 text-xs">{emp.specialty}</td>
                                    
                                    {editingId === emp.id ? (
                                        <>
                                            <td className="p-1 border border-gray-300"><input type="date" className="w-full p-1 border rounded text-xs" value={tempData.hep_b_dose1 || ''} onChange={e => setTempData({...tempData, hep_b_dose1: e.target.value})} /></td>
                                            <td className="p-1 border border-gray-300"><input type="date" className="w-full p-1 border rounded text-xs" value={tempData.hep_b_dose2 || ''} onChange={e => setTempData({...tempData, hep_b_dose2: e.target.value})} /></td>
                                            <td className="p-1 border border-gray-300"><input type="date" className="w-full p-1 border rounded text-xs" value={tempData.hep_b_dose3 || ''} onChange={e => setTempData({...tempData, hep_b_dose3: e.target.value})} /></td>
                                            <td className="p-1 border border-gray-300"><input type="text" className="w-full p-1 border rounded text-xs" value={tempData.hep_b_location || ''} onChange={e => setTempData({...tempData, hep_b_location: e.target.value})} /></td>
                                            <td className="p-1 border border-gray-300 text-center no-print">
                                                <button onClick={() => updateMutation.mutate({ id: emp.id, data: tempData })} className="bg-green-600 text-white p-1.5 rounded hover:bg-green-700">
                                                    <Save className="w-4 h-4"/>
                                                </button>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="p-2 border border-gray-300 text-center font-mono text-xs">{emp.hep_b_dose1 || '-'}</td>
                                            <td className="p-2 border border-gray-300 text-center font-mono text-xs">{emp.hep_b_dose2 || '-'}</td>
                                            <td className="p-2 border border-gray-300 text-center font-mono text-xs">{emp.hep_b_dose3 || '-'}</td>
                                            <td className="p-2 border border-gray-300 text-xs truncate max-w-[100px]">{emp.hep_b_location || '-'}</td>
                                            <td className="p-2 border border-gray-300 text-center no-print">
                                                <button onClick={() => startEdit(emp)} className="text-blue-600 hover:bg-blue-100 p-1.5 rounded">
                                                    <Syringe className="w-4 h-4"/>
                                                </button>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* --- Statistics Report (Hidden Printable Area) --- */}
            <div className="hidden">
                <div ref={statsRef} className="p-8 dir-rtl text-right" dir="rtl">
                    <div className="text-center border-b-2 border-black pb-4 mb-8">
                        <h1 className="text-2xl font-black">مركز غرب المطار - إدارة مكافحة العدوى</h1>
                        <h2 className="text-lg font-bold mt-2">تقرير إحصائي عن موقف تطعيمات فيروس (B)</h2>
                        <p className="text-sm font-mono mt-2">تحريراً في: {new Date().toLocaleDateString('ar-EG')}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-6 mb-8">
                        <div className="border border-gray-400 p-4 rounded-lg">
                            <h3 className="font-bold border-b border-gray-300 pb-2 mb-2">بيانات القوة</h3>
                            <div className="flex justify-between py-1"><span>إجمالي العاملين (المدرجين):</span> <span className="font-bold">{stats.total}</span></div>
                            <div className="flex justify-between py-1"><span>القوة الفعلية (نشط):</span> <span className="font-bold">{stats.activeForce}</span></div>
                            <div className="flex justify-between py-1"><span>إجازات طويلة/موقوف:</span> <span className="font-bold">{stats.total - stats.activeForce}</span></div>
                        </div>
                        <div className="border border-gray-400 p-4 rounded-lg">
                            <h3 className="font-bold border-b border-gray-300 pb-2 mb-2">موقف التطعيم (من القوة الفعلية)</h3>
                            <div className="flex justify-between py-1"><span>مكتمل (3 جرعات):</span> <span className="font-bold">{stats.d3} ({stats.p3}%)</span></div>
                            <div className="flex justify-between py-1"><span>جرعتين:</span> <span className="font-bold">{stats.d2} ({stats.p2}%)</span></div>
                            <div className="flex justify-between py-1"><span>جرعة واحدة:</span> <span className="font-bold">{stats.d1} ({stats.p1}%)</span></div>
                            <div className="flex justify-between py-1"><span>لم يبدأ/صفر جرعات:</span> <span className="font-bold">{stats.d0} ({stats.p0}%)</span></div>
                            <div className="flex justify-between py-1 text-gray-500"><span>غير مستحق (مناعة):</span> <span className="font-bold">{stats.notEligible}</span></div>
                        </div>
                    </div>

                    <div className="mt-8">
                        <h3 className="font-bold text-lg mb-4 border-r-4 border-red-600 pr-2">قائمة العاملين الواجب تطعيمهم حالياً ({stats.needVaccineList.length})</h3>
                        <table className="w-full text-sm text-right border-collapse">
                            <thead className="bg-gray-100 border-b border-black">
                                <tr>
                                    <th className="p-2 border border-gray-400">م</th>
                                    <th className="p-2 border border-gray-400">الاسم</th>
                                    <th className="p-2 border border-gray-400">التخصص</th>
                                    <th className="p-2 border border-gray-400">الموقف الحالي</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.needVaccineList.map((emp, idx) => (
                                    <tr key={emp.id} className="border-b border-gray-300">
                                        <td className="p-2 border border-gray-300 text-center">{idx + 1}</td>
                                        <td className="p-2 border border-gray-300 font-bold">{emp.name}</td>
                                        <td className="p-2 border border-gray-300">{emp.specialty}</td>
                                        <td className="p-2 border border-gray-300">
                                            {!emp.hep_b_dose1 ? 'لم يبدأ (0 جرعات)' : !emp.hep_b_dose2 ? 'أخذ جرعة واحدة' : 'أخذ جرعتين'}
                                        </td>
                                    </tr>
                                ))}
                                {stats.needVaccineList.length === 0 && <tr><td colSpan={4} className="p-4 text-center">لا يوجد متأخرين عن التطعيم</td></tr>}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-between mt-16 px-10 font-bold text-sm">
                        <div className="text-center">
                            <p>مسؤول مكافحة العدوى</p>
                            <p className="mt-8 text-gray-300">....................</p>
                        </div>
                        <div className="text-center">
                            <p>مدير المركز</p>
                            <p className="mt-8 text-gray-300">....................</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
