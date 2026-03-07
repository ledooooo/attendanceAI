import React, { useState } from 'react';
import { Baby, ArrowRight, Brain, Smile, Activity } from 'lucide-react';

interface Props { onBack?: () => void; }

export default function ChildMilestones({ onBack }: Props) {
  const [selectedAge, setSelectedAge] = useState<string | null>(null);

  const milestones = [
    { id: '2m', label: 'شهرين', social: 'يبتسم للناس، يهدأ عند حمله', lang: 'يصدر أصوات (هديل)، يلتفت للأصوات', motor: 'يرفع رأسه عند الاستلقاء على بطنه، يحرك يديه وقدميه بنعومة' },
    { id: '6m', label: '6 شهور', social: 'يعرف الوجوه المألوفة، يحب اللعب مع الآخرين', lang: 'يستجيب للأصوات بإصدار أصوات، ينطق حروف مثل (م، ب)', motor: 'يتقلب في الاتجاهين، يبدأ بالجلوس بدون دعم' },
    { id: '12m', label: 'سنة (12 شهر)', social: 'يخاف من الغرباء، يكرر الأصوات للحصول على الانتباه', lang: 'يقول "ماما" و "بابا"، يفهم "لا"', motor: 'يقف ممسكاً بالأثاث، قد يمشي خطوات قليلة' },
    { id: '18m', label: 'سنة ونصف', social: 'نوبات غضب بسيطة، يلعب "تخيل"', lang: 'يقول عدة كلمات مفردة، يشير لما يريده', motor: 'يمشي بمفرده، يأكل بالملعقة' },
    { id: '24m', label: 'سنتين', social: 'يقلد الآخرين، يلعب بجوار الأطفال (وليس معهم)', lang: 'يكون جملاً من كلمتين (مثل: عايز حليب)', motor: 'يركل الكرة، يصعد السلالم' },
  ];

  const current = milestones.find(m => m.id === selectedAge);

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center gap-3 mb-6">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50"><ArrowRight className="w-5 h-5 text-gray-600" /></button>}
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl"><Baby className="w-5 h-5" /></div>
          <h2 className="text-xl font-black text-gray-800">دليل تطورات الطفل</h2>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-600 text-sm mb-4">اختر عمر الطفل لعرض التطورات المتوقعة:</h3>
        
        <div className="flex flex-wrap gap-2 mb-6">
          {milestones.map(m => (
            <button 
              key={m.id} onClick={() => setSelectedAge(m.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border-2 ${selectedAge === m.id ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm' : 'bg-gray-50 border-transparent text-gray-500 hover:bg-gray-100'}`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {current ? (
          <div className="space-y-3 animate-in slide-in-from-bottom-2">
             <div className="bg-orange-50/50 p-4 rounded-2xl border border-orange-100">
                <h3 className="font-black text-orange-800 mb-2 flex items-center gap-2 text-sm"><Smile className="w-4 h-4"/> التطور الاجتماعي والعاطفي</h3>
                <p className="text-xs text-orange-900 leading-relaxed font-medium">{current.social}</p>
             </div>
             <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                <h3 className="font-black text-blue-800 mb-2 flex items-center gap-2 text-sm"><Brain className="w-4 h-4"/> اللغة والتواصل</h3>
                <p className="text-xs text-blue-900 leading-relaxed font-medium">{current.lang}</p>
             </div>
             <div className="bg-green-50/50 p-4 rounded-2xl border border-green-100">
                <h3 className="font-black text-green-800 mb-2 flex items-center gap-2 text-sm"><Activity className="w-4 h-4"/> الحركة والنمو الجسدي</h3>
                <p className="text-xs text-green-900 leading-relaxed font-medium">{current.motor}</p>
             </div>
          </div>
        ) : (
          <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <Baby className="w-12 h-12 text-gray-300 mx-auto mb-2"/>
            <p className="text-xs text-gray-500 font-bold">اختر عمراً من الأعلى لعرض التفاصيل</p>
          </div>
        )}
      </div>
    </div>
  );
}
