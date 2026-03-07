import React, { useState } from 'react';
import { Activity, Save, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';

interface Props { onBack?: () => void; }

export default function GFRCalculator({ onBack }: Props) {
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [creatinine, setCreatinine] = useState('');
  const [gender, setGender] = useState('male');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const calculateGFR = () => {
    const a = parseFloat(age);
    const w = parseFloat(weight);
    const cr = parseFloat(creatinine);

    if (!a || !w || !cr || a <= 0 || w <= 0 || cr <= 0) {
      toast.error('يرجى إدخال قيم صحيحة');
      return;
    }

    // معادلة Cockcroft-Gault
    let crcl = ((140 - a) * w) / (72 * cr);
    if (gender === 'female') {
      crcl = crcl * 0.85;
    }

    let stage = '';
    let color = '';
    if (crcl >= 90) { stage = 'طبيعي (المرحلة 1)'; color = 'text-green-600'; }
    else if (crcl >= 60) { stage = 'نقص خفيف (المرحلة 2)'; color = 'text-blue-600'; }
    else if (crcl >= 30) { stage = 'نقص متوسط (المرحلة 3)'; color = 'text-orange-500'; }
    else if (crcl >= 15) { stage = 'نقص شديد (المرحلة 4)'; color = 'text-red-500'; }
    else { stage = 'فشل كلوي (المرحلة 5)'; color = 'text-red-700'; }

    setResult({
      gfr: crcl.toFixed(1),
      stage,
      color,
      bgColor: color.replace('text-', 'bg-').replace('500', '50').replace('600', '50').replace('700', '50')
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
          title: 'معدل تصفية الكرياتينين (CrCl)',
          result: `${result.gfr} ml/min - ${result.stage}`,
          input_data: { age, weight, creatinine, gender }
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
          <div className="p-2 bg-amber-100 text-amber-600 rounded-xl"><Activity className="w-5 h-5" /></div>
          <h2 className="text-xl font-black text-gray-800">حاسبة الكلى (CrCl)</h2>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-4">
        <div className="flex bg-gray-100 p-1.5 rounded-xl mb-4">
          <button onClick={() => setGender('male')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${gender === 'male' ? 'bg-white shadow-sm text-amber-600' : 'text-gray-500'}`}>ذكر</button>
          <button onClick={() => setGender('female')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${gender === 'female' ? 'bg-white shadow-sm text-amber-600' : 'text-gray-500'}`}>أنثى</button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">العمر (سنوات)</label>
            <input type="number" value={age} onChange={e => setAge(e.target.value)} className="w-full p-3 rounded-xl border bg-gray-50 focus:bg-white focus:border-amber-500 outline-none font-bold text-gray-800" placeholder="مثال: 45" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">الوزن (كجم)</label>
            <input type="number" value={weight} onChange={e => setWeight(e.target.value)} className="w-full p-3 rounded-xl border bg-gray-50 focus:bg-white focus:border-amber-500 outline-none font-bold text-gray-800" placeholder="مثال: 70" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">الكرياتينين بالدم (mg/dL)</label>
          <input type="number" value={creatinine} onChange={e => setCreatinine(e.target.value)} className="w-full p-3 rounded-xl border bg-gray-50 focus:bg-white focus:border-amber-500 outline-none font-bold text-gray-800" placeholder="مثال: 1.2" />
        </div>

        <button onClick={calculateGFR} className="w-full bg-amber-500 text-white py-3.5 rounded-xl font-black text-lg hover:bg-amber-600 shadow-md active:scale-95 transition-all mt-2">احسب التصفية</button>
      </div>

      {result && (
        <div className={`mt-6 p-6 rounded-[2rem] text-center border-2 shadow-sm animate-in slide-in-from-bottom-4 ${result.bgColor} border-current`}>
          <p className="text-sm font-bold text-gray-500 mb-1">معدل تصفية الكرياتينين (CrCl)</p>
          <h2 className={`text-5xl font-black my-2 ${result.color}`}>{result.gfr} <span className="text-xl">ml/min</span></h2>
          <p className={`text-sm font-bold px-3 py-1 bg-white rounded-lg inline-block shadow-sm ${result.color}`}>{result.stage}</p>
          
          <button onClick={saveResult} disabled={loading} className="mt-6 flex items-center justify-center gap-2 mx-auto text-sm bg-white/50 hover:bg-white px-5 py-2.5 rounded-xl font-bold text-gray-800 transition-colors w-full border shadow-sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ النتيجة
          </button>
        </div>
      )}
    </div>
  );
}
