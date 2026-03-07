import React, { useState } from 'react';
import { Activity, ArrowRight, BookOpen, Save, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

interface Props { onBack?: () => void; }

export default function ChildPughCalculator({ onBack }: Props) {
  const [data, setData] = useState({ bilirubin: 1, albumin: 1, inr: 1, ascites: 1, enceph: 1 });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const calculate = () => {
    const score = data.bilirubin + data.albumin + data.inr + data.ascites + data.enceph;
    let grade = ''; let color = ''; let survival = '';
    
    if (score <= 6) { grade = 'A'; color = 'text-green-600'; survival = '100% (سنة واحدة)'; }
    else if (score <= 9) { grade = 'B'; color = 'text-orange-600'; survival = '80% (سنة واحدة)'; }
    else { grade = 'C'; color = 'text-red-600'; survival = '45% (سنة واحدة)'; }

    setResult({ score, grade, color, survival });
  };

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 pb-10">
      <div className="flex items-center gap-3 mb-4">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border"><ArrowRight className="w-5 h-5 text-gray-600" /></button>}
        <div className="flex items-center gap-2">
          <div className="p-2 bg-red-100 text-red-700 rounded-xl"><Activity className="w-5 h-5" /></div>
          <h2 className="text-lg font-black text-gray-800">مقياس Child-Pugh للكبد</h2>
        </div>
      </div>

      <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 mb-4 text-[11px] text-blue-800">
        <p className="font-bold flex items-center gap-1.5 mb-1"><BookOpen className="w-4 h-4"/> المرجع:</p>
        AASLD / EASL - يستخدم لتقييم قصور وظائف الكبد وتعديل جرعات الأدوية.
      </div>

      <div className="bg-white p-5 rounded-[2rem] shadow-sm border space-y-4">
        {/* Bilirubin Selection */}
        <div>
          <label className="text-[10px] font-black text-gray-400 mb-1 block uppercase">Bilirubin (mg/dL)</label>
          <select className="w-full p-3 bg-gray-50 border rounded-xl font-bold text-xs" onChange={e => setData({...data, bilirubin: parseInt(e.target.value)})}>
            <option value="1">أقل من 2 (نقطة واحدة)</option>
            <option value="2">2 - 3 (نقطتان)</option>
            <option value="3">أكثر من 3 (3 نقاط)</option>
          </select>
        </div>

        {/* Albumin Selection */}
        <div>
          <label className="text-[10px] font-black text-gray-400 mb-1 block uppercase">Albumin (g/dL)</label>
          <select className="w-full p-3 bg-gray-50 border rounded-xl font-bold text-xs" onChange={e => setData({...data, albumin: parseInt(e.target.value)})}>
            <option value="1">أكثر من 3.5 (نقطة واحدة)</option>
            <option value="2">2.8 - 3.5 (نقطتان)</option>
            <option value="3">أقل من 2.8 (3 نقاط)</option>
          </select>
        </div>

        {/* Ascites Selection */}
        <div>
          <label className="text-[10px] font-black text-gray-400 mb-1 block uppercase">الاستسقاء (Ascites)</label>
          <select className="w-full p-3 bg-gray-50 border rounded-xl font-bold text-xs" onChange={e => setData({...data, ascites: parseInt(e.target.value)})}>
            <option value="1">لا يوجد</option>
            <option value="2">خفيف (يمكن التحكم به)</option>
            <option value="3">شديد (صعب التحكم)</option>
          </select>
        </div>

        <button onClick={calculate} className="w-full bg-gray-800 text-white font-black py-3.5 rounded-xl">حساب التصنيف</button>
      </div>

      {result && (
        <div className="mt-4 p-6 bg-white rounded-[2rem] border-2 border-red-100 text-center animate-in slide-in-from-bottom-4">
           <p className="text-gray-500 text-xs font-bold mb-1">Child-Pugh Class</p>
           <div className={`text-6xl font-black ${result.color}`}>{result.grade}</div>
           <p className="text-[10px] font-bold text-gray-400 mt-2">إجمالي النقاط: {result.score}</p>
           <p className="text-xs font-black text-gray-700 mt-1">معدل البقاء المتوقع: {result.survival}</p>
        </div>
      )}
    </div>
  );
}
