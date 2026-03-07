import React, { useState } from 'react';
import { Activity, ArrowRight, BookOpen } from 'lucide-react';

interface Props { onBack?: () => void; }

export default function PeriodontalStaging({ onBack }: Props) {
  const [calcData, setCalcData] = useState({ loss: '1-2', teethLost: '0', complexity: 'shallow' });

  const getStage = () => {
    if (calcData.teethLost !== '0' || calcData.loss === '5+') return { s: 'الرابعة (IV)', d: 'تدهور شديد وفقدان وظيفة الإطباق' };
    if (calcData.loss === '3-4') return { s: 'الثالثة (III)', d: 'فقدان عظمي ملحوظ مع خطر فقدان الأسنان' };
    if (calcData.loss === '1-2' && calcData.complexity === 'shallow') return { s: 'الأولى (I)', d: 'التهاب أولي مع فقدان بسيط للأنسجة' };
    return { s: 'الثانية (II)', d: 'التهاب متوسط' };
  };

  const stage = getStage();

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 pb-10">
      <div className="flex items-center gap-3 mb-4">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border"><ArrowRight className="w-5 h-5" /></button>}
        <div className="flex items-center gap-2 text-red-700">
           <Activity className="w-5 h-5" />
           <h2 className="text-lg font-black text-gray-800">تصنيف أمراض اللثة (AAP)</h2>
        </div>
      </div>

      <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 mb-4 text-[11px] text-blue-800">
        <p className="font-bold flex items-center gap-1.5 mb-1"><BookOpen className="w-4 h-4"/> المرجع:</p>
        American Academy of Periodontology (AAP) Staging & Grading.
      </div>

      <div className="bg-white p-6 rounded-[2rem] shadow-sm border space-y-4">
        <div>
          <label className="text-xs font-black text-gray-500 mb-2 block">فقدان العظام السريري (CAL)</label>
          <select value={calcData.loss} onChange={e=>setCalcData({...calcData, loss: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl font-bold text-sm outline-none">
            <option value="1-2">1 - 2 ملم</option>
            <option value="3-4">3 - 4 ملم</option>
            <option value="5+">5 ملم أو أكثر</option>
          </select>
        </div>
        
        <div className="p-4 rounded-2xl border-2 border-red-50 bg-red-50/30 text-center">
           <p className="text-xs font-bold text-gray-500 mb-1">المرحلة المتوقعة (Stage)</p>
           <div className="text-2xl font-black text-red-600">{stage.s}</div>
           <p className="text-[10px] font-bold text-gray-600 mt-1">{stage.d}</p>
        </div>
      </div>
    </div>
  );
}
