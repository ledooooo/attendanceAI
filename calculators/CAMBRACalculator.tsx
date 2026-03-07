import React, { useState } from 'react';
import { ShieldAlert, ArrowRight, BookOpen, Save, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

interface Props { onBack?: () => void; }

export default function CAMBRACalculator({ onBack }: Props) {
  const [riskFactors, setRiskFactors] = useState({
    cavities: false, // تسوس حديث (آخر 3 سنوات)
    sugar: false,    // استهلاك عالي للسكريات
    dryMouth: false, // جفاف الفم (Hyposalivation)
    exposedRoots: false, // جذور مكشوفة
    ortho: false     // تقويم أسنان
  });
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const calculateRisk = () => {
    const trueCount = Object.values(riskFactors).filter(Boolean).length;
    let level = 'منخفض';
    let color = 'text-green-600';
    let bg = 'bg-green-50 border-green-200';

    if (riskFactors.cavities || trueCount >= 3) {
      level = 'مرتفع جداً'; color = 'text-red-600'; bg = 'bg-red-50 border-red-200';
    } else if (trueCount >= 1) {
      level = 'متوسط'; color = 'text-orange-600'; bg = 'bg-orange-50 border-orange-200';
    }

    setResult({ level, color, bg });
  };

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 pb-10">
      <div className="flex items-center gap-3 mb-4">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border"><ArrowRight className="w-5 h-5 text-gray-600" /></button>}
        <div className="flex items-center gap-2">
          <div className="p-2 bg-red-100 text-red-700 rounded-xl"><ShieldAlert className="w-5 h-5" /></div>
          <div>
            <h2 className="text-lg font-black text-gray-800">تقييم مخاطر التسوس (CAMBRA)</h2>
            <span className="text-[10px] font-bold bg-red-50 text-red-600 px-2 py-0.5 rounded border border-red-100">للأطباء فقط ⚕️</span>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 mb-4 text-[11px] text-blue-800 leading-relaxed">
        <p className="font-bold flex items-center gap-1.5 mb-1"><BookOpen className="w-4 h-4"/> المصدر المعتمد:</p>
        بروتوكول ADA (American Dental Association) لإدارة التسوس بناءً على تقييم المخاطر.
      </div>

      <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-gray-100 space-y-3">
        {Object.entries({
          cavities: 'وجود تسوس فعال أو حشوات خلال الـ 3 سنوات الماضية',
          sugar: 'استهلاك السكريات/المشروبات الغازية بين الوجبات (أكثر من 3 مرات)',
          dryMouth: 'يعاني المريض من جفاف الفم (أدوية أو إشعاع)',
          exposedRoots: 'وجود جذور أسنان مكشوفة',
          ortho: 'يضع المريض أجهزة تقويم أو أطقم أسنان جزئية'
        }).map(([key, label]) => (
          <label key={key} className="flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors border-gray-100">
            <input 
              type="checkbox" 
              checked={(riskFactors as any)[key]} 
              onChange={(e) => setRiskFactors({...riskFactors, [key]: e.target.checked})}
              className="w-5 h-5 accent-red-600"
            />
            <span className="font-bold text-xs text-gray-700">{label}</span>
          </label>
        ))}
        <button onClick={calculateRisk} className="w-full bg-gray-800 text-white font-black py-3.5 rounded-xl mt-2">تحديد درجة الخطورة</button>
      </div>

      {result && (
        <div className={`mt-6 p-6 rounded-[2rem] border-2 shadow-sm text-center animate-in slide-in-from-bottom-4 ${result.bg}`}>
           <p className="text-gray-500 text-xs font-bold mb-1">تصنيف خطر التسوس</p>
           <div className={`text-4xl font-black mb-2 ${result.color}`}>{result.level}</div>
           <div className="text-[10px] font-bold text-gray-600 bg-white/50 p-2 rounded-lg">يُنصح بوضع خطة وقائية تشمل الفلوريد والمتابعة الدورية.</div>
        </div>
      )}
    </div>
  );
}
