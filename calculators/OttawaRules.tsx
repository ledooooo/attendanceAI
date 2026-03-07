import React, { useState } from 'react';
import { Footprints, ArrowRight, BookOpen, AlertCircle } from 'lucide-react';

interface Props { onBack?: () => void; }

export default function OttawaRules({ onBack }: Props) {
  const [mode, setMode] = useState<'ankle' | 'knee'>('ankle');
  const [checks, setChecks] = useState({ pointTenderness: false, weightBearing: false, age: false });
  const [result, setResult] = useState<string | null>(null);

  const evaluate = () => {
    if (checks.pointTenderness || checks.weightBearing || (mode === 'knee' && checks.age)) {
      setResult('يُنصح بعمل أشعة (X-ray) لوجود احتمالية كسر.');
    } else {
      setResult('لا حاجة للأشعة (X-ray). يمكن الاكتفاء بالرباط والراحة.');
    }
  };

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 pb-10 px-1 text-right" dir="rtl">
      <div className="flex items-center gap-3 mb-4">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border"><ArrowRight className="w-5 h-5" /></button>}
        <div className="flex items-center gap-2">
          <div className="p-2 bg-red-100 text-red-700 rounded-xl"><Footprints className="w-5 h-5" /></div>
          <h2 className="text-lg font-black text-gray-800">قواعد Ottawa للأشعة ⚕️</h2>
        </div>
      </div>

      <div className="bg-white p-5 rounded-[2rem] shadow-sm border space-y-4">
        <div className="flex bg-gray-50 p-1 rounded-xl">
          <button onClick={()=>{setMode('ankle'); setResult(null);}} className={`flex-1 py-2 text-xs font-bold rounded-lg ${mode==='ankle' ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}>إصابة الكاحل</button>
          <button onClick={()=>{setMode('knee'); setResult(null);}} className={`flex-1 py-2 text-xs font-bold rounded-lg ${mode==='knee' ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}>إصابة الركبة</button>
        </div>

        <div className="space-y-3">
           <label className="flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer hover:bg-gray-50 border-gray-50">
             <input type="checkbox" onChange={e=>setChecks({...checks, pointTenderness: e.target.checked})} className="w-5 h-5 accent-red-600"/>
             <span className="text-xs font-bold text-gray-700">{mode === 'ankle' ? 'ألم عند لمس الجزء الخلفي للعظمة (Malleolus)' : 'ألم عند لمس صابونة الركبة أو رأس العظمة (Fibula)'}</span>
           </label>
           <label className="flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer hover:bg-gray-50 border-gray-50">
             <input type="checkbox" onChange={e=>setChecks({...checks, weightBearing: e.target.checked})} className="w-5 h-5 accent-red-600"/>
             <span className="text-xs font-bold text-gray-700">عدم القدرة على المشي 4 خطوات فوراً وفي العيادة</span>
           </label>
           {mode === 'knee' && (
             <label className="flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer hover:bg-gray-50 border-gray-50">
               <input type="checkbox" onChange={e=>setChecks({...checks, age: e.target.checked})} className="w-5 h-5 accent-red-600"/>
               <span className="text-xs font-bold text-gray-700">العمر 55 سنة فأكثر</span>
             </label>
           )}
        </div>

        <button onClick={evaluate} className="w-full bg-gray-800 text-white font-black py-3.5 rounded-xl">اتخاذ القرار</button>

        {result && (
          <div className={`p-4 rounded-2xl border-2 text-center font-black text-xs ${result.includes('لا حاجة') ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            {result}
          </div>
        )}
      </div>
    </div>
  );
}
