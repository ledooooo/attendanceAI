import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../supabaseClient';
import { Employee } from '../../../../types';
import { Search, Syringe, Printer, Save, Loader2, ArrowUpDown, PieChart as PieIcon, AlertCircle, CheckCircle2, XCircle, Clock, UserPlus, FilterX } from 'lucide-react'; // تم إضافة FilterX و UserPlus
import toast from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// --- ألوان الرسم البياني ---
const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#9CA3AF']; 

export default function StaffVaccineManager() {
    const queryClient = useQueryClient();
    const componentRef = useRef(null);
    const statsRef = useRef(null);

    // --- State ---
    const [search, setSearch] = useState('');
    const [filterSpecialty, setFilterSpecialty] = useState('all');
    const [filterStatus, setFilterStatus] = useState('active_only'); 
    const [showOnlyDue, setShowOnlyDue] = useState(false); // ✅ حالة جديدة للتحكم في عرض المستحقين فقط
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

    // ✅ دالة مساعدة لتحديد الاستحقاق (نفس منطق البروتوكول)
    const isDue = (emp: Employee) => {
        const today = new Date();
        const notes = emp.hep_b_notes ? emp.hep_b_notes.toLowerCase() : '';
        const isExempt = notes.includes('غير مستحق') || notes.includes('مناعة') || notes.includes('أجسام مضادة');
        
        if (isExempt || emp.status !== 'نشط') return false;

        let doses = 0;
        if (emp.hep_b_dose1) doses++;
        if (emp.hep_b_dose2) doses++;
        if (emp.hep_b_dose3) doses++;

        if (doses === 3) return false;
        if (doses === 0) return true;
        
        if (doses === 1 && emp.hep_b_dose1) {
            const d1Date = new Date(emp.hep_b_dose1);
            const diffDays = Math.ceil(Math.abs(today.getTime() - d1Date.getTime()) / (1000 * 60 * 60 * 24));
            return diffDays >= 30;
        }
        
        if (doses === 2 && emp.hep_b_dose1 && emp.hep_b_dose2) {
            const d1Date = new Date(emp.hep_b_dose1);
            const d2Date = new Date(emp.hep_b_dose2);
            const diffFromD1 = Math.ceil(Math.abs(today.getTime() - d1Date.getTime()) / (1000 * 60 * 60 * 24));
            const diffFromD2 = Math.ceil(Math.abs(today.getTime() - d2Date.getTime()) / (1000 * 60 * 60 * 24));
            return diffFromD1 >= 180 && diffFromD2 >= 60;
        }
        return false;
    };

    // --- Processing ---
    const filteredData = useMemo(() => {
        let data = employees.filter(item => {
            const term = search.toLowerCase();
            const matchesSearch = item.name.toLowerCase().includes(term) || item.employee_id.includes(term);
            const matchesSpec = filterSpecialty === 'all' || item.specialty === filterSpecialty;
            
            let matchesStatus = true;
            if (filterStatus === 'active_only') matchesStatus = item.status === 'نشط';
            else if (filterStatus !== 'all') matchesStatus = item.status === filterStatus;

            // ✅ إضافة شرط فلترة المستحقين
            const matchesDue = !showOnlyDue || isDue(item);

            return matchesSearch && matchesSpec && matchesStatus && matchesDue;
        });

        data.sort((a, b) => {
            const valA = a[sortConfig.key] || '';
            const valB = b[sortConfig.key] || '';
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return data;
    }, [employees, search, filterSpecialty, filterStatus, sortConfig, showOnlyDue]); // ✅ أضفنا showOnlyDue للمراقب

    // --- Statistics & Corrected Protocol Logic ---
    const stats = useMemo(() => {
        const today = new Date();
        
        let d3 = 0, d2 = 0, d1 = 0, d0 = 0;
        let notEligible = 0; 
        let dueForVaccineCount = 0; 
        let dueList: Employee[] = [];

        // الحساب يتم دائماً على كل الموظفين لضمان دقة الإحصائيات العلوية
        employees.forEach(emp => {
            const notes = emp.hep_b_notes ? emp.hep_b_notes.toLowerCase() : '';
            const isExempt = notes.includes('غير مستحق') || notes.includes('مناعة') || notes.includes('أجسام مضادة');

            if (isExempt) {
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

                if (emp.status === 'نشط' && isDue(emp)) {
                    dueForVaccineCount++;
                    dueList.push(emp);
                }
            }
        });

        const chartData = [
            { name: 'مكتمل (3 جرعات)', value: d3 },
            { name: 'جرعتين', value: d2 },
            { name: 'جرعة واحدة', value: d1 },
            { name: 'لم يبدأ', value: d0 },
            { name: 'غير مستحق', value: notEligible },
        ].filter(item => item.value > 0);

        return { d3, d2, d1, d0, notEligible, dueForVaccineCount, dueList, chartData };
    }, [employees]);

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
            
            {/* 1. Dashboard Section */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 no-print">
                <div className="flex flex-col lg:flex-row gap-8">
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-4">
                        <StatCard title="إجمالي المسجلين" value={employees.length} icon={<Syringe className="w-5 h-5"/>} color="bg-gray-100 text-gray-700" />
                        <StatCard title="مكتمل (3 جرعات)" value={stats.d3} icon={<CheckCircle2 className="w-5 h-5"/>} color="bg-emerald-50 text-emerald-700" />
                        <StatCard title="جرعتين" value={stats.d2} icon={<Clock className="w-5 h-5"/>} color="bg-blue-50 text-blue-700" />
                        <StatCard title="جرعة واحدة" value={stats.d1} icon={<Clock className="w-5 h-5"/>} color="bg-amber-50 text-amber-700" />
                        <StatCard title="لم يبدأ" value={stats.d0} icon={<XCircle className="w-5 h-5"/>} color="bg-red-50 text-red-700" />
                        <StatCard title="غير مستحق (مناعة)" value={stats.notEligible} icon={<AlertCircle className="w-5 h-5"/>} color="bg-gray-200 text-gray-600" />
                        
                        <div className="col-span-2 md:col-span-3 bg-red-500 text-white rounded-2xl p-4 flex items-center justify-between shadow-lg shadow-red-200 transition-all hover:bg-red-600 cursor-pointer" onClick={() => setShowOnlyDue(!showOnlyDue)}>
                            <div>
                                <h4 className="font-bold text-sm opacity-90">المستحقين للتطعيم اليوم (حسب البروتوكول)</h4>
                                <p className="text-xs opacity-75 mt-1">اضغط لعرض القائمة بالجدول أدناه</p>
                            </div>
                            <div className="text-4xl font-black">{stats.dueForVaccineCount}</div>
                        </div>
                    </div>

                    <div className="w-full lg:w-1/3 h-64 bg-gray-50 rounded-2xl border border-gray-100 p-2 relative">
                        <h4 className="text-center text-xs font-bold text-gray-500 absolute top-2 right-0 left-0">توزيع نسب التطعيم</h4>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.chartData}
                                    cx="50%" cy="50%"
                                    innerRadius={60} outerRadius={80}
                                    paddingAngle={5} dataKey="value"
                                >
                                    {stats.chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* 2. Filters & Controls */}
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
                        
                        {/* ✅ الزر الجديد لعرض المستحقين فقط */}
                        <button 
                            onClick={() => setShowOnlyDue(!showOnlyDue)} 
                            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border-2 
                                ${showOnlyDue 
                                    ? 'bg-red-500 text-white border-red-600 shadow-md ring-2 ring-red-200' 
                                    : 'bg-white text-red-600 border-red-100 hover:bg-red-50'
                                }`}
                        >
                            {showOnlyDue ? <FilterX className="w-4 h-4"/> : <UserPlus className="w-4 h-4"/>}
                            {showOnlyDue ? 'إلغاء فلتر المستحقين' : 'عرض المستحقين حالياً'}
                        </button>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handlePrintStats} className="bg-orange-50 text-orange-600 border border-orange-200 px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-orange-100">
                            <PieIcon className="w-4 h-4"/> طباعة الإحصائيات
                        </button>
                        <button onClick={handlePrintTable} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-blue-700">
                            <Printer className="w-4 h-4"/> طباعة الجدول
                        </button>
                    </div>
                </div>
            </div>

            {/* 3. Table View */}
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
                             filteredData.length === 0 ? <tr><td colSpan={8} className="p-10 text-center text-gray-400 font-bold">لا توجد بيانات مطابقة للبحث أو الفلتر حالياً</td></tr> :
                             filteredData.map((emp, idx) => (
                                <tr key={emp.id} className={`border-b border-gray-300 ${editingId === emp.id ? 'bg-blue-50' : 'hover:bg-gray-50'} ${isDue(emp) && !showOnlyDue ? 'bg-red-50/30' : ''}`}>
                                    <td className="p-2 border border-gray-300 text-center">{idx + 1}</td>
                                    <td className="p-2 border border-gray-300 font-bold flex items-center gap-2">
                                        {emp.name}
                                        {isDue(emp) && <span className="w-2 h-2 bg-red-500 rounded-full no-print shadow-sm shadow-red-200" title="مستحق للتطعيم"></span>}
                                    </td>
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

            {/* 4. Statistics Report (Print Only) */}
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
                            <div className="flex justify-between py-1"><span>إجمالي العاملين المدرجين:</span> <span className="font-bold">{employees.length}</span></div>
                            <div className="flex justify-between py-1"><span>القوة الفعلية (نشط):</span> <span className="font-bold">{employees.filter(e=>e.status==='نشط').length}</span></div>
                        </div>
                        <div className="border border-gray-400 p-4 rounded-lg">
                            <h3 className="font-bold border-b border-gray-300 pb-2 mb-2">موقف التطعيم</h3>
                            <div className="flex justify-between py-1"><span>مكتمل (3 جرعات):</span> <span className="font-bold">{stats.d3}</span></div>
                            <div className="flex justify-between py-1"><span>جرعتين:</span> <span className="font-bold">{stats.d2}</span></div>
                            <div className="flex justify-between py-1"><span>جرعة واحدة:</span> <span className="font-bold">{stats.d1}</span></div>
                            <div className="flex justify-between py-1"><span>لم يبدأ:</span> <span className="font-bold">{stats.d0}</span></div>
                        </div>
                    </div>

                    <div className="mt-8">
                        <h3 className="font-bold text-lg mb-4 border-r-4 border-red-600 pr-2">
                            قائمة المستحقين للتطعيم حالياً ({stats.dueList.length})
                        </h3>
                        {stats.dueList.length > 0 ? (
                            <table className="w-full text-sm text-right border-collapse">
                                <thead className="bg-gray-100 border-b border-black">
                                    <tr>
                                        <th className="p-2 border border-gray-400">م</th>
                                        <th className="p-2 border border-gray-400">الاسم</th>
                                        <th className="p-2 border border-gray-400">التخصص</th>
                                        <th className="p-2 border border-gray-400">الحالة الحالية</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.dueList.map((emp, idx) => (
                                        <tr key={emp.id} className="border-b border-gray-300">
                                            <td className="p-2 border border-gray-300 text-center">{idx + 1}</td>
                                            <td className="p-2 border border-gray-300 font-bold">{emp.name}</td>
                                            <td className="p-2 border border-gray-300">{emp.specialty}</td>
                                            <td className="p-2 border border-gray-300">
                                                {emp.hep_b_dose2 ? 'يحتاج الجرعة الثالثة' : emp.hep_b_dose1 ? 'يحتاج الجرعة الثانية' : 'لم يبدأ بعد'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <p className="text-center p-4 border border-gray-300 rounded bg-green-50 text-green-700">لا يوجد متأخرين حالياً 👏</p>
                        )}
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

const StatCard = ({ title, value, icon, color }: { title: string, value: number, icon: any, color: string }) => (
    <div className={`p-4 rounded-2xl flex items-center justify-between ${color} transition-all hover:scale-105`}>
        <div>
            <p className="text-xs font-bold opacity-70 mb-1">{title}</p>
            <h4 className="text-2xl font-black">{value}</h4>
        </div>
        <div className="bg-white/20 p-2 rounded-full backdrop-blur-sm">
            {icon}
        </div>
    </div>
);
