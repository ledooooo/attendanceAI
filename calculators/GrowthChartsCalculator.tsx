import React, { useState } from 'react';
import { TrendingUp, ArrowRight, AlertTriangle, Save, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

interface Props { onBack?: () => void; }

export default function GrowthChartsCalculator({ onBack }: Props) {
  const [gender, setGender] = useState('boy');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [length, setLength] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const standards: any = {
    boy: { 0: { w: 3.3, l: 49.9 }, 3: { w: 6.4, l: 61.4 }, 6: { w: 7.9, l: 67.6 }, 9: { w: 8.9, l: 72.0 }, 12: { w: 9.6, l: 75.7 }, 18: { w: 10.9, l: 82.3 }, 24: { w: 12.2, l: 87.8 }, 36: { w: 14.3, l: 96.1 }, 48: { w: 16.3, l: 103.3 }, 60: { w: 18.3, l: 110.0 } },
    girl: { 0: { w: 3.2, l: 49.1 }, 3: { w: 5.8, l: 59.8 }, 6: { w: 7.3, l: 65.7 }, 9: { w: 8.2, l: 70.1 }, 12: { w: 8.9, l: 74.0 }, 18: { w: 10.2, l: 80.7 }, 24: { w: 11.5, l: 86.4 }, 36: { w: 13.9, l: 95.1 }, 48: { w: 16.1, l: 102.7 }, 60: { w: 18.2, l: 109.4 } }
  };

  const calculate = () => {
    const a = parseInt(age);
    const w = parseFloat(weight);
    if (!a || !w) { toast.error('يرجى إدخال العمر والوزن'); return; }
    
    const ages = Object.keys(standards[gender]).map(Number);
    const closestAge = ages.reduce((prev, curr) => Math.abs(curr - a) < Math.abs(prev - a) ? curr : prev);
    const std = standards[gender][closestAge];
    const weightDiff = ((w - std.w) / std.w) * 100;
    
    let wStatus = '', wColor = '', wBg = '';
    if (weightDiff < -15) { wStatus = 'أقل من المعدل (نحافة)'; wColor = 'text-blue-600'; wBg = 'bg-blue-50 border-blue-200'; }
    else if (weightDiff > 15) { wStatus = 'أعلى من المعدل (وزن زائد)'; wColor = 'text-red-600'; wBg = 'bg-red-50 border-red-200'; }
    else { wStatus = 'وزن مثالي وطبيعي'; wColor = 'text-green-600'; wBg = 'bg-green-50 border-green-200'; }

    setResult({ stdWeight: std.w, stdLength: std.l, wStatus, wColor, wBg, closestAge });
  };

  const saveResult = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول أولاً');
      if (result) {
        await supabase.from('saved_calculations').insert({
          user_id: user.id, title: 'منحنيات النمو (WHO)',
          result: `العمر: ${age} شهر - الوزن: ${result.wStatus}`, input_data: { age, weight, gender }
        });
        toast.success('تم الحفظ بنجاح ✅');
      }
    } catch (err: any) { toast.error(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center gap-3 mb-6">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50"><ArrowRight className="w-5 h-5 text-gray-600" /></button>}
        <div className="flex items-center gap-2">
          <div className="p-2 bg-orange-100 text-orange-600 rounded-xl"><TrendingUp className="w-5 h-5" /></div>
          <h2 className="text-xl font-black text-gray-800">منحنيات النمو (WHO)</h2>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-4">
        <div className="flex bg-gray-100 p-1.5 rounded-xl mb-2">
           <button onClick={()=>setGender('boy')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${gender==='boy' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}>ولد</button>
           <button onClick={()=>setGender('girl')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${gender==='girl' ? 'bg-white shadow-sm text-pink-600' : 'text-gray-500'}`}>بنت</button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-bold text-gray-500 mb-1.5">عمر الطفل (بالشهور)</label>
            <input type="number" value={age} onChange={e=>setAge(e.target.value)} className="w-full p-3.5 border bg-gray-50 focus:bg-white rounded-xl outline-none font-bold" placeholder="مثال: 12" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">الوزن (كجم)</label>
            <input type="number" value={weight} onChange={e=>setWeight(e.target.value)} className="w-full p-3.5 border bg-gray-50 focus:bg-white rounded-xl outline-none font-bold" placeholder="مثال: 9.5" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">الطول (سم) اختياري</label>
            <input type="number" value={length} onChange={e=>setLength(e.target.value)} className="w-full p-3.5 border bg-gray-50 focus:bg-white rounded-xl outline-none font-bold" placeholder="مثال: 75" />
          </div>
        </div>

        <button onClick={calculate} className="w-full bg-orange-600 text-white font-black py-3.5 rounded-xl mt-2 hover:bg-orange-700 shadow-md active:scale-95 transition-all">تحليل النمو</button>
      </div>

      {result && (
        <div className={`mt-6 p-6 rounded-[2rem] border-2 shadow-sm animate-in slide-in-from-bottom-4 ${result.wBg}`}>
          <p className="text-gray-500 text-sm font-bold text-center mb-2">مقارنة بالمعدل العالمي لعمر {result.closestAge} شهر</p>
          <h3 className={`text-2xl font-black text-center mb-6 ${result.wColor}`}>{result.wStatus}</h3>

          <div className="grid grid-cols-2 gap-3 text-center mb-6">
            <div className="bg-white/60 p-3 rounded-xl border border-white">
              <p className="text-[10px] font-bold text-gray-500">الوزن المثالي</p>
              <p className="text-lg font-black text-gray-800">{result.stdWeight} كجم</p>
            </div>
            <div className="bg-white/60 p-3 rounded-xl border border-white">
              <p className="text-[10px] font-bold text-gray-500">الطول المثالي</p>
              <p className="text-lg font-black text-gray-800">{result.stdLength} سم</p>
            </div>
          </div>
          
          <button onClick={saveResult} disabled={loading} className="flex items-center justify-center gap-2 mx-auto text-sm bg-white px-5 py-3 rounded-xl font-bold text-gray-800 w-full shadow-sm border transition-colors">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ النتيجة
          </button>
        </div>
      )}
    </div>
  );
}
