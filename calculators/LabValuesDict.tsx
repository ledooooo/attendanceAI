import React, { useState } from 'react';
import { ArrowRight, Search, Dna, Info } from 'lucide-react';

interface Props { onBack?: () => void; }

export default function LabValuesDict({ onBack }: Props) {
  const [search, setSearch] = useState('');

  const labs = [
    { name: 'Hemoglobin (Hb)', category: 'صورة دم', normal: 'M: 13.5-17.5 | F: 12.0-15.5', unit: 'g/dL' },
    { name: 'WBCs (كرات الدم البيضاء)', category: 'صورة دم', normal: '4,500 - 11,000', unit: 'cells/mcL' },
    { name: 'Platelets (الصفائح)', category: 'صورة دم', normal: '150,000 - 450,000', unit: 'mcL' },
    { name: 'Fasting Glucose (سكر صائم)', category: 'سكري', normal: '70 - 99', unit: 'mg/dL' },
    { name: 'HbA1c (سكر تراكمي)', category: 'سكري', normal: '< 5.7%', unit: '%' },
    { name: 'Creatinine (كرياتينين)', category: 'كلى', normal: 'M: 0.7-1.3 | F: 0.6-1.1', unit: 'mg/dL' },
    { name: 'ALT (SGPT)', category: 'كبد', normal: '7 - 56', unit: 'U/L' },
    { name: 'AST (SGOT)', category: 'كبد', normal: '8 - 48', unit: 'U/L' },
    { name: 'TSH (الغدة الدرقية)', category: 'هرمونات', normal: '0.4 - 4.0', unit: 'mIU/L' },
    { name: 'Vitamin D', category: 'فيتامينات', normal: '30 - 100', unit: 'ng/mL' },
    { name: 'Cholesterol Total', category: 'دهون', normal: '< 200', unit: 'mg/dL' },
    { name: 'Triglycerides (دهون ثلاثية)', category: 'دهون', normal: '< 150', unit: 'mg/dL' },
    { name: 'Uric Acid (نقرص)', category: 'كلى', normal: 'M: 3.4-7.0 | F: 2.4-6.0', unit: 'mg/dL' },
  ];

  const filteredLabs = labs.filter(l => l.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center gap-3 mb-6">
        {onBack && (
          <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50 transition-colors">
            <ArrowRight className="w-5 h-5 text-gray-600" />
          </button>
        )}
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl"><Dna className="w-5 h-5" /></div>
          <h2 className="text-xl font-black text-gray-800">القيم الطبيعية للتحاليل</h2>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
        <div className="relative mb-6">
          <Search className="absolute right-4 top-3.5 text-gray-400 w-5 h-5"/>
          <input 
            type="text" 
            placeholder="ابحث بالاسم (مثال: Hb, TSH...)" 
            value={search}
            onChange={e=>setSearch(e.target.value)}
            className="w-full pr-11 pl-4 py-3 border border-gray-200 bg-gray-50 rounded-xl outline-none focus:bg-white focus:border-indigo-500 transition-all text-gray-700 dir-ltr text-right placeholder:text-right font-bold"
          />
        </div>

        <div className="space-y-3 max-h-[50vh] overflow-y-auto custom-scrollbar pr-1">
          {filteredLabs.length > 0 ? (
            filteredLabs.map((lab, i) => (
              <div key={i} className="p-4 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <div className="bg-indigo-100 p-1.5 rounded-lg"><Dna className="w-4 h-4 text-indigo-600"/></div>
                    <h3 className="font-bold text-gray-800 dir-ltr text-sm">{lab.name}</h3>
                  </div>
                  <span className="text-[9px] font-bold bg-gray-100 px-2 py-1 rounded-md text-gray-500">{lab.category}</span>
                </div>
                <div className="flex justify-between items-end border-t border-gray-50 pt-3 mt-2">
                  <div>
                    <p className="text-[10px] text-gray-400 mb-0.5 font-bold">المعدل الطبيعي</p>
                    <p className="font-black text-indigo-700 dir-ltr text-sm">{lab.normal}</p>
                  </div>
                  <p className="text-[10px] font-mono text-gray-400 font-bold bg-gray-50 px-2 py-1 rounded">{lab.unit}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-10 text-gray-400 font-bold text-sm">لا توجد نتائج مطابقة</div>
          )}
        </div>

        <div className="bg-yellow-50 p-3 rounded-xl mt-6 flex gap-2 text-yellow-800 text-[10px] font-bold leading-relaxed border border-yellow-100">
           <Info className="w-5 h-5 shrink-0"/>
           <p>تختلف القيم الطبيعية قليلاً من معمل لآخر حسب الأجهزة المستخدمة. يرجى دائماً مقارنة النتيجة بـ "Reference Range" المكتوب في ورقة التحليل.</p>
        </div>
      </div>
    </div>
  );
}
