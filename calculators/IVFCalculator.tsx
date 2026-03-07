import React, { useState } from 'react';
import { Droplet, Save, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

interface Props { onBack?: () => void; }

export default function IVFCalculator({ onBack }: Props) {
  const [volume, setVolume] = useState('');
  const [time, setTime] = useState('');
  const [dropFactor, setDropFactor] = useState('15'); // 15, 20, 60
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const calculateIVF = () => {
    const v = parseFloat(volume);
    const t = parseFloat(time);
    const df = parseFloat(dropFactor);

    if (!v || !t || v <= 0 || t <= 0) {
      toast.error('يرجى إدخال قيم صحيحة للحجم والوقت');
      return;
    }

    const dropsPerMin = Math.round((v * df) / (t * 60));
    setResult({
      dropsPerMin,
      details: `${v} مل على ${t} ساعات (بمعامل تنقيط ${df})`
    });
  };

  const saveResult = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول أولاً');
      if (result) {
        const { error } = await supabase.from('saved_calculations').insert({
          user_id: user.id,
          title: 'معدل المحاليل الوريدية (IV Drip Rate)',
          result: `${result.dropsPerMin} نقطة/دقيقة`,
          input_data: { volume, time, dropFactor }
        });
        if (error) throw error;
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
          <div className="p-2 bg-cyan-100 text-cyan-600 rounded-xl"><Droplet className="w-5 h-5" /></div>
          <h2 className="text-xl font-black text-gray-800">حاسبة المحاليل الوريدية</h2>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-5">
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5">حجم المحلول (مل)</label>
          <input type="number" value={volume} onChange={e => setVolume(e.target.value)} className="w-full p-3.5 rounded-xl border bg-gray-50 focus:bg-white focus:border-cyan-500 outline-none font-bold text-gray-800" placeholder="مثال: 500" />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5">الوقت المطلوب (ساعات)</label>
          <input type="number" value={time} onChange={e => setTime(e.target.value)} className="w-full p-3.5 rounded-xl border bg-gray-50 focus:bg-white focus:border-cyan-500 outline-none font-bold text-gray-800" placeholder="مثال: 8" />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5">معامل التنقيط (Drop Factor)</label>
          <select value={dropFactor} onChange={e => setDropFactor(e.target.value)} className="w-full p-3.5 rounded-xl border bg-gray-50 focus:bg-white focus:border-cyan-500 outline-none font-bold text-gray-800">
            <option value="15">15 نقطة/مل (جهاز وريد عادي للبالغين)</option>
            <option value="20">20 نقطة/مل (جهاز وريد عادي)</option>
            <option value="60">60 نقطة/مل (جهاز وريد دقيق - أطفال Microdrip)</option>
          </select>
        </div>

        <button onClick={calculateIVF} className="w-full bg-cyan-600 text-white py-3.5 rounded-xl font-black text-lg hover:bg-cyan-700 shadow-md active:scale-95 transition-all">احسب معدل التنقيط</button>
      </div>

      {result && (
        <div className="mt-6 p-6 rounded-[2rem] text-center border-2 bg-cyan-50 border-cyan-200 shadow-sm animate-in slide-in-from-bottom-4">
          <p className="text-sm font-bold text-gray-500 mb-1">سرعة التنقيط المطلوبة</p>
          <h2 className="text-5xl font-black my-2 text-cyan-600">{result.dropsPerMin} <span className="text-xl">نقطة/دقيقة</span></h2>
          <p className="text-xs text-gray-500 font-bold">{result.details}</p>
          
          <button onClick={saveResult} disabled={loading} className="mt-6 flex items-center justify-center gap-2 mx-auto text-sm bg-white hover:bg-cyan-100 px-5 py-2.5 rounded-xl font-bold text-cyan-800 transition-colors w-full border border-cyan-100 shadow-sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            حفظ النتيجة في السجل
          </button>
        </div>
      )}
    </div>
  );
}
