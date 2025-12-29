import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Evaluation, Employee } from '../../../types';
import { Input, Select } from '../../../components/ui/FormElements';
import { ExcelUploadButton } from '../../../components/ui/ExcelUploadButton';
import * as XLSX from 'xlsx';
import { 
  Award, Download, Search, TrendingUp, AlertCircle, 
  CheckCircle2, XCircle, Trash2, Edit 
} from 'lucide-react';

export default function EvaluationsTab({ employees }: { employees: Employee[] }) {
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // فلاتر
  const [fMonth, setFMonth] = useState(new Date().toISOString().slice(0, 7));
  const [fEmployee, setFEmployee] = useState('');

  useEffect(() => {
    fetchData();
  }, [fMonth]); // إعادة الجلب عند تغيير الشهر

  const fetchData = async () => {
    setLoading(true);
    // جلب التقييمات للشهر المحدد (أو الكل اذا اردت)
    // هنا نجلب للشهر المحدد لتخفيف الحمل، او يمكن جلب فترة اوسع
    const { data } = await supabase
      .from('evaluations')
      .select('*, employees(name, specialty)')
      .ilike('month', `${fMonth}%`) // فلترة بالشهر المختار
      .order('total_score', { ascending: false });

    if (data) {
      setEvaluations(data.map(e => ({
        ...e,
        employee_name: e.employees?.name || 'غير معروف',
        employee_specialty: e.employees?.specialty || '-'
      })));
    }
    setLoading(false);
  };

  // --- 1. تحميل نموذج العينة ---
  const handleDownloadSample = () => {
    const sampleData = [
      {
        'كود الموظف': '101',
        'الشهر': '2023-10',
        'المظهر العام': 10,
        'الحضور': 10,
        'الجودة': 10,
        'مكافحة العدوى': 10,
        'التدريب': 10,
        'الملفات الطبية': 10,
        'أداء الأعمال': 40,
        'ملاحظات': 'أداء ممتاز'
      },
      {
        'كود الموظف': '102',
        'الشهر': '2023-10',
        'المظهر العام': 8,
        'الحضور': 9,
        'الجودة': 8,
        'مكافحة العدوى': 9,
        'التدريب': 8,
        'الملفات الطبية': 9,
        'أداء الأعمال': 35,
        'ملاحظات': 'يحتاج تحسين في الجودة'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Evaluations");
    XLSX.writeFile(wb, "نموذج_التقييمات_الطبية.xlsx");
  };

  // --- 2. معالجة الرفع الذكي ---
  const handleExcelImport = async (data: any[]) => {
    setIsProcessing(true);
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    try {
        // جلب التقييمات الموجودة حالياً للمقارنة (لشهر الملف أو الكل)
        // للأمان نجلب الكل أو نعتمد على Upsert، هنا سنجلب الكل للمقارنة الدقيقة
        const { data: currentEvals } = await supabase.from('evaluations').select('*');
        const dbEvals = currentEvals || [];

        const rowsToUpsert: any[] = [];
        const processedKeys = new Set(); // لمنع تكرار نفس الموظف+الشهر في نفس الملف

        for (const row of data) {
            // قراءة البيانات
            const empId = String(row['كود الموظف'] || row.employee_id || '').trim();
            const month = String(row['الشهر'] || row.month || '').trim(); // صيغة YYYY-MM

            if (!empId || !month) continue;

            // مفتاح فريد
            const rowKey = `${empId}_${month}`;
            if (processedKeys.has(rowKey)) continue;
            processedKeys.add(rowKey);

            // استخراج الدرجات (مع قيمة افتراضية 0)
            const s1 = Number(row['المظهر العام'] || row.score_appearance) || 0;
            const s2 = Number(row['الحضور'] || row.score_attendance) || 0;
            const s3 = Number(row['الجودة'] || row.score_quality) || 0;
            const s4 = Number(row['مكافحة العدوى'] || row.score_infection) || 0;
            const s5 = Number(row['التدريب'] || row.score_training) || 0;
            const s6 = Number(row['الملفات الطبية'] || row.score_records) || 0;
            const s7 = Number(row['أداء الأعمال'] || row.score_tasks) || 0;
            
            // حساب المجموع تلقائياً
            const total = s1 + s2 + s3 + s4 + s5 + s6 + s7;
            const year = parseInt(month.split('-')[0]) || new Date().getFullYear();

            const payload = {
                employee_id: empId,
                month: month,
                year: year,
                score_appearance: s1,
                score_attendance: s2,
                score_quality: s3,
                score_infection: s4,
                score_training: s5,
                score_records: s6,
                score_tasks: s7,
                total_score: total,
                notes: String(row['ملاحظات'] || row.notes || '').trim()
            };

            // البحث عن سجل موجود
            const existingRecord = dbEvals.find(e => e.employee_id === empId && e.month === month);

            if (existingRecord) {
                // هل هناك تغيير؟
                const isChanged = 
                    existingRecord.score_appearance !== payload.score_appearance ||
                    existingRecord.score_attendance !== payload.score_attendance ||
                    existingRecord.score_quality !== payload.score_quality ||
                    existingRecord.score_infection !== payload.score_infection ||
                    existingRecord.score_training !== payload.score_training ||
                    existingRecord.score_records !== payload.score_records ||
                    existingRecord.score_tasks !== payload.score_tasks ||
                    existingRecord.notes !== payload.notes;

                if (isChanged) {
                    rowsToUpsert.push({ ...payload, id: existingRecord.id });
                    updated++;
                } else {
                    skipped++;
                }
            } else {
                // جديد
                rowsToUpsert.push(payload);
                inserted++;
            }
        }

        if (rowsToUpsert.length > 0) {
            const { error } = await supabase.from('evaluations').upsert(rowsToUpsert);
            if (error) throw error;
        }

        alert(`تقرير المعالجة:\n✅ تم إضافة: ${inserted}\n🔄 تم تحديث: ${updated}\n⏭️ تم تجاهل (متطابق): ${skipped}`);
        fetchData();

    } catch (err: any) {
        console.error(err);
        alert('خطأ في المعالجة: ' + err.message);
    } finally {
        setIsProcessing(false);
    }
  };

  // تصفية للعرض
  const filteredEvals = evaluations.filter(e => 
    (e.employee_name.includes(fEmployee) || e.employee_id.includes(fEmployee))
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center border-b pb-4 gap-4">
            <h2 className="text-2xl font-black flex items-center gap-2 text-gray-800">
                <Award className="w-7 h-7 text-purple-600"/> التقييمات الشهرية
            </h2>
            <div className="flex gap-2">
                <button 
                    onClick={handleDownloadSample} 
                    className="bg-white text-gray-600 border border-gray-200 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-50 hover:text-purple-600 transition-all shadow-sm text-sm"
                >
                    <Download className="w-4 h-4"/> نموذج العينة
                </button>
                <ExcelUploadButton onData={handleExcelImport} label={isProcessing ? "جاري المعالجة..." : "رفع التقييمات"} />
            </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-3xl border border-gray-100 shadow-inner">
            <Input label="بحث (اسم/كود)" value={fEmployee} onChange={setFEmployee} placeholder="اسم الموظف..." />
            <Input type="month" label="شهر التقييم" value={fMonth} onChange={setFMonth} />
            <div className="flex items-center justify-center">
                <div className="text-center">
                    <p className="text-xs text-gray-500 font-bold">متوسط التقييمات</p>
                    <p className="text-2xl font-black text-purple-600">
                        {filteredEvals.length > 0 
                            ? (filteredEvals.reduce((a, b) => a + (b.total_score || 0), 0) / filteredEvals.length).toFixed(1) 
                            : '0'}%
                    </p>
                </div>
            </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto border rounded-[30px] bg-white shadow-sm max-h-[600px] custom-scrollbar">
            <table className="w-full text-sm text-right min-w-[1200px]">
                <thead className="bg-gray-100 font-black border-b sticky top-0 z-10 text-gray-600">
                    <tr>
                        <th className="p-4">الموظف</th>
                        <th className="p-4 text-center">المظهر (10)</th>
                        <th className="p-4 text-center">الحضور (10)</th>
                        <th className="p-4 text-center">الجودة (10)</th>
                        <th className="p-4 text-center">العدوى (10)</th>
                        <th className="p-4 text-center">التدريب (10)</th>
                        <th className="p-4 text-center">الملفات (10)</th>
                        <th className="p-4 text-center">الأعمال (40)</th>
                        <th className="p-4 text-center text-purple-600">الإجمالي</th>
                        <th className="p-4">ملاحظات</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredEvals.map(ev => (
                        <tr key={ev.id} className="border-b hover:bg-purple-50/50 transition-colors">
                            <td className="p-4">
                                <div className="font-bold text-gray-800">{ev.employee_name}</div>
                                <div className="text-xs text-gray-400 font-mono">{ev.employee_id}</div>
                            </td>
                            <td className="p-4 text-center font-mono">{ev.score_appearance}</td>
                            <td className="p-4 text-center font-mono">{ev.score_attendance}</td>
                            <td className="p-4 text-center font-mono">{ev.score_quality}</td>
                            <td className="p-4 text-center font-mono">{ev.score_infection}</td>
                            <td className="p-4 text-center font-mono">{ev.score_training}</td>
                            <td className="p-4 text-center font-mono">{ev.score_records}</td>
                            <td className="p-4 text-center font-mono">{ev.score_tasks}</td>
                            <td className="p-4 text-center">
                                <span className={`px-2 py-1 rounded-lg text-xs font-black ${
                                    ev.total_score >= 90 ? 'bg-green-100 text-green-700' :
                                    ev.total_score >= 75 ? 'bg-blue-100 text-blue-700' :
                                    ev.total_score >= 50 ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-red-100 text-red-700'
                                }`}>
                                    {ev.total_score}%
                                </span>
                            </td>
                            <td className="p-4 text-gray-500 text-xs truncate max-w-[150px]" title={ev.notes}>{ev.notes || '-'}</td>
                        </tr>
                    ))}
                    {filteredEvals.length === 0 && (
                        <tr><td colSpan={10} className="p-8 text-center text-gray-400">لا توجد تقييمات لهذا الشهر</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    </div>
  );
}
