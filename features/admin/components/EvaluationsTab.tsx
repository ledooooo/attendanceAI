import React, { useState, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import { Input, Select } from '../../../components/ui/FormElements';
import { ExcelUploadButton } from '../../../components/ui/ExcelUploadButton';
import { Award } from 'lucide-react';

export default function EvaluationsTab({ employees }: { employees: Employee[] }) {
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
    const [evalData, setEvalData] = useState({ employee_id: '', scores: { s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, s6: 0, s7: 0 }, notes: '' });
    const total = useMemo(() => Object.values(evalData.scores).reduce((a,b)=>Number(a)+Number(b), 0), [evalData.scores]);

    const handleSave = async () => {
        if(!evalData.employee_id) return alert('برجاء اختيار الموظف');
        const { data: existing } = await supabase.from('evaluations').select('id').eq('employee_id', evalData.employee_id).eq('month', month).maybeSingle();
        const payload = {
            employee_id: evalData.employee_id, month, score_appearance: evalData.scores.s1, score_attendance: evalData.scores.s2, score_quality: evalData.scores.s3, score_infection: evalData.scores.s4, score_training: evalData.scores.s5, score_records: evalData.scores.s6, score_tasks: evalData.scores.s7, total_score: total, notes: evalData.notes
        };
        if (existing) {
             await supabase.from('evaluations').update(payload).eq('id', existing.id);
             alert('تم تحديث التقييم');
        } else {
            await supabase.from('evaluations').insert([payload]);
            alert('تم حفظ التقييم');
        }
        setEvalData({ employee_id: '', scores: {s1:0,s2:0,s3:0,s4:0,s5:0,s6:0,s7:0}, notes: '' });
    };

    const handleExcelImport = async (data: any[]) => {
        try {
            const cleanData = [];
            const processed = new Set();
            let duplicates = 0;

            for (const row of data) {
                const eid = String(row.employee_id || row['الكود'] || row['ID'] || '').trim();
                const mon = String(row.month || row['الشهر'] || month).trim(); 
                
                if (!eid) continue;

                const key = `${eid}|${mon}`;
                if(processed.has(key)) { duplicates++; continue; }
                processed.add(key);

                const s1 = Number(row.s1 || row['المظهر'] || 0);
                const s2 = Number(row.s2 || row['الحضور'] || 0);
                const s3 = Number(row.s3 || row['الجودة'] || 0);
                const s4 = Number(row.s4 || row['العدوى'] || 0);
                const s5 = Number(row.s5 || row['التدريب'] || 0);
                const s6 = Number(row.s6 || row['الملفات'] || 0);
                const s7 = Number(row.s7 || row['المهام'] || 0);
                const totalRow = s1 + s2 + s3 + s4 + s5 + s6 + s7;

                cleanData.push({
                    employee_id: eid, month: mon, s1, s2, s3, s4, s5, s6, s7,
                    total: totalRow, notes: String(row.notes || row['ملاحظات'] || '').trim()
                });
            }

            if (cleanData.length === 0) return alert('لا توجد بيانات صالحة');
            const { data: res, error } = await supabase.rpc('process_evaluations_bulk', { payload: cleanData });
            if (error) throw error;
            alert(`تقرير الاستيراد:\n- إضافة: ${res.inserted}\n- تحديث: ${res.updated}\n- تجاهل: ${res.skipped}`);
        } catch (e:any) {
            alert('حدث خطأ: ' + e.message);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center border-b pb-4">
                <h2 className="text-2xl font-black flex items-center gap-2 text-gray-800"><Award className="w-7 h-7 text-purple-600"/> التقييمات الطبية (100 درجة)</h2>
                <ExcelUploadButton onData={handleExcelImport} label="رفع التقييمات (Excel)" />
            </div>
            <div className="bg-gray-50 p-8 rounded-[40px] border shadow-inner space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Select label="اختر الموظف" options={employees.map(e=>({value:e.employee_id, label:e.name}))} value={evalData.employee_id} onChange={(v:any)=>setEvalData({...evalData, employee_id:v})} />
                    <Input label="شهر التقييم" type="month" value={month} onChange={setMonth} />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                    <Input label="المظهر (10)" type="number" value={evalData.scores.s1} onChange={(v:any)=>setEvalData({...evalData, scores: {...evalData.scores, s1:v}})} />
                    <Input label="الحضور (20)" type="number" value={evalData.scores.s2} onChange={(v:any)=>setEvalData({...evalData, scores: {...evalData.scores, s2:v}})} />
                    <Input label="الجودة (10)" type="number" value={evalData.scores.s3} onChange={(v:any)=>setEvalData({...evalData, scores: {...evalData.scores, s3:v}})} />
                    <Input label="العدوى (10)" type="number" value={evalData.scores.s4} onChange={(v:any)=>setEvalData({...evalData, scores: {...evalData.scores, s4:v}})} />
                    <Input label="التدريب (20)" type="number" value={evalData.scores.s5} onChange={(v:any)=>setEvalData({...evalData, scores: {...evalData.scores, s5:v}})} />
                    <Input label="الملفات (20)" type="number" value={evalData.scores.s6} onChange={(v:any)=>setEvalData({...evalData, scores: {...evalData.scores, s6:v}})} />
                    <Input label="المهام (10)" type="number" value={evalData.scores.s7} onChange={(v:any)=>setEvalData({...evalData, scores: {...evalData.scores, s7:v}})} />
                </div>
                <div className="bg-white p-6 rounded-3xl border flex justify-between items-center">
                    <div className="text-2xl font-black text-purple-600">الإجمالي: {total} / 100</div>
                    <button onClick={handleSave} className="bg-blue-600 text-white px-10 py-3 rounded-2xl font-black shadow-lg">حفظ التقييم</button>
                </div>
            </div>
        </div>
    );
}