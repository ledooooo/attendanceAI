import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import { Input, Select } from '../../../components/ui/FormElements';
import { ExcelUploadButton } from '../../../components/ui/ExcelUploadButton';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { 
    CalendarRange, Save, Users, Search, Download, 
    Trash2, CheckCircle2, AlertCircle, Calendar, Loader2
} from 'lucide-react';
// 1. ✅ استيراد React Query
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface DoctorObj {
    id: string;
    name: string;
    code: string;
}

// دوال مساعدة (خارج المكون)
const normalizeString = (str: string) => {
    if (!str) return '';
    const englishDigits = str.replace(/[٠-٩]/g, d => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)]);
    return String(englishDigits).trim().toLowerCase();
};

const formatDateForDB = (val: any): string | null => {
    if (!val) return null;
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val.toISOString().split('T')[0];
    const num = Number(val);
    if (!isNaN(num) && num > 30000 && num < 60000) {
        return new Date(Math.round((num - 25569) * 86400 * 1000)).toISOString().split('T')[0];
    }
    const str = String(val).trim();
    const dmy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    try {
        const d = new Date(str);
        return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
    } catch { return null; }
};

export default function EveningSchedulesTab({ employees }: { employees: Employee[] }) {
    const queryClient = useQueryClient();

    // UI State
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedDoctors, setSelectedDoctors] = useState<DoctorObj[]>([]);
    const [notes, setNotes] = useState('');

    // Filter State
    const [fName, setFName] = useState('');
    const [fId, setFId] = useState('');
    const [fSpec, setFSpec] = useState('all');
    const [fStatus, setFStatus] = useState('نشط');

    // ------------------------------------------------------------------
    // 1. 📥 جلب الجداول (Query)
    // ------------------------------------------------------------------
    const { data: schedules = [], isLoading } = useQuery({
        queryKey: ['evening_schedules_list'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('evening_schedules')
                .select('*')
                .order('date', { ascending: false })
                .limit(60); // آخر 60 يوم
            
            if (error) throw error;
            return data;
        },
        staleTime: 1000 * 60 * 5, // تحديث كل 5 دقائق
    });

    // ------------------------------------------------------------------
    // 2. 🔄 مزامنة النموذج مع التاريخ المختار (Effect dependent on Query Data)
    // ------------------------------------------------------------------
    useEffect(() => {
        const existing = schedules.find((s: any) => s.date === selectedDate);
        if (existing) {
            const mappedDoctors: DoctorObj[] = (existing.doctors || []).map((d: any) => {
                if (typeof d === 'string') {
                    const found = employees.find(e => e.name === d || e.employee_id === d);
                    return found 
                        ? { id: found.id, name: found.name, code: found.employee_id } 
                        : { id: 'unknown', name: d, code: '?' };
                }
                return d;
            });
            
            setSelectedDoctors(mappedDoctors);
            setNotes(existing.notes || '');
        } else {
            setSelectedDoctors([]);
            setNotes('');
        }
    }, [selectedDate, schedules, employees]);

    // ------------------------------------------------------------------
    // 3. 🛠️ العمليات (Mutations)
    // ------------------------------------------------------------------

    // أ) حفظ/تحديث جدول فردي
    const saveMutation = useMutation({
        mutationFn: async () => {
            if (!selectedDate) throw new Error("اختر التاريخ");
            if (selectedDoctors.length === 0) throw new Error("اختر طبيباً واحداً على الأقل");

            const payload = {
                date: selectedDate,
                doctors: selectedDoctors,
                notes: notes
            };

            // التحقق مما إذا كان السجل موجوداً لتحديد ID (للتحديث)
            const existing = schedules.find((s: any) => s.date === selectedDate);
            const finalPayload = existing ? { ...payload, id: existing.id } : payload;

            const { error } = await supabase.from('evening_schedules').upsert(finalPayload);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("تم حفظ الجدول بنجاح ✅");
            queryClient.invalidateQueries({ queryKey: ['evening_schedules_list'] });
        },
        onError: (err: any) => toast.error(err.message)
    });

    // ب) حذف جدول
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('evening_schedules').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("تم حذف الجدول");
            queryClient.invalidateQueries({ queryKey: ['evening_schedules_list'] });
        },
        onError: (err: any) => toast.error(err.message)
    });

    // ج) استيراد من Excel (Complex Mutation)
    const excelMutation = useMutation({
        mutationFn: async (data: any[]) => {
            let inserted = 0, updated = 0, skipped = 0;
            let errors: string[] = [];

            const { data: currentDbSchedules } = await supabase.from('evening_schedules').select('*');
            const dbSchedules = currentDbSchedules || [];
            const rowsToUpsert: any[] = [];
            const processedDates = new Set();

            for (const row of data) {
                // استخراج التاريخ
                const dateKey = Object.keys(row).find(k => k.includes('تاريخ') || k.toLowerCase().includes('date'));
                const dateVal = dateKey ? row[dateKey] : (row['التاريخ'] || row['date'] || row['Date']);
                const date = formatDateForDB(dateVal);
                
                if (!date || processedDates.has(date)) continue;
                processedDates.add(date);

                // استخراج الأطباء
                const inputValues: string[] = [];
                Object.keys(row).forEach(key => {
                    const lowerKey = key.toLowerCase();
                    if (lowerKey.includes('تاريخ') || lowerKey.includes('date') || lowerKey.includes('ملاحظات') || lowerKey.includes('note')) return;
                    
                    const val = row[key];
                    if (val !== undefined && val !== null && String(val).trim() !== '') {
                        inputValues.push(String(val));
                    }
                });
                
                // المطابقة
                const doctorsObjects = inputValues.map(val => {
                    const searchVal = normalizeString(val);
                    const emp = employees.find(e => 
                        normalizeString(e.name) === searchVal || 
                        normalizeString(e.employee_id) === searchVal
                    );
                    if (emp) return { id: emp.id, name: emp.name, code: emp.employee_id };
                    return null; 
                }).filter(Boolean);

                if (doctorsObjects.length === 0 && inputValues.length > 0) {
                     errors.push(`تاريخ ${date}: لم يتم التعرف على: ${inputValues.join(', ')}`);
                }

                const notesKey = Object.keys(row).find(k => k.includes('ملاحظات') || k.toLowerCase().includes('note'));
                const rowNotes = notesKey ? String(row[notesKey]).trim() : '';

                const payload = { date, doctors: doctorsObjects, notes: rowNotes };
                const existingRecord = dbSchedules.find(s => s.date === date);

                if (existingRecord) {
                    const isDiff = JSON.stringify(payload.doctors) !== JSON.stringify(existingRecord.doctors) || 
                                   payload.notes !== existingRecord.notes;
                    
                    if (isDiff) {
                        rowsToUpsert.push({ ...payload, id: existingRecord.id });
                        updated++;
                    } else {
                        skipped++;
                    }
                } else {
                    rowsToUpsert.push(payload);
                    inserted++;
                }
            }

            if (rowsToUpsert.length > 0) {
                const { error } = await supabase.from('evening_schedules').upsert(rowsToUpsert);
                if (error) throw error;
            }

            return { inserted, updated, skipped, errors };
        },
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['evening_schedules_list'] });
            
            let msg = `✅ إضافة: ${res.inserted} | 🔄 تحديث: ${res.updated} | ⏭️ تجاهل: ${res.skipped}`;
            toast.success(msg, { duration: 5000 });
            
            if (res.errors.length > 0) {
                alert(`⚠️ تنبيهات:\n` + res.errors.join('\n'));
            }
        },
        onError: (err: any) => toast.error('فشل الاستيراد: ' + err.message)
    });

    // ------------------------------------------------------------------
    // 4. 🎨 دوال المساعدة والعرض
    // ------------------------------------------------------------------

    const handleDownloadSample = () => {
        const headers = ["التاريخ", "طبيب 1", "طبيب 2", "طبيب 3", "ملاحظات"];
        const data = [
            ["2023-11-01", "101", "د. سارة علي", "", "مثال: كود أو اسم"],
            ["2023-11-02", "د. محمد حسن", "102", "103", ""]
        ];
        const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Schedules");
        XLSX.writeFile(wb, "نموذج_جداول_النوبتجية.xlsx");
    };

    const toggleDoctor = (emp: Employee) => {
        const exists = selectedDoctors.find(d => d.id === emp.id);
        if (exists) {
            setSelectedDoctors(prev => prev.filter(d => d.id !== emp.id));
        } else {
            setSelectedDoctors(prev => [...prev, {
                id: emp.id,
                name: emp.name,
                code: emp.employee_id
            }]);
        }
    };

    const filteredEmployees = employees.filter(e => 
        (e.name.includes(fName)) &&
        (e.employee_id.includes(fId)) &&
        (fSpec === 'all' || e.specialty === fSpec) &&
        (fStatus === 'all' || e.status === fStatus)
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-center border-b pb-4 gap-4">
                <h2 className="text-2xl font-black flex items-center gap-2 text-gray-800">
                    <CalendarRange className="w-7 h-7 text-indigo-600"/> جداول النوبتجية
                </h2>
                <div className="flex gap-2">
                    <button 
                        onClick={handleDownloadSample} 
                        className="bg-white text-gray-600 border border-gray-200 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-50 hover:text-indigo-600 transition-all shadow-sm text-sm"
                    >
                        <Download className="w-4 h-4"/> نموذج العينة
                    </button>
                    <ExcelUploadButton 
                        onData={(data) => excelMutation.mutate(data)} 
                        label={excelMutation.isPending ? "جاري المعالجة..." : "رفع الجدول"} 
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-[30px] border shadow-sm sticky top-4">
                        <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-indigo-600"/> إعداد اليوم
                        </h3>
                        <div className="space-y-4">
                            <Input type="date" label="التاريخ" value={selectedDate} onChange={setSelectedDate} />
                            
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">الأطباء المختارون</label>
                                <div className="min-h-[100px] p-3 bg-indigo-50 rounded-xl border border-indigo-100 flex flex-wrap gap-2 content-start">
                                    {selectedDoctors.length === 0 && <span className="text-gray-400 text-xs w-full text-center py-4">لم يتم اختيار أحد</span>}
                                    {selectedDoctors.map((doc, idx) => (
                                        <span key={idx} className="bg-white text-indigo-700 px-3 py-1.5 rounded-full text-xs font-bold border border-indigo-200 flex items-center gap-2 shadow-sm animate-in zoom-in">
                                            <span>{doc.name}</span>
                                            <span className="bg-indigo-100 text-indigo-800 px-1.5 rounded text-[10px]">{doc.code}</span>
                                            <button onClick={() => setSelectedDoctors(prev => prev.filter(d => d.id !== doc.id))} className="hover:text-red-500 transition-colors"><AlertCircle className="w-3 h-3"/></button>
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">ملاحظات</label>
                                <textarea 
                                    className="w-full p-3 rounded-xl border bg-gray-50 outline-none focus:border-indigo-500 min-h-[80px] text-sm font-medium"
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="ملاحظات النوبتجية..."
                                />
                            </div>

                            <button 
                                onClick={() => saveMutation.mutate()}
                                disabled={saveMutation.isPending}
                                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex justify-center items-center gap-2 disabled:opacity-50"
                            >
                                {saveMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>}
                                اعتماد الجدول
                            </button>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-gray-50 p-4 rounded-3xl border border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-3 shadow-inner">
                        <Input label="الاسم" value={fName} onChange={setFName} placeholder="بحث..." />
                        <Input label="الكود" value={fId} onChange={setFId} placeholder="101..." />
                        <Select label="التخصص" options={['all', ...Array.from(new Set(employees.map(e=>e.specialty)))]} value={fSpec} onChange={setFSpec} />
                        <Select label="الحالة" options={['all', 'نشط', 'موقوف']} value={fStatus} onChange={setFStatus} />
                    </div>

                    <div className="bg-white border rounded-[30px] shadow-sm overflow-hidden h-[500px] flex flex-col">
                        <div className="p-4 border-b bg-gray-50 font-bold text-gray-600 flex justify-between items-center">
                            <span>قائمة الموظفين ({filteredEmployees.length})</span>
                            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">اضغط للاختيار</span>
                        </div>
                        <div className="overflow-y-auto custom-scrollbar p-2 grid grid-cols-1 md:grid-cols-2 gap-2 content-start">
                            {filteredEmployees.map(emp => {
                                const isSelected = selectedDoctors.some(d => d.id === emp.id);
                                return (
                                    <div 
                                        key={emp.id} 
                                        onClick={() => toggleDoctor(emp)}
                                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center gap-3 ${
                                            isSelected 
                                            ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-300' 
                                            : 'bg-white border-gray-100 hover:border-indigo-200 hover:bg-gray-50'
                                        }`}
                                    >
                                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                                            {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white"/>}
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm text-gray-800">{emp.name}</div>
                                            <div className="text-xs text-gray-500 font-mono">{emp.specialty} • {emp.employee_id}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-[30px] border shadow-sm p-6">
                <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
                    <CalendarRange className="w-5 h-5 text-gray-500"/> أرشيف الجداول (آخر 60 يوم)
                </h3>
                {isLoading ? <div className="text-center py-10"><Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500"/></div> : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-right min-w-[600px]">
                            <thead className="bg-gray-100 font-black text-gray-600">
                                <tr>
                                    <th className="p-4 rounded-r-xl">التاريخ</th>
                                    <th className="p-4">طاقم النوبتجية</th>
                                    <th className="p-4">ملاحظات</th>
                                    <th className="p-4 rounded-l-xl w-20"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {schedules.map((sch: any) => (
                                    <tr key={sch.id} className="hover:bg-gray-50 group">
                                        <td className="p-4 font-mono font-bold text-indigo-600">{sch.date}</td>
                                        <td className="p-4">
                                            <div className="flex flex-wrap gap-1">
                                                {sch.doctors && sch.doctors.map((d: any, i: number) => {
                                                    const name = typeof d === 'string' ? d : d.name;
                                                    const code = typeof d === 'object' && d.code ? ` (${d.code})` : '';
                                                    return (
                                                        <span key={i} className="bg-gray-100 px-2 py-1 rounded text-xs font-bold text-gray-700 border border-gray-200">
                                                            {name}{code}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </td>
                                        <td className="p-4 text-gray-500">{sch.notes || '-'}</td>
                                        <td className="p-4 text-center">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => { setSelectedDate(sch.date); window.scrollTo({top:0, behavior:'smooth'}); }}
                                                    className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="تعديل"
                                                >
                                                    <Calendar className="w-4 h-4"/>
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        if(confirm("حذف هذا الجدول؟")) deleteMutation.mutate(sch.id);
                                                    }}
                                                    disabled={deleteMutation.isPending}
                                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="حذف"
                                                >
                                                    {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Trash2 className="w-4 h-4"/>}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
