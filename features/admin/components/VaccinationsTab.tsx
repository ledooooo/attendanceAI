import React, { useState, useMemo } from 'react';
import { Employee } from '../../../types';
import { Search, Printer, Syringe, CheckCircle2, AlertCircle, XCircle, Filter, ChevronUp, ChevronDown } from 'lucide-react';

export default function VaccinationsTab({ employees }: { employees: Employee[] }) {
    // UI State
    const [searchTerm, setSearchTerm] = useState('');
    const [filterSpecialty, setFilterSpecialty] = useState('all');
    const [filterStatus, setFilterStatus] = useState('نشط'); // الافتراضي: الموظفين النشطين فقط
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

    // استخراج التخصصات الفريدة للقائمة
    const specialties = ['all', ...Array.from(new Set(employees.map(e => e.specialty))).filter(Boolean)];

    // 1. معالجة البيانات (فلترة وترتيب)
    const filteredData = useMemo(() => {
        return employees.filter(emp => {
            const matchSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                (emp.national_id && emp.national_id.includes(searchTerm));
            
            const matchSpec = filterSpecialty === 'all' || emp.specialty === filterSpecialty;
            
            const matchStatus = filterStatus === 'all' || 
                                (filterStatus === 'نشط' ? emp.status === 'نشط' : emp.status !== 'نشط');

            return matchSearch && matchSpec && matchStatus;
        }).sort((a: any, b: any) => {
            if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
            if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [employees, searchTerm, filterSpecialty, filterStatus, sortConfig]);

    // 2. حساب الإحصائيات (للرسم البياني)
    const stats = useMemo(() => {
        const total = filteredData.length;
        let dose0 = 0, dose1 = 0, dose2 = 0, dose3 = 0;

        filteredData.forEach(emp => {
            let count = 0;
            if (emp.hep_b_dose1) count++;
            if (emp.hep_b_dose2) count++;
            if (emp.hep_b_dose3) count++;
            
            if (count === 0) dose0++;
            else if (count === 1) dose1++;
            else if (count === 2) dose2++;
            else if (count === 3) dose3++;
        });

        return { total, dose0, dose1, dose2, dose3 };
    }, [filteredData]);

    // دوال مساعدة
    const handleSort = (key: string) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const getPercentage = (val: number) => stats.total > 0 ? Math.round((val / stats.total) * 100) : 0;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* CSS الطباعة */}
            <style>
                {`
                    @media print {
                        body * { visibility: hidden; }
                        #vaccine-print-area, #vaccine-print-area * { visibility: visible; }
                        #vaccine-print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; }
                        .no-print { display: none !important; }
                        /* تحسين شكل الجدول في الطباعة */
                        table { border-collapse: collapse; width: 100%; direction: rtl; }
                        th, td { border: 1px solid #000; padding: 8px; text-align: right; font-size: 12px; }
                        th { background-color: #f0f0f0 !important; -webkit-print-color-adjust: exact; }
                    }
                `}
            </style>

            {/* 1. قسم الإحصائيات والرسم البياني (لا يطبع) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
                <StatCard label="إجمالي الموظفين" value={stats.total} color="blue" icon={<Syringe/>} />
                <StatCard label="مكتمل التطعيم (3 جرعات)" value={stats.dose3} sub={`${getPercentage(stats.dose3)}%`} color="green" icon={<CheckCircle2/>} />
                <StatCard label="تطعيم جزئي (1-2 جرعة)" value={stats.dose1 + stats.dose2} sub={`${getPercentage(stats.dose1 + stats.dose2)}%`} color="orange" icon={<AlertCircle/>} />
                <StatCard label="لم يتلقى التطعيم" value={stats.dose0} sub={`${getPercentage(stats.dose0)}%`} color="red" icon={<XCircle/>} />
            </div>

            {/* شريط التقدم المرئي (Chart Bar) */}
            <div className="bg-white p-6 rounded-3xl border shadow-sm no-print">
                <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                    <Filter className="w-5 h-5"/> نسب التطعيم الحالية (للفلتر المحدد)
                </h3>
                <div className="h-6 w-full bg-gray-100 rounded-full overflow-hidden flex shadow-inner">
                    <div style={{ width: `${getPercentage(stats.dose3)}%` }} className="h-full bg-green-500 transition-all duration-1000 flex items-center justify-center text-[10px] text-white font-bold" title="3 جرعات">
                        {getPercentage(stats.dose3) > 5 && `${getPercentage(stats.dose3)}%`}
                    </div>
                    <div style={{ width: `${getPercentage(stats.dose2)}%` }} className="h-full bg-blue-400 transition-all duration-1000 flex items-center justify-center text-[10px] text-white font-bold" title="جرعتين">
                        {getPercentage(stats.dose2) > 5 && `${getPercentage(stats.dose2)}%`}
                    </div>
                    <div style={{ width: `${getPercentage(stats.dose1)}%` }} className="h-full bg-orange-400 transition-all duration-1000 flex items-center justify-center text-[10px] text-white font-bold" title="جرعة واحدة">
                        {getPercentage(stats.dose1) > 5 && `${getPercentage(stats.dose1)}%`}
                    </div>
                    <div style={{ width: `${getPercentage(stats.dose0)}%` }} className="h-full bg-red-400 transition-all duration-1000 flex items-center justify-center text-[10px] text-white font-bold" title="صفر جرعات">
                        {getPercentage(stats.dose0) > 5 && `${getPercentage(stats.dose0)}%`}
                    </div>
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-2 px-1 font-bold">
                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-green-500"></div> مكتمل (3)</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-blue-400"></div> جرعتين (2)</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-orange-400"></div> جرعة (1)</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-400"></div> لم يبدأ (0)</div>
                </div>
            </div>

            {/* 2. شريط الأدوات والفلترة (لا يطبع) */}
            <div className="flex flex-col md:flex-row gap-4 bg-gray-50 p-4 rounded-2xl border no-print">
                <div className="relative flex-1">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                        type="text" 
                        placeholder="بحث بالاسم أو الرقم القومي..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pr-10 pl-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                </div>
                <select 
                    value={filterSpecialty} 
                    onChange={(e) => setFilterSpecialty(e.target.value)}
                    className="p-3 rounded-xl border bg-white outline-none font-bold text-gray-700 min-w-[150px]"
                >
                    <option value="all">كل التخصصات</option>
                    {specialties.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select 
                    value={filterStatus} 
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="p-3 rounded-xl border bg-white outline-none font-bold text-gray-700 min-w-[150px]"
                >
                    <option value="all">كل الحالات</option>
                    <option value="نشط">نشط فقط</option>
                    <option value="غير نشط">غير نشط (موقوف/إجازة)</option>
                </select>
                <button 
                    onClick={() => window.print()} 
                    className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 shadow-lg"
                >
                    <Printer className="w-5 h-5"/> طباعة التقرير
                </button>
            </div>

            {/* 3. الجدول (يطبع) */}
            <div id="vaccine-print-area" className="bg-white p-6 rounded-3xl border shadow-sm overflow-hidden min-h-[500px]">
                {/* ترويسة الطباعة فقط */}
                <div className="hidden print:block text-center mb-8 border-b-2 pb-4">
                    <h1 className="text-2xl font-black">سجل تطعيمات الالتهاب الكبدي الفيروسي (B)</h1>
                    <div className="flex justify-between mt-4 px-8 text-sm font-bold">
                        <p>المركز: مركز طب أسرة غرب المطار</p>
                        <p>تاريخ التقرير: {new Date().toLocaleDateString('ar-EG')}</p>
                        <p>عدد الموظفين: {stats.total}</p>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                        <thead className="bg-gray-50 text-gray-700 border-b border-gray-200">
                            <tr>
                                <th onClick={() => handleSort('name')} className="p-4 font-black cursor-pointer hover:bg-gray-100 transition-colors w-[20%]">
                                    <div className="flex items-center gap-1">الاسم {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>)}</div>
                                </th>
                                <th onClick={() => handleSort('specialty')} className="p-4 font-black cursor-pointer hover:bg-gray-100 transition-colors w-[10%]">
                                    <div className="flex items-center gap-1">التخصص {sortConfig.key === 'specialty' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>)}</div>
                                </th>
                                <th className="p-4 font-black w-[12%]">الرقم القومي</th>
                                <th className="p-4 font-black text-center w-[10%]">الجرعة 1</th>
                                <th className="p-4 font-black text-center w-[10%]">الجرعة 2</th>
                                <th className="p-4 font-black text-center w-[10%]">الجرعة 3</th>
                                <th className="p-4 font-black w-[15%]">مكان التطعيم</th>
                                <th className="p-4 font-black w-[13%]">ملاحظات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredData.map((emp) => (
                                <tr key={emp.id} className="hover:bg-blue-50/50 transition-colors group">
                                    <td className="p-3 font-bold text-gray-800">{emp.name}</td>
                                    <td className="p-3 text-gray-600">{emp.specialty}</td>
                                    <td className="p-3 font-mono text-xs">{emp.national_id || '-'}</td>
                                    
                                    <td className="p-3 text-center">
                                        {emp.hep_b_dose1 ? (
                                            <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold block">{emp.hep_b_dose1}</span>
                                        ) : <span className="text-red-300 font-bold text-xl">-</span>}
                                    </td>
                                    <td className="p-3 text-center">
                                        {emp.hep_b_dose2 ? (
                                            <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold block">{emp.hep_b_dose2}</span>
                                        ) : <span className="text-red-300 font-bold text-xl">-</span>}
                                    </td>
                                    <td className="p-3 text-center">
                                        {emp.hep_b_dose3 ? (
                                            <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold block">{emp.hep_b_dose3}</span>
                                        ) : <span className="text-red-300 font-bold text-xl">-</span>}
                                    </td>

                                    <td className="p-3 text-xs text-gray-500">{emp.hep_b_location || '-'}</td>
                                    <td className="p-3 text-xs text-gray-500">{emp.hep_b_notes || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredData.length === 0 && (
                        <div className="text-center p-10 text-gray-400 font-bold">لا يوجد موظفين مطابقين للبحث</div>
                    )}
                </div>
            </div>
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
