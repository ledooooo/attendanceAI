import React, { useState } from 'react';
import { Activity, ArrowRight, TrendingUp, Save, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

interface Props { onBack?: () => void; }

export default function HeartRateCalculator({ onBack }: Props) {
  const [age, setAge] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const calculate = () => {
    const a = parseInt(age);
    if (!a) { toast.error('يرجى إدخال العمر'); return; }

    const maxHR = 220 - a;
    const moderateMin = Math.round(maxHR * 0.50);
    const moderateMax = Math.round(maxHR * 0.70);
    const vigorousMin = Math.round(maxHR * 0.70);
    const vigorousMax = Math.round(maxHR * 0.85);

    setResult({ maxHR, moderateMin, moderateMax, vigorousMin, vigorousMax });
  };

  const saveResult = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول');
      if (result) {
        await supabase.from('saved_calculations').insert({
          user_id: user.id, title: 'معدل نبضات القلب',
          result: `أقصى معدل: ${result.maxHR} | حرق الدهون: ${result.moderateMin}-${result.moderateMax}`, input_data: { age }
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
          <div className="p-2 bg-rose-100 text-rose-600 rounded-xl"><Activity className="w-5 h-5" /></div>
          <h2 className="text-xl font-black text-gray-800">نبضات القلب المستهدفة</h2>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-5">
        <div>
          <label className="block text-sm font-bold text-gray-600 mb-2">عمرك (سنة)</label>
          <input type="number" value={age} onChange={e=>setAge(e.target.value)} className="w-full p-4 border bg-gray-50 focus:bg-white rounded-xl outline-none font-bold text-lg" placeholder="مثال: 30" />
        </div>
        <button onClick={calculate} className="w-full bg-rose-600 text-white font-black py-3.5 rounded-xl hover:bg-rose-700 shadow-md active:scale-95 transition-all">احسب النطاقات</button>
      </div>

      {result && (
        <div className="mt-6 space-y-3 animate-in slide-in-from-bottom-4">
          <div className="bg-white p-5 rounded-2xl border text-center shadow-sm">
            <p className="text-gray-500 text-xs font-bold mb-1">أقصى معدل لضربات قلبك</p>
            <p className="text-4xl font-black text-rose-600">{result.maxHR} <span className="text-sm font-bold text-gray-400">نبضة/دقيقة</span></p>
          </div>

          <div className="bg-green-50 border border-green-200 p-5 rounded-2xl">
             <div className="flex justify-between items-center mb-2">
               <p className="font-bold text-green-800 text-sm">حرق الدهون (نشاط متوسط)</p>
               <span className="bg-green-200 text-green-800 text-[10px] px-2 py-1 rounded-md font-bold">50-70%</span>
             </div>
             <p className="text-3xl font-black text-green-600 text-right dir-ltr">{result.moderateMin} - {result.moderateMax}</p>
          </div>

          <div className="bg-orange-50 border border-orange-200 p-5 rounded-2xl">
             <div className="flex justify-between items-center mb-2">
               <p className="font-bold text-orange-800 text-sm">اللياقة القلبية (نشاط عالي)</p>
               <span className="bg-orange-200 text-orange-800 text-[10px] px-2 py-1 rounded-md font-bold">70-85%</span>
             </div>
             <p className="text-3xl font-black text-orange-600 text-right dir-ltr">{result.vigorousMin} - {result.vigorousMax}</p>
          </div>

          <button onClick={saveResult} disabled={loading} className="w-full flex items-center justify-center gap-2 text-sm bg-white px-5 py-3.5 rounded-xl font-bold text-gray-800 hover:bg-gray-50 shadow-sm border transition-colors mt-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ النتيجة
          </button>
        </div>
      )}
    </div>
  );
}
