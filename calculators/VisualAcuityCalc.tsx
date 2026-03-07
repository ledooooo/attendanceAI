import React, { useState } from 'react';
import { Eye, ArrowRight, BookOpen, Info } from 'lucide-react';

interface Props { onBack?: () => void; }

export default function VisualAcuityCalc({ onBack }: Props) {
  const [value, setValue] = useState('6/6');

  const conversions: any = {
    '6/6': { snellen: '20/20', decimal: '1.0', logmar: '0.0', desc: 'إبصار طبيعي ممتاز' },
    '6/9': { snellen: '20/30', decimal: '0.66', logmar: '0.18', desc: 'إبصار جيد جداً' },
    '6/12': { snellen: '20/40', decimal: '0.5', logmar: '0.3', desc: 'ضعف إبصار بسيط' },
    '6/18': { snellen: '20/60', decimal: '0.33', logmar: '0.48', desc: 'ضعف إبصار متوسط' },
    '6/24': { snellen: '20/80', decimal: '0.25', logmar: '0.6', desc: 'ضعف إبصار ملحوظ' },
    '6/36': { snellen: '20/120', decimal: '0.16', logmar: '0.78', desc: 'ضعف إبصار شديد' },
    '6/60': { snellen: '20/200', decimal: '0.1', logmar: '1.0', desc: 'كفيف طبقاً للمقاييس القانونية' },
  };

  const current = conversions[value];

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 pb-10 px-1 text-right" dir="rtl">
      <div className="flex items-center gap-3 mb-4">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border"><ArrowRight className="w-5 h-5 text-gray-600" /></button>}
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl"><Eye className="w-5 h-5" /></div>
          <h2 className="text-lg font-black text-gray-800">تحويل حدة الإبصار</h2>
        </div>
      </div>

      <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 mb-4 text-[11px] text-blue-800 leading-relaxed font-bold">
        <p className="flex items-center gap-1.5 mb-1"><BookOpen className="w-4 h-4"/> المصدر المعتمد:</p>
        American Academy of Ophthalmology (AAO) - التحويل بين أنظمة Snellen و LogMAR.
      </div>

      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
        <label className="text-xs font-black text-gray-500 mb-2 block">اختر القياس الحالي (النظام المتري 6/6):</label>
        <select 
          value={value} 
          onChange={(e) => setValue(e.target.value)}
          className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl font-black text-lg outline-none focus:border-indigo-500 transition-all mb-6"
        >
          {Object.keys(conversions).map(key => <option key={key} value={key}>{key}</option>)}
        </select>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 text-center">
            <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Snellen (20ft)</p>
            <p className="text-xl font-black text-indigo-600">{current.snellen}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 text-center">
            <p className="text-[9px] font-black text-gray-400 uppercase mb-1">LogMAR</p>
            <p className="text-xl font-black text-indigo-600">{current.logmar}</p>
          </div>
          <div className="col-span-2 bg-indigo-50 p-4 rounded-2xl border border-indigo-100 text-center">
            <p className="text-[10px] font-black text-indigo-700 mb-1">التقييم السريري</p>
            <p className="text-sm font-black text-gray-800">{current.desc}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
