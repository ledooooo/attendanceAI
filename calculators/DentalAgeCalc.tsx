import React, { useState } from 'react';
import { Baby, ArrowRight, Info } from 'lucide-react';

interface Props { onBack?: () => void; }

export default function DentalAgeCalc({ onBack }: Props) {
  const [selectedTooth, setSelectedTooth] = useState('');

  const teethData: any = {
    'incisor_lower': { age: '6-7 سنوات', name: 'القواطع السفلية الدائمة' },
    'incisor_upper': { age: '7-8 سنوات', name: 'القواطع العلوية الدائمة' },
    'molar_first': { age: '6-7 سنوات', name: 'الضرس الأول الدائم (6 years molar)' },
    'canine': { age: '9-12 سنة', name: 'الأنياب الدائمة' },
    'molar_second': { age: '11-13 سنة', name: 'الضرس الثاني الدائم' }
  };

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 pb-10">
      <div className="flex items-center gap-3 mb-4">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border border-gray-100"><ArrowRight className="w-5 h-5 text-gray-600" /></button>}
        <h2 className="text-lg font-black text-gray-800 flex items-center gap-2"><Baby className="text-sky-500"/> تقدير العمر السني</h2>
      </div>

      <div className="bg-white p-6 rounded-[2rem] shadow-sm border space-y-4">
        <p className="text-xs font-bold text-gray-500">اختر أحدث سن دائم بَزغ (Erupted) في فم الطفل:</p>
        <div className="space-y-2">
          {Object.entries(teethData).map(([key, data]: any) => (
            <button key={key} onClick={()=>setSelectedTooth(key)} className={`w-full text-right p-3 rounded-xl border-2 font-bold text-xs transition-all ${selectedTooth === key ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-gray-50 hover:bg-gray-50'}`}>
              {data.name}
            </button>
          ))}
        </div>

        {selectedTooth && (
          <div className="mt-4 p-5 bg-sky-50 rounded-2xl border border-sky-100 text-center animate-bounce-short">
            <p className="text-[10px] font-black text-sky-600 uppercase mb-1">العمر التقديري للطفل</p>
            <div className="text-2xl font-black text-gray-800">{teethData[selectedTooth].age}</div>
          </div>
        )}
      </div>
    </div>
  );
}
