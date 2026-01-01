import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import { Input, Select } from '../../../components/ui/FormElements';
import { ExcelUploadButton } from '../../../components/ui/ExcelUploadButton';
import * as XLSX from 'xlsx';
import { 
  Award, Download, Search, TrendingUp, AlertCircle, 
  CheckCircle2, XCircle, Trash2, Edit, Plus, Save, X 
} from 'lucide-react';

export default function EvaluationsTab({ employees }: { employees: Employee[] }) {
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // فلاتر
  const [fMonth, setFMonth] = useState(new Date().toISOString().slice(0, 7));
  const [fEmployee, setFEmployee] = useState('');

  // حالة النافذة المنبثقة (Modal) للإضافة اليدوية
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
      employee_id: '',
      month: new Date().toISOString().slice(0, 7),
      score_appearance: 0,
      score_attendance: 0,
      score_quality: 0,
      score_infection: 0,
      score_training: 0,
      score_records: 0,
      score_tasks: 0,
      notes: ''
  });

  useEffect(() => {
    fetchData();
  }, [fMonth]); 

  const fetchData = async () => {
    setLoading(true);
    // جلب التقييمات للشهر المحدد
    const { data, error } = await supabase
      .from('evaluations')
      .select('*, employees(name, specialty, employee_id)') // تأكد من جلب employee_id أيضاً من جدول الموظفين للربط
      .ilike('month', `${fMonth}%`)
      .order('total_score', { ascending: false });

    if (error) {
        console.error("Error fetching evaluations:", error);
    }

    if (data) {
      setEvaluations(data.map(e => ({
        ...e,
        // التأكد من وجود البيانات وتوفير قيم افتراضية
        employee_name: e.employees?.name || 'غير معروف',
        employee_specialty: e.employees?.specialty || '-',
        // ضمان أن الأرقام ليست null
        score_appearance: e.score_appearance || 0,
        score_attendance: e.score_attendance || 0,
        score_quality: e.score_quality || 0,
        score_infection: e.score_infection || 0,
        score_training: e.score_training || 0,
        score_records: e.score_records || 0,
        score_tasks: e.score_tasks || 0,
        total_score: e.total_score || 0
      })));
    } else {
        setEvaluations([]);
    }
    setLoading(false);
  };

  const handleDownloadSample = () => {
    const sampleData = [
      {
        'كود الموظف': '101',
        'الشهر': '2023-10',
        'المظهر العام': 10,
        'الحضور': 20,
        'الجودة': 10,
        'مكافحة العدوى': 10,
        'التدريب': 10,
        'الملفات الطبية': 10,
        'أداء الأعمال': 40, // تم تعديل المثال ليتوافق مع المجموع 100 حسب الكود
        'ملاحظات': 'أداء ممتاز'
      }
    ];
    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Evaluations");
    XLSX.writeFile(wb, "نموذج_التقييمات_الطبية.xlsx");
  };

  const handleExcelImport = async (data: any[]) => {
    setIsProcessing(true);
    let inserted = 0, updated = 0, skipped = 0;

    try {
        const { data: currentEvals } = await supabase.from('evaluations').select('*');
        const dbEvals = currentEvals || [];
        const rowsToUpsert: any[] = [];
        const processedKeys = new Set(); 

        for (const row of data) {
            const empId = String(row['كود الموظف'] || row.employee_id || '').trim();
            const month = String(row['الشهر'] || row.month || '').trim(); 
            if (!empId || !month) continue;

            const rowKey = `${empId}_${month}`;
            if (processedKeys.has(rowKey)) continue;
            processedKeys.add(rowKey);

            const s1 = Number(row['المظهر العام'] || row.score_appearance) || 0;
            const s2 = Number(row['الحضور'] || row.score_attendance) || 0;
            const s3 = Number(row['الجودة'] || row.score_quality) || 0;
            const s4 = Number(row['مكافحة العدوى'] || row.score_infection) || 0;
            const s5 = Number(row['التدريب'] || row.score_training) || 0;
            const s6 = Number(row['الملفات الطبية'] || row.score_records) || 0;
            const s7 = Number(row['أداء الأعمال'] || row.score_tasks) || 0;
            
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

            const existingRecord = dbEvals.find(e => e.employee_id === empId && e.month === month);
            if (existingRecord) {
                // التحقق من التغيير لتجنب التحديث غير الضروري
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
        alert('خطأ في المعالجة: ' + err.message);
    } finally {
        setIsProcessing(false);
    }
  };

  // --- دالة حفظ التقييم اليدوي ---
  const handleManualSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.employee_id) return alert("الرجاء اختيار الموظف");

      const total = 
        formData.score_appearance + formData.score_attendance + 
        formData.score_quality + formData.score_infection + 
        formData.score_training + formData.score_records + 
        formData.score_tasks;

      const year = parseInt(formData.month.split('-')[0]) || new Date().getFullYear();

      const payload = {
          ...formData,
          year: year,
          total_score: total
      };

      try {
          // التحقق أولاً للحصول على الـ ID في حالة التحديث
          const { data: existing } = await supabase.from('evaluations')
            .select('id')
            .eq('employee_id', formData.employee_id)
            .eq('month', formData.month)
            .maybeSingle();

          const finalPayload = existing ? { ...payload, id: existing.id } : payload;
          
          const { error } = await supabase.from('evaluations').upsert(finalPayload);

          if (error) throw error;
          
          alert("تم حفظ التقييم بنجاح");
          setShowModal(false);
          fetchData();
          // تصفير النموذج
          setFormData({
            employee_id: '',
            month: new Date().toISOString().slice(0, 7),
            score_appearance: 0, score_attendance: 0, score_quality: 0, score_infection: 0,
            score_training: 0, score_records: 0, score_tasks: 0, notes: ''
          });

      } catch (err: any) {
          alert("خطأ في الحفظ: " + err.message);
      }
  };

  // دالة لحذف التقييم
  const handleDelete = async (id: string) => {
      if (!confirm("هل أنت متأكد من حذف هذا التقييم؟")) return;
      
      const { error } = await supabase.from('evaluations').delete().eq('id', id);
      if (error) {
          alert("خطأ في الحذف: " + error.message);
      } else {
          fetchData();
      }
  };

  // تصفية للعرض
  const filteredEvals = evaluations.filter(e => 
    (e.employee_name.toLowerCase().includes(fEmployee.toLowerCase()) || e.employee_id.includes(fEmployee))
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 relative">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center border-b pb-4 gap-4">
            <h2 className="text-2xl font-black flex items-center gap-2 text-gray-800">
                <Award className="w-7 h-7 text-purple-600"/> التقييمات الشهرية
            </h2>
            <div className="flex gap-2">
                <button 
                    onClick={() => setShowModal(true)}
                    className="bg-purple-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-purple-700 transition-all shadow-sm text-sm"
                >
                    <Plus className="w-4 h-4"/> إضافة تقييم
                </button>
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
                        <th className="p-4 text-center">إجراءات</th> {/* عمود جديد للحذف والتعديل */}
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
                            <td className="p-4 flex justify-center gap-2">
                                <button 
                                    onClick={() => {
                                        setFormData({
                                            employee_id: ev.employee_id,
                                            month: ev.month,
                                            score_appearance: ev.score_appearance,
                                            score_attendance: ev.score_attendance,
                                            score_quality: ev.score_quality,
                                            score_infection: ev.score_infection,
                                            score_training: ev.score_training,
                                            score_records: ev.score_records,
                                            score_tasks: ev.score_tasks,
                                            notes: ev.notes || ''
                                        });
                                        setShowModal(true);
                                    }}
                                    className="text-blue-500 hover:text-blue-700 p-1"
                                    title="تعديل"
                                >
                                    <Edit className="w-4 h-4"/>
                                </button>
                                <button 
                                    onClick={() => handleDelete(ev.id)} 
                                    className="text-red-500 hover:text-red-700 p-1"
                                    title="حذف"
                                >
                                    <Trash2 className="w-4 h-4"/>
                                </button>
                            </td>
                        </tr>
                    ))}
                    {filteredEvals.length === 0 && (
                        <tr><td colSpan={11} className="p-8 text-center text-gray-400">لا توجد تقييمات لهذا الشهر</td></tr>
                    )}
                </tbody>
            </table>
        </div>

        {/* --- Modal إضافة تقييم يدوي --- */}
        {showModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-300">
                    <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                        <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                            <Plus className="w-5 h-5 text-purple-600"/> تسجيل تقييم جديد
                        </h3>
                        <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-red-500">
                            <X className="w-6 h-6"/>
                        </button>
                    </div>
                    
                    <form onSubmit={handleManualSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">الموظف</label>
                                <select 
                                    className="w-full p-3 rounded-xl border bg-gray-50 outline-none focus:border-purple-500 font-bold text-sm"
                                    value={formData.employee_id}
                                    onChange={e => setFormData({...formData, employee_id: e.target.value})}
                                    required
                                >
                                    <option value="">اختر الموظف...</option>
                                    {employees.map(e => (
                                        <option key={e.id} value={e.employee_id}>{e.name} ({e.employee_id})</option>
                                    ))}
                                </select>
                            </div>
                            <Input 
                                type="month" 
                                label="الشهر" 
                                value={formData.month} 
                                onChange={val => setFormData({...formData, month: val})} 
                            />
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-purple-50 p-4 rounded-2xl border border-purple-100">
                            <Input type="number" label="المظهر (10)" value={formData.score_appearance} onChange={v => setFormData({...formData, score_appearance: Number(v)})} min={0} max={10}/>
                            <Input type="number" label="الحضور (10)" value={formData.score_attendance} onChange={v => setFormData({...formData, score_attendance: Number(v)})} min={0} max={10}/>
                            <Input type="number" label="الجودة (10)" value={formData.score_quality} onChange={v => setFormData({...formData, score_quality: Number(v)})} min={0} max={10}/>
                            <Input type="number" label="العدوى (10)" value={formData.score_infection} onChange={v => setFormData({...formData, score_infection: Number(v)})} min={0} max={10}/>
                            <Input type="number" label="التدريب (10)" value={formData.score_training} onChange={v => setFormData({...formData, score_training: Number(v)})} min={0} max={10}/>
                            <Input type="number" label="الملفات (10)" value={formData.score_records} onChange={v => setFormData({...formData, score_records: Number(v)})} min={0} max={10}/>
                            <div className="col-span-2">
                                <Input type="number" label="أداء الأعمال (40)" value={formData.score_tasks} onChange={v => setFormData({...formData, score_tasks: Number(v)})} min={0} max={40}/>
                            </div>
                        </div>

                        <div className="flex items-center justify-between bg-gray-100 p-4 rounded-xl">
                            <span className="font-bold text-gray-600">المجموع الكلي:</span>
                            <span className="text-2xl font-black text-purple-600">
                                {formData.score_appearance + formData.score_attendance + formData.score_quality + formData.score_infection + formData.score_training + formData.score_records + formData.score_tasks} / 100
                            </span>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">ملاحظات</label>
                            <textarea 
                                className="w-full p-3 rounded-xl border bg-gray-50 outline-none focus:border-purple-500 font-medium text-sm min-h-[80px]"
                                value={formData.notes}
                                onChange={e => setFormData({...formData, notes: e.target.value})}
                                placeholder="أي ملاحظات إضافية..."
                            />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors">إلغاء</button>
                            <button type="submit" className="flex-1 py-3 rounded-xl font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-200 transition-all flex justify-center items-center gap-2">
                                <Save className="w-5 h-5"/> حفظ التقييم
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}
    </div>
  );
}
