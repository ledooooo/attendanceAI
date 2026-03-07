import React, { useState } from 'react';
import { Activity, ArrowRight, ShieldAlert, BookOpen, Save, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

interface Props { onBack?: () => void; }

export default function FIB4Calculator({ onBack }: Props) {
  const [age, setAge] = useState('');
  const [ast, setAst] = useState('');
  const [alt, setAlt] = useState('');
  const [plt, setPlt] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const calculate = () => {
    const a = parseFloat(age); const s = parseFloat(ast); const l = parseFloat(alt); const p = parseFloat(plt);
    if (!a || !s || !l || !p) { toast.error('أدخل جميع القيم'); return; }

    const fib4 = (a * s) / (p * Math.sqrt(l));
    const finalScore = fib4.toFixed(2);
    
    let rec = ''; let color = '';
    const lowCutoff = a >= 65 ? 2.0 : 1.30;
    
    if (fib4 < lowCutoff) { rec = `خطر منخفض لتليف الكبد (F0-F1)`; color = 'text-green-600'; }
    else if (fib4 > 2.67) { rec = `احتمالية عالية لتليف الكبد المتقدم (F3-F4). يحتاج طبيب كبد.`; color = 'text-red-600'; }
    else { rec = `خطر غير محدد (Indeterminate). يحتاج فحص فيبروسكان.`; color = 'text-orange-500'; }

    setResult({ score: finalScore, rec, color });
  };

  const saveResult = async () => {
    if (!result) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول');
      await supabase.from('saved_calculations').insert({
        user_id: user.id, title: 'مؤشر تليف الكبد (FIB-4)',
        result: `${result.score} | ${result.rec.split('.')[0]}`, input_data: { age, ast, alt, plt }
      });
      toast.success('تم الحفظ');
    } catch (err: any) { toast.error(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 pb-10">
      <div className="flex items-center gap-3 mb-4">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border"><ArrowRight className="w-5 h-5" /></button>}
        <div className="flex items-center gap-2">
          <div className="p-2 bg-red-100 text-red-700 rounded-xl"><ShieldAlert className="w-5 h-5" /></div>
          <div>
            <h2 className="text-lg font-black text-gray-800">مؤشر FIB-4 للكبد</h2>
            <span className="text-[10px] font-bold bg-red-50 text-red-600 px-2 py-0.5 rounded border border-red-100">مخصص للأطباء فقط</span>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 mb-4 text-xs text-blue-800 leading-relaxed">
        <p className="font-bold flex items-center gap-1.5 mb-1"><BookOpen className="w-4 h-4"/> الاستخدام والمصادر:</p>
        أداة لتقييم درجة التليف لمرضى الكبد الدهني والتهاب الكبد C دون الحاجة لخزعة كبدية.<br/>
        <span className="font-bold text-[10px] text-blue-600/80 mt-1 block">* المرجع: AASLD / EASL Guidelines.</span>
      </div>

      <div className="bg-white p-5 rounded-[2rem] shadow-sm border mb-4 grid grid-cols-2 gap-3">
        <div><label className="text-xs font-bold text-gray-500 mb-1 block">العمر (سنوات)</label><input type="number" value={age} onChange={e=>setAge(e.target.value)} className="w-full p-3 border rounded-xl font-bold bg-gray-50"/></div>
        <div><label className="text-xs font-bold text-gray-500 mb-1 block">الصفائح (10^9/L)</label><input type="number" value={plt} onChange={e=>setPlt(e.target.value)} className="w-full p-3 border rounded-xl font-bold bg-gray-50" placeholder="مثال: 250"/></div>
        <div><label className="text-xs font-bold text-gray-500 mb-1 block">AST (U/L)</label><input type="number" value={ast} onChange={e=>setAst(e.target.value)} className="w-full p-3 border rounded-xl font-bold bg-gray-50"/></div>
        <div><label className="text-xs font-bold text-gray-500 mb-1 block">ALT (U/L)</label><input type="number" value={alt} onChange={e=>setAlt(e.target.value)} className="w-full p-3 border rounded-xl font-bold bg-gray-50"/></div>
        <button onClick={calculate} className="col-span-2 bg-gray-800 text-white font-black py-3.5 rounded-xl mt-2">احسب المؤشر</button>
      </div>

      {result && (
        <div className="bg-white p-6 rounded-[2rem] border-2 border-red-100 text-center animate-in slide-in-from-bottom-4">
           <div className={`text-5xl font-black mb-2 ${result.color}`}>{result.score}</div>
           <p className={`text-sm font-black bg-gray-50 p-3 rounded-xl border ${result.color}`}>{result.rec}</p>
           <button onClick={saveResult} disabled={loading} className="w-full mt-4 flex justify-center gap-2 text-sm bg-red-50 text-red-700 px-5 py-3 rounded-xl font-bold"><Save className="w-4 h-4" /> حفظ النتيجة</button>
        </div>
      )}
    </div>
  );
}
