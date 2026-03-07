import React, { useState } from 'react';
import { Calendar, ArrowRight, Heart, Sparkles, Save, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

interface Props { onBack?: () => void; }

export default function OvulationCalculator({ onBack }: Props) {
  const [lastPeriod, setLastPeriod] = useState('');
  const [cycleLength, setCycleLength] = useState('28');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const calculate = () => {
    if (!lastPeriod) {
      toast.error('يرجى إدخال تاريخ أول يوم من آخر دورة');
      return;
    }
    
    const lpDate = new Date(lastPeriod);
    const cycle = parseInt(cycleLength);

    const nextPeriod = new Date(lpDate);
    nextPeriod.setDate(lpDate.getDate() + cycle);

    const ovulationDate = new Date(nextPeriod);
    ovulationDate.setDate(nextPeriod.getDate() - 14);

    const fertileStart = new Date(ovulationDate);
    fertileStart.setDate(ovulationDate.getDate() - 5);
    
    const fertileEnd = new Date(ovulationDate);
    fertileEnd.setDate(ovulationDate.getDate() + 1);

    const options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'short', day: 'numeric' };

    setResult({
      ovulation: ovulationDate.toLocaleDateString('ar-EG', options),
      fertileStart: fertileStart.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' }),
      fertileEnd: fertileEnd.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' }),
      nextPeriod: nextPeriod.toLocaleDateString('ar-EG', options)
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
          title: 'حاسبة التبويض',
          result: `التبويض: ${result.ovulation}`,
          input_data: { lastPeriod, cycleLength, result }
        });
        toast.success('تم الحفظ بنجاح ✅');
      }
    } catch (err: any) { toast.error(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center gap-3 mb-6">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50 transition-colors"><ArrowRight className="w-5 h-5 text-gray-600" /></button>}
        <div className="flex items-center gap-2">
          <div className="p-2 bg-purple-100 text-purple-600 rounded-xl"><Calendar className="w-5 h-5" /></div>
          <h2 className="text-xl font-black text-gray-800">حاسبة التبويض والخصوبة</h2>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-4">
        <div className="flex items-center gap-4 mb-2">
          <div className="bg-purple-50 p-3 rounded-2xl"><Sparkles className="w-6 h-6 text-purple-600"/></div>
          <div>
            <h2 className="text-sm font-black text-gray-800">تتبع أيام الخصوبة</h2>
            <p className="text-[10px] font-bold text-gray-500">لزيادة فرص الحمل بإذن الله</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-bold text-gray-500 mb-1.5">أول يوم في آخر دورة</label>
            <input type="date" value={lastPeriod} onChange={e=>setLastPeriod(e.target.value)} className="w-full p-3.5 border bg-gray-50 focus:bg-white rounded-xl outline-none focus:border-purple-500 font-bold text-gray-700" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-bold text-gray-500 mb-1.5">طول الدورة المعتاد (يوم)</label>
            <input type="number" value={cycleLength} onChange={e=>setCycleLength(e.target.value)} className="w-full p-3.5 border bg-gray-50 focus:bg-white rounded-xl outline-none focus:border-purple-500 font-bold text-gray-700" placeholder="28" />
          </div>
        </div>

        <button onClick={calculate} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-black py-3.5 rounded-xl transition-all shadow-md active:scale-95 mt-2">احسب الأيام</button>
      </div>

      {result && (
        <div className="mt-6 space-y-3 animate-in slide-in-from-bottom-4">
          <div className="bg-gradient-to-br from-purple-600 to-indigo-600 text-white p-6 rounded-[2rem] text-center relative overflow-hidden shadow-lg shadow-purple-200">
             <div className="relative z-10">
                <p className="text-purple-100 font-bold mb-1 text-sm">يوم التبويض المتوقع (الذروة)</p>
                <p className="text-3xl font-black">{result.ovulation}</p>
             </div>
             <Sparkles className="absolute top-0 right-0 text-white/10 w-32 h-32 -mr-8 -mt-8"/>
          </div>

          <div className="bg-white border border-green-100 p-5 rounded-[2rem] flex items-center justify-between shadow-sm">
            <div>
               <p className="text-green-700 font-black text-sm mb-0.5 flex items-center gap-1.5"><Heart className="w-4 h-4 fill-green-600"/> نافذة الخصوبة</p>
               <p className="text-[10px] font-bold text-gray-500">أفضل وقت لحدوث حمل</p>
            </div>
            <div className="text-left bg-green-50 px-3 py-1.5 rounded-xl border border-green-100">
               <p className="text-sm font-black text-green-700 dir-ltr">{result.fertileStart} - {result.fertileEnd}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-100 text-center text-xs text-gray-500 font-bold shadow-sm">
            الدورة القادمة متوقعة يوم: <span className="font-black text-gray-800">{result.nextPeriod}</span>
          </div>

          <button onClick={saveResult} disabled={loading} className="w-full flex items-center justify-center gap-2 text-sm bg-white px-5 py-3.5 rounded-xl font-bold text-gray-800 hover:bg-gray-50 shadow-sm border transition-colors">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ النتيجة في السجل
          </button>
        </div>
      )}
    </div>
  );
}
