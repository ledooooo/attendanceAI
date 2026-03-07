import React, { useState } from 'react';
import { Activity, ArrowRight, ShieldAlert, BookOpen, Save, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

interface Props { onBack?: () => void; }

export default function CURB65Calculator({ onBack }: Props) {
  const [c, setC] = useState(false);
  const [u, setU] = useState(false);
  const [r, setR] = useState(false);
  const [b, setB] = useState(false);
  const [a, setA] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const calculate = () => {
    let score = 0;
    if (c) score += 1; if (u) score += 1; if (r) score += 1; if (b) score += 1; if (a) score += 1;

    let recommendation = ''; let color = '';
    if (score <= 1) { recommendation = 'علاج بالمنزل (Outpatient). معدل الوفاة 1.5%'; color = 'text-green-600'; }
    else if (score === 2) { recommendation = 'تنويم مستشفى قسم داخلي (Inpatient). معدل الوفاة 9.2%'; color = 'text-orange-500'; }
    else { recommendation = 'تنويم رعاية مركزة (ICU). معدل الوفاة 22% فأكثر'; color = 'text-red-600'; }

    setResult({ score, recommendation, color });
  };

  const saveResult = async () => {
    if (!result) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول');
      await supabase.from('saved_calculations').insert({
        user_id: user.id, title: 'مقياس CURB-65',
        result: `النقاط: ${result.score} | ${result.recommendation}`, input_data: { score: result.score }
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
            <h2 className="text-lg font-black text-gray-800">مقياس CURB-65</h2>
            <span className="text-[10px] font-bold bg-red-50 text-red-600 px-2 py-0.5 rounded border border-red-100">مخصص للأطباء فقط</span>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 mb-4 text-xs text-blue-800 leading-relaxed">
        <p className="font-bold flex items-center gap-1.5 mb-1"><BookOpen className="w-4 h-4"/> الاستخدام والمصادر:</p>
        تحديد خطورة الالتهاب الرئوي المكتسب (CAP) لاتخاذ قرار العلاج (منزل/مستشفى/عناية).<br/>
        <span className="font-bold text-[10px] text-blue-600/80 mt-1 block">* المرجع: British Thoracic Society (BTS).</span>
      </div>

      <div className="bg-white p-5 rounded-[2rem] shadow-sm border mb-4 space-y-2">
        {[
          { state: c, set: setC, label: 'C - تشوش ذهني (Confusion)' },
          { state: u, set: setU, label: 'U - اليوريا > 19 mg/dL (BUN)' },
          { state: r, set: setR, label: 'R - سرعة التنفس ≥ 30/دقيقة' },
          { state: b, set: setB, label: 'B - الضغط الانقباضي < 90 أو الانبساطي ≤ 60' },
          { state: a, set: setA, label: '65 - العمر 65 سنة فأكثر' },
        ].map((item, i) => (
          <label key={i} className={`flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer ${item.state ? 'border-red-500 bg-red-50' : 'hover:bg-gray-50'}`}>
            <input type="checkbox" checked={item.state} onChange={(e)=>item.set(e.target.checked)} className="w-5 h-5 accent-red-600"/>
            <span className="font-bold text-sm text-gray-700">{item.label}</span>
          </label>
        ))}
        <button onClick={calculate} className="w-full bg-gray-800 text-white font-black py-3.5 rounded-xl mt-4 hover:bg-gray-900 active:scale-95">التقييم</button>
      </div>

      {result && (
        <div className="bg-white p-6 rounded-[2rem] border-2 border-red-100 text-center animate-in slide-in-from-bottom-4">
           <div className={`text-6xl font-black mb-2 ${result.color}`}>{result.score}</div>
           <p className={`text-sm font-black bg-gray-50 p-3 rounded-xl border ${result.color}`}>{result.recommendation}</p>
           <button onClick={saveResult} disabled={loading} className="w-full mt-4 flex justify-center gap-2 text-sm bg-red-50 text-red-700 px-5 py-3 rounded-xl font-bold">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ النتيجة
           </button>
        </div>
      )}
    </div>
  );
}
