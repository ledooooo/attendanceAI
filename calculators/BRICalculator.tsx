import React, { useState } from 'react';
import { Activity, ArrowRight, Info, Save, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

interface Props { onBack?: () => void; }

export default function BRICalculator({ onBack }: Props) {
  const [height, setHeight] = useState('');
  const [waist, setWaist] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const calculate = () => {
    const h = parseFloat(height) / 100; 
    const w = parseFloat(waist) / 100; 
    
    if (!h || !w) { toast.error('يرجى إدخال الطول ومحيط الخصر'); return; }

    try {
      const numerator = Math.pow(w / (2 * Math.PI), 2);
      const denominator = Math.pow(0.5 * h, 2);
      const term = 1 - (numerator / denominator);
      
      if (term < 0) {
        toast.error("الأرقام المدخلة غير منطقية");
        return;
      }

      const bri = (364.2 - (365.5 * Math.sqrt(term))).toFixed(2);
      
      let status = ''; let color = ''; let bg = '';
      if (Number(bri) < 3) { status = 'شكل جسم نحيف'; color = 'text-blue-600'; bg = 'bg-blue-50 border-blue-200'; }
      else if (Number(bri) >= 3 && Number(bri) <= 5) { status = 'شكل جسم طبيعي وصحي'; color = 'text-green-600'; bg = 'bg-green-50 border-green-200'; }
      else if (Number(bri) > 5 && Number(bri) <= 7) { status = 'استدارة متوسطة (زيادة دهون)'; color = 'text-orange-600'; bg = 'bg-orange-50 border-orange-200'; }
      else { status = 'استدارة عالية (خطر صحي)'; color = 'text-red-600'; bg = 'bg-red-50 border-red-200'; }

      setResult({ val: bri, status, color, bg });
    } catch (e) {
      toast.error('حدث خطأ في الحساب');
    }
  };

  const saveResult = async () => {
    if (!result) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول');
      await supabase.from('saved_calculations').insert({
        user_id: user.id, title: 'مؤشر استدارة الجسم (BRI)',
        result: `${result.val} - ${result.status}`, input_data: { height, waist }
      });
      toast.success('تم الحفظ بنجاح ✅');
    } catch (err: any) { toast.error(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center gap-3 mb-6">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50"><ArrowRight className="w-5 h-5 text-gray-600" /></button>}
        <div className="flex items-center gap-2">
          <div className="p-2 bg-cyan-100 text-cyan-600 rounded-xl"><Activity className="w-5 h-5" /></div>
          <h2 className="text-xl font-black text-gray-800">مؤشر استدارة الجسم (BRI)</h2>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-4">
         <div className="bg-cyan-50 p-3 rounded-xl flex gap-2 text-cyan-800 text-xs font-bold leading-relaxed mb-2 border border-cyan-100">
            <Info className="w-5 h-5 shrink-0"/> مقياس حديث أدق من الـ BMI لأنه يعتمد على محيط الخصر لتحديد نسبة الدهون الحشوية.
         </div>
         <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5">الطول (سم)</label>
              <input type="number" value={height} onChange={e=>setHeight(e.target.value)} className="w-full p-3.5 border bg-gray-50 focus:bg-white rounded-xl outline-none focus:border-cyan-500 font-bold" placeholder="175" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5">محيط الخصر (سم)</label>
              <input type="number" value={waist} onChange={e=>setWaist(e.target.value)} className="w-full p-3.5 border bg-gray-50 focus:bg-white rounded-xl outline-none focus:border-cyan-500 font-bold" placeholder="80" />
            </div>
         </div>
         <button onClick={calculate} className="w-full bg-cyan-600 text-white font-black py-3.5 rounded-xl mt-2 hover:bg-cyan-700 shadow-md active:scale-95 transition-all">احسب المؤشر</button>
      </div>

      {result && (
        <div className={`mt-6 p-6 rounded-[2rem] border-2 shadow-sm animate-in slide-in-from-bottom-4 text-center ${result.bg}`}>
           <p className="text-gray-500 text-sm font-bold mb-1">النتيجة</p>
           <p className={`text-5xl font-black mb-2 ${result.color}`}>{result.val}</p>
           <p className={`text-sm font-black bg-white/60 inline-block px-4 py-1.5 rounded-lg shadow-sm ${result.color}`}>{result.status}</p>
           
           <button onClick={saveResult} disabled={loading} className="mt-6 w-full flex items-center justify-center gap-2 text-sm bg-white px-5 py-3 rounded-xl font-bold text-gray-800 shadow-sm border transition-colors hover:bg-gray-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ النتيجة
           </button>
        </div>
      )}
    </div>
  );
}
