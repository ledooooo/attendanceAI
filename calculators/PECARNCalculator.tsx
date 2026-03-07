import React, { useState } from 'react';
import { AlertCircle, ArrowRight, BookOpen, Save, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

interface Props { onBack?: () => void; }

export default function PECARNCalculator({ onBack }: Props) {
  const [ageGroup, setAgeGroup] = useState<'under2' | 'over2'>('under2');
  const [gcs, setGcs] = useState(false); // GCS < 15 or signs of fracture
  const [mentalStatus, setMentalStatus] = useState(false); // Altered mental status
  const [severeMechanism, setSevereMechanism] = useState(false); // Severe mechanism of injury
  const [lossOfConsciousness, setLossOfConsciousness] = useState(false);
  const [result, setResult] = useState<any>(null);

  const calculate = () => {
    // Logic based on PECARN criteria
    if (gcs || mentalStatus) {
      setResult({ 
        risk: 'عالي (High Risk)', 
        rec: 'يُنصح بعمل أشعة مقطعية (CT Scan) فوراً. خطر الإصابة الدماغية الخطيرة ~4%.',
        color: 'text-red-600', bg: 'bg-red-50 border-red-200' 
      });
    } else if (severeMechanism || lossOfConsciousness) {
      setResult({ 
        risk: 'متوسط (Intermediate Risk)', 
        rec: 'يمكن الاختيار بين الأشعة المقطعية أو الملاحظة السريرية بناءً على خبرة الطبيب وتطور الحالة.',
        color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' 
      });
    } else {
      setResult({ 
        risk: 'منخفض جداً (Very Low Risk)', 
        rec: 'لا ينصح بعمل أشعة مقطعية. خطر الإصابة الدماغية الخطيرة أقل من 0.02%.',
        color: 'text-green-600', bg: 'bg-green-50 border-green-200' 
      });
    }
  };

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 pb-10 px-1 text-right" dir="rtl">
      <div className="flex items-center gap-3 mb-4">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border"><ArrowRight className="w-5 h-5 text-gray-600" /></button>}
        <div className="flex items-center gap-2">
          <div className="p-2 bg-red-100 text-red-700 rounded-xl"><ShieldCheck className="w-5 h-5" /></div>
          <div>
            <h2 className="text-lg font-black text-gray-800">قاعدة PECARN لإصابات الرأس</h2>
            <span className="text-[10px] font-bold bg-red-50 text-red-600 px-2 py-0.5 rounded border border-red-100">للأطباء فقط ⚕️</span>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 mb-4 text-[11px] text-blue-800 leading-relaxed font-bold">
        <p className="flex items-center gap-1.5 mb-1"><BookOpen className="w-4 h-4"/> المصدر المعتمد:</p>
        Pediatric Emergency Care Applied Research Network (PECARN).
      </div>

      <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-gray-100 space-y-4">
        <div className="flex bg-gray-50 p-1 rounded-xl">
          <button onClick={()=>setAgeGroup('under2')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${ageGroup==='under2' ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}>أقل من سنتين</button>
          <button onClick={()=>setAgeGroup('over2')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${ageGroup==='over2' ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}>سنتين فأكثر</button>
        </div>

        <div className="space-y-2">
          {[
            { state: gcs, set: setGcs, label: 'مقياس GCS < 15 أو علامات كسر بقاعدة الجمجمة' },
            { state: mentalStatus, set: setMentalStatus, label: 'تغير في الحالة الذهنية (نعاس، هياج، بطء)' },
            { state: lossOfConsciousness, set: setLossOfConsciousness, label: 'فقدان وعي أو تقيؤ مستمر' },
            { state: severeMechanism, set: setSevereMechanism, label: 'آلية إصابة شديدة (سقوط من علو، حادث سيارة)' },
          ].map((item, i) => (
            <label key={i} className={`flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition-all ${item.state ? 'border-red-500 bg-red-50' : 'border-gray-50 hover:bg-gray-50'}`}>
              <input type="checkbox" checked={item.state} onChange={(e)=>item.set(e.target.checked)} className="w-5 h-5 accent-red-600"/>
              <span className="font-bold text-xs text-gray-700">{item.label}</span>
            </label>
          ))}
        </div>
        <button onClick={calculate} className="w-full bg-gray-800 text-white font-black py-3.5 rounded-xl">تقييم الحالة</button>
      </div>

      {result && (
        <div className={`mt-4 p-6 rounded-[2rem] border-2 text-center animate-in slide-in-from-bottom-4 ${result.bg}`}>
           <p className="text-gray-500 text-[10px] font-black mb-1 uppercase tracking-wider">النتيجة والقرار الطبي</p>
           <div className={`text-2xl font-black mb-2 ${result.color}`}>{result.risk}</div>
           <p className="text-xs font-bold text-gray-700 leading-relaxed bg-white/50 p-3 rounded-xl border border-white">{result.rec}</p>
        </div>
      )}
    </div>
  );
}
