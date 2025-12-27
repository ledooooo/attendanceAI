import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import { Input, Select } from '../../../components/ui/FormElements';
import { ExcelUploadButton, downloadSample } from '../../../components/ui/ExcelUploadButton';
import { Calendar, Save, List, Trash2, MapPin, Users, Download } from 'lucide-react';

const DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

// دالة مساعدة لتنسيق التاريخ
const formatDateForDB = (dateInput: any) => {
    if (!dateInput) return null;
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
};

export default function EveningSchedulesTab({ employees, centerName, centerId }: { employees: Employee[], centerName?: string, centerId?: string }) {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedDoctors, setSelectedDoctors] = useState<string[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [viewMonth, setViewMonth] = useState(new Date().toISOString().slice(0, 7));

    // فلاتر البحث
    const [searchName, setSearchName] = useState('');
    const [searchId, setSearchId] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterCenter, setFilterCenter] = useState('all');

    const fetchHistory = async () => {
        const { data } = await supabase.from('evening_schedules').select('*').order('date', { ascending: false });
        if (data) setHistory(data);
    };
    useEffect(() => { fetchHistory(); }, []);

    const handleSave = async () => {
        if (selectedDoctors.length === 0) return alert('برجاء اختيار الموظفين أولاً');
        const { data: existing } = await supabase.from('evening_schedules').select('id, doctors').eq('date', date).maybeSingle();
        if (existing) {
             await supabase.from('evening_schedules').update({ doctors: selectedDoctors }).eq('id', existing.id);
             alert('تم تحديث جدول النوبتجية');
        } else {
            await supabase.from('evening_schedules').insert([{ date, doctors: selectedDoctors }]);
            alert('تم إضافة جدول نوبتجية جديد');
        }
        fetchHistory(); setSelectedDoctors([]); 
    };

    const handleExcelImport = async (data: any[]) => {
        try {
            const cleanData = [];
            const processed = new Set();
            let duplicates = 0;

            for (const row of data) {
                const d = formatDateForDB(row.date || row['التاريخ']);
                if (!d) continue;

                if(processed.has(d)) { duplicates++; continue; }
                processed.add(d);

                const doctors = String(row.doctors || row['الموظفين'] || row['الأطباء'] || '').split(',').map(s => s.trim()).filter(s => s);
                const notes = String(row.notes || row['ملاحظات'] || '').trim();

                cleanData.push({ date: d, doctors, notes });
            }

            if (cleanData.length === 0) return alert('لا توجد بيانات صالحة');

            const { data: res, error } = await supabase.rpc('process_evening_bulk', { payload: cleanData });
            if (error) throw error;

            alert(`تقرير الاستيراد:\n- إضافة: ${res.inserted}\n- تحديث: ${res.updated}\n- تجاهل: ${res.skipped}`);
            fetchHistory();
        } catch (e:any) {
            alert('حدث خطأ: ' + e.message);
        }
    };

    const filteredEmployees = useMemo(() => {
        return employees.filter(e => 
            (e.name.toLowerCase().includes(searchName.toLowerCase())) && 
            (e.employee_id.includes(searchId)) &&
            (filterStatus === 'all' || e.status === filterStatus) &&
            (filterCenter === 'all' || e.center_id === filterCenter)
        );
    }, [employees, searchName, searchId, filterStatus, filterCenter]);
    
    const monthlyHistory = useMemo(() => history.filter(h => h.date.startsWith(viewMonth)), [history, viewMonth]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center border-b pb-4">
                <h2 className="text-2xl font-black flex items-center gap-2 text-gray-800">
                    <Calendar className="w-7 h-7 text-indigo-600"/> جداول النوبتجية المسائية
                </h2>
                <div className="flex gap-2">
                    <button onClick={() => downloadSample('evening_schedule')} className="text-gray-400 p-2" title="تحميل عينة"><Download className="w-5 h-5"/></button>
                    <ExcelUploadButton onData={handleExcelImport} label="رفع جداول" />
                    <button 
                        onClick={() => setShowHistory(!showHistory)} 
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all shadow-sm ${showHistory ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                    >
                        <List className="w-4 h-4" /> الأرشيف
                    </button>
                </div>
            </div>

            {!showHistory ? (
                <div className="bg-gray-50 p-6 rounded-3xl border space-y-6 shadow-inner">
                    <div className="bg-white p-4 rounded-2xl shadow-sm border flex flex-col md:flex-row items-center gap-6">
                        <div className="flex-1 w-full">
                            <Input label="تاريخ النوبتجية" type="date" value={date} onChange={setDate} />
                        </div>
                        <div className="flex-1 w-full text-right">
                            <label className="block text-xs font-black text-gray-400 mb-1">المركز الطبي المستهدف</label>
                            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg font-bold text-gray-800 flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-blue-500" /> {centerName || 'المركز الحالي'}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Input label="بحث بالاسم" value={searchName} onChange={setSearchName} placeholder="أدخل اسم الموظف..." />
                        <Input label="بحث بالكود" value={searchId} onChange={setSearchId} placeholder="أدخل كود الموظف..." />
                        <Select label="حالة العمل" options={['all', 'نشط', 'موقوف', 'إجازة']} value={filterStatus} onChange={setFilterStatus} />
                        <Select label="المركز" options={['all', centerId || 'current']} value={filterCenter} onChange={setFilterCenter} />
                    </div>

                     <div className="space-y-2 text-right">
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">اختر الموظفين لهذه النوبتجية</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-80 overflow-y-auto p-4 bg-white border rounded-2xl shadow-inner border-gray-100">
                            {filteredEmployees.map(emp => (
                                <label 
                                    key={emp.employee_id} 
                                    className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer ${selectedDoctors.includes(emp.name) ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-gray-50 hover:border-indigo-100'}`}
                                >
                                    <input 
                                        type="checkbox" 
                                        checked={selectedDoctors.includes(emp.name)} 
                                        onChange={() => setSelectedDoctors(prev => prev.includes(emp.name) ? prev.filter(n => n !== emp.name) : [...prev, emp.name])} 
                                        className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500" 
                                    />
                                    <div className="flex-1 overflow-hidden">
                                        <p className="font-bold text-sm truncate">{emp.name}</p>
                                        <p className="text-[10px] text-gray-400 font-bold">{emp.employee_id} • {emp.specialty}</p>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black ${emp.status === 'نشط' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{emp.status}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                     <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-4 border-t">
                        <div className="flex items-center gap-3">
                            <div className="bg-indigo-600 text-white p-2 rounded-xl"><Users className="w-5 h-5"/></div>
                            <div className="text-indigo-600 font-black">عدد المختارين: <span className="text-2xl">{selectedDoctors.length}</span></div>
                        </div>
                        <button onClick={handleSave} className="bg-indigo-600 text-white px-12 py-3 rounded-2xl font-black shadow-xl hover:bg-indigo-700 transition-all flex items-center gap-2"><Save className="w-5 h-5" /> اعتماد الجدول</button>
                    </div>
                </div>
            ) : (
                <div className="animate-in slide-in-from-top duration-300 space-y-6">
                    <div className="flex items-center justify-between bg-white p-6 rounded-[30px] border shadow-sm">
                        <h3 className="text-xl font-black flex items-center gap-2 text-indigo-800"><List className="w-6 h-6"/> الأرشيف الشهري للجداول المعتمدة</h3>
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-gray-400">فلترة بالشهر:</span>
                            <input type="month" value={viewMonth} onChange={e => setViewMonth(e.target.value)} className="p-2.5 border rounded-xl bg-gray-50 text-indigo-600 font-black outline-none" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {monthlyHistory.map(sch => (
                            <div key={sch.id} className="p-6 bg-white border border-indigo-50 rounded-[30px] shadow-sm hover:shadow-md transition-all relative group text-right">
                                <div className="absolute top-0 left-0 w-12 h-12 bg-red-50 rounded-br-[30px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={async () => { if(confirm('حذف هذا الجدول نهائياً؟')) { await supabase.from('evening_schedules').delete().eq('id', sch.id); fetchHistory(); } }} className="text-red-500 hover:scale-110"><Trash2 className="w-4 h-4"/></button>
                                </div>
                                <h4 className="font-black text-indigo-600 mb-3 border-b pb-2 flex justify-between">
                                    <span>{sch.date}</span>
                                    <span className="text-[10px] text-gray-400">{DAYS_AR[new Date(sch.date).getDay()]}</span>
                                </h4>
                                <div className="flex flex-wrap gap-1">
                                    {sch.doctors?.map((doc: string, idx: number) => (
                                        <span key={idx} className="bg-gray-50 px-3 py-1 rounded-lg text-[10px] font-bold text-gray-600 border border-gray-100 shadow-sm">{doc}</span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}