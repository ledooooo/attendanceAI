import React, { useState } from 'react';
import { AlertCircle, ArrowRight, BookOpen, Search, Info } from 'lucide-react';

interface Props { onBack?: () => void; }

export default function BeersCriteriaList({ onBack }: Props) {
  const [search, setSearch] = useState('');

  const criteria = [
    { drug: 'Amiodarone', reason: 'مخاطر سمية الغدة الدرقية والرئة.', alt: 'Dronedarone (بحذر)' },
    { drug: 'Digoxin', reason: 'زيادة خطر التسمم الرقمي لدى كبار السن.', alt: 'Beta-blockers' },
    { drug: 'Amitriptyline', reason: 'تأثيرات قوية مضادة للكولين (جفاف، إمساك، ارتباك).', alt: 'SSRIs' },
    { drug: 'Diazepam (Valium)', reason: 'فترة نصف عمر طويلة، تزيد خطر السقوط والكسور.', alt: 'Lorazepam (بجرعة أقل)' },
    { drug: 'NSAIDs (مثل Ibuprofen)', reason: 'زيادة خطر قرحة المعدة والفشل الكلوي.', alt: 'Acetaminophen (Paracetamol)' },
    { drug: 'Nitrofurantoin', reason: 'خطر سمية الرئة والكبد (خاصة إذا كانت وظائف الكلى منخفضة).', alt: 'Fosfomycin' },
    { drug: 'Sulfonylureas (مثل Glibenclamide)', reason: 'خطر شديد لحدوث هبوط سكر الدم المستمر.', alt: 'Metformin / DPP-4 inhibitors' }
  ];

  const filtered = criteria.filter(c => c.drug.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 pb-10">
      <div className="flex items-center gap-3 mb-4">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border"><ArrowRight className="w-5 h-5 text-gray-600" /></button>}
        <div className="flex items-center gap-2">
          <div className="p-2 bg-red-100 text-red-700 rounded-xl"><AlertCircle className="w-5 h-5" /></div>
          <div>
            <h2 className="text-lg font-black text-gray-800">معايير Beers للأدوية</h2>
            <span className="text-[10px] font-bold bg-red-50 text-red-600 px-2 py-0.5 rounded border border-red-100">للصيادلة والأطباء فقط ⚕️</span>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 mb-4 text-[11px] text-blue-800 leading-relaxed">
        <p className="font-bold flex items-center gap-1.5 mb-1"><BookOpen className="w-4 h-4"/> المصدر المعتمد:</p>
        American Geriatrics Society (AGS) - أدوية يجب تجنبها أو استخدامها بحذر للمرضى فوق 65 عاماً.
      </div>

      <div className="mb-4 relative">
        <Search className="absolute right-3 top-3 w-4 h-4 text-gray-400" />
        <input 
          type="text" placeholder="ابحث عن اسم المادة الفعالة..." 
          className="w-full pr-10 p-3 bg-white border rounded-xl font-bold text-xs outline-none focus:border-red-500"
          value={search} onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        {filtered.map((item, i) => (
          <div key={i} className="bg-white p-4 rounded-2xl border-2 border-gray-50 shadow-sm">
            <h3 className="text-red-600 font-black text-sm mb-1">{item.drug}</h3>
            <p className="text-[10px] text-gray-600 font-bold mb-2 leading-relaxed">⚠️ السبب: {item.reason}</p>
            <div className="bg-green-50 p-2 rounded-lg text-[9px] font-bold text-green-700">
              ✅ البديل المقترح: {item.alt}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
