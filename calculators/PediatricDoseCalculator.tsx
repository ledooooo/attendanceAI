import React, { useState } from 'react';
import { Syringe, Save, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';

interface Props { onBack?: () => void; }

export default function PediatricDoseCalculator({ onBack }: Props) {
  const [weight, setWeight] = useState('');
  const [dosePerKg, setDosePerKg] = useState('');
  const [concentration, setConcentration] = useState('');
  const [frequency, setFrequency] = useState('2'); // مرات في اليوم
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const calculateDose = () => {
    const w = parseFloat(weight);
    const d = parseFloat(dosePerKg);
    const c = parseFloat(concentration);
    const f = parseFloat(frequency);

    if (!w || !d || !c || !f || w <= 0 || d <= 0 || c <= 0) {
      toast.error('يرجى إدخال جميع القيم بشكل صحيح');
      return;
    }

    const totalDailyDoseMg = w * d;
    const dosePerTimeMg = totalDailyDoseMg / f;
    const dosePerTimeMl = dosePerTimeMg / c;

    setResult({
      mgPerDose: dosePerTimeMg.toFixed(1),
      mlPerDose: dosePerTimeMl.toFixed(1),
      totalDaily: totalDailyDoseMg.toFixed(1)
    });
  };

  const saveResult = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول أولاً');
      if (result) {
        await supabase.from('saved_calculations').insert({
          user_id: user.id,
          title: 'جرعة أطفال (Pediatric Dose)',
          result: `${result.mlPerDose} مل / الجرعة`,
          input_data: { weight, dosePerKg, concentration, frequency }
        });
        toast.success('تم الحفظ بنجاح ✅');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center gap-3 mb-6">
        {onBack && (
          <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50 transition-colors">
            <ArrowRight className="w-5 h-5 text-gray-600" />
          </button>
        )}
        <div className="flex items-center gap-2">
          <div className="p-2 bg-violet-100 text-violet-600 rounded-xl"><Syringe className="w-5 h-5" /></div>
          <h2 className="text-xl font-black text-gray-800">حاسبة جرعات الأطفال</h2>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-4">
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">وزن الطفل (كجم)</label>
          <input type="number" value={weight} onChange={e => setWeight(e.target.value)} className="w-full p-3 rounded-xl border bg-gray-50 focus:bg-white focus:border-violet-500 outline-none font-bold text-gray-800" placeholder="مثال: 12" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">الجرعة (مجم/كجم/يوم)</label>
            <input type="number" value={dosePerKg} onChange={e => setDosePerKg(e.target.value)} className="w-full p-3 rounded-xl border bg-gray-50 focus:bg-white focus:border-violet-500 outline-none font-bold text-gray-800" placeholder="مثال: 50" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">تركيز الدواء (مجم/مل)</label>
            <input type="number" value={concentration} onChange={e => setConcentration(e.target.value)} className="w-full p-3 rounded-xl border bg-gray-50 focus:bg-white focus:border-violet-500 outline-none font-bold text-gray-800" placeholder="مثال: 50 (من 250مجم/5مل)" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">عدد المرات يومياً</label>
          <select value={frequency} onChange={e => setFrequency(e.target.value)} className="w-full p-3 rounded-xl border bg-gray-50 focus:bg-white focus:border-violet-500 outline-none font-bold text-gray-800">
            <option value="1">مرة واحدة (OD)</option>
            <option value="2">مرتين (BID)</option>
            <option value="3">3 مرات (TID)</option>
            <option value="4">4 مرات (QID)</option>
          </select>
        </div>

        <button onClick={calculateDose} className="w-full bg-violet-600 text-white py-3.5 rounded-xl font-black text-lg hover:bg-violet-700 shadow-md active:scale-95 transition-all mt-2">احسب الجرعة</button>
      </div>

      {result && (
        <div className="mt-6 p-6 rounded-[2rem] text-center border-2 bg-violet-50 border-violet-200 shadow-sm animate-in slide-in-from-bottom-4">
          <p className="text-sm font-bold text-gray-500 mb-1">الجرعة المطلوبة في المرة الواحدة</p>
          <h2 className="text-5xl font-black my-2 text-violet-600">{result.mlPerDose} <span className="text-xl">مل</span></h2>
          <p className="text-xs font-bold text-violet-500">يعادل ({result.mgPerDose} مجم) في الجرعة</p>
          <div className="mt-4 pt-4 border-t border-violet-100">
            <p className="text-xs text-gray-500 font-bold">إجمالي الجرعة اليومية: {result.totalDaily} مجم</p>
          </div>
          
          <button onClick={saveResult} disabled={loading} className="mt-4 flex items-center justify-center gap-2 mx-auto text-sm bg-white hover:bg-violet-100 px-5 py-2.5 rounded-xl font-bold text-violet-800 transition-colors w-full border border-violet-100 shadow-sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ النتيجة
          </button>
        </div>
      )}
    </div>
  );
}
