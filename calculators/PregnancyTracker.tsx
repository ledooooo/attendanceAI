import React, { useState } from 'react';
import { Baby, ArrowRight, Save, Loader2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';

interface Props { onBack?: () => void; }

export default function PregnancyTracker({ onBack }: Props) {
  const [lmp, setLmp] = useState('');
  const [cycleLength, setCycleLength] = useState('28');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const calculate = () => {
    if (!lmp) {
      toast.error('يرجى إدخال تاريخ آخر دورة');
      return;
    }
    
    const lmpDate = new Date(lmp);
    const cycleAdjustment = parseInt(cycleLength) - 28;
    const dueDate = new Date(lmpDate);
    dueDate.setDate(lmpDate.getDate() + 280 + cycleAdjustment);

    const today = new Date();
    const diffTime = today.getTime() - lmpDate.getTime();
    
    if (diffTime < 0) {
      toast.error('تاريخ آخر دورة يجب أن يكون في الماضي');
      return;
    }

    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const weeks = Math.floor(diffDays / 7);
    const days = diffDays % 7;

    let trimester = '';
    let trimesterColor = '';
    if (weeks < 13) { trimester = 'الثلث الأول'; trimesterColor = 'bg-blue-100 text-blue-700 border-blue-200'; }
    else if (weeks < 27) { trimester = 'الثلث الثاني'; trimesterColor = 'bg-green-100 text-green-700 border-green-200'; }
    else { trimester = 'الثلث الثالث'; trimesterColor = 'bg-pink-100 text-pink-700 border-pink-200'; }

    const progress = Math.min(100, Math.max(0, (diffDays / 280) * 100));

    setResult({
      dueDate: dueDate.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' }),
      age: `${weeks} أسبوع و ${days} يوم`,
      remainingDays: 280 - diffDays,
      trimester, trimesterColor, progress
    });
  };

  const saveResult = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول');
      await supabase.from('saved_calculations').insert({
        user_id: user.id, title: 'تتبع الحمل',
        result: `الولادة المتوقعة: ${result.dueDate} | العمر: ${result.age}`, input_data: { lmp, cycleLength }
      });
      toast.success('تم الحفظ بنجاح ✅');
    } catch (err: any) { toast.error(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center gap-3 mb-6">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50"><ArrowRight className="w-5 h-5 text-gray-600" /></button>}
        <div className="flex items-center gap-2">
          <div className="p-2 bg-pink-100 text-pink-600 rounded-xl"><Baby className="w-5 h-5" /></div>
          <h2 className="text-xl font-black text-gray-800">تتبع الحمل (EDD)</h2>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-4">
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5">تاريخ أول يوم لآخر دورة (LMP)</label>
          <input type="date" value={lmp} onChange={e=>setLmp(e.target.value)} className="w-full p-3.5 rounded-xl border bg-gray-50 focus:bg-white focus:border-pink-500 outline-none font-bold text-gray-800" />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5">متوسط طول الدورة (يوم)</label>
          <input type="number" value={cycleLength} onChange={e=>setCycleLength(e.target.value)} className="w-full p-3.5 rounded-xl border bg-gray-50 focus:bg-white focus:border-pink-500 outline-none font-bold text-gray-800" placeholder="28" />
        </div>
        <button onClick={calculate} className="w-full bg-pink-500 text-white py-3.5 rounded-xl font-black text-lg hover:bg-pink-600 shadow-md active:scale-95 transition-all mt-2">عرض موعد الولادة</button>
      </div>

      {result && (
        <div className="mt-6 p-6 bg-white rounded-[2rem] border shadow-sm animate-in slide-in-from-bottom-4">
          <div className="bg-pink-50 rounded-2xl p-5 border border-pink-100 text-center mb-4 relative overflow-hidden">
            <div className="relative z-10">
                <p className="text-xs text-pink-800 font-bold mb-1">موعد الولادة المتوقع</p>
                <p className="text-2xl font-black text-pink-700">{result.dueDate}</p>
            </div>
            <Baby className="absolute -bottom-2 -left-2 w-24 h-24 text-pink-200/50 rotate-12"/>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-gray-50 p-3 rounded-xl border text-center">
               <p className="text-[10px] font-bold text-gray-400 mb-1">عمر الحمل</p>
               <p className="text-sm font-black text-gray-800">{result.age}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-xl border text-center">
               <p className="text-[10px] font-bold text-gray-400 mb-1">المرحلة</p>
               <span className={`text-[10px] px-2 py-1 rounded-md font-bold border ${result.trimesterColor}`}>{result.trimester}</span>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex justify-between text-[10px] font-bold text-gray-400 mb-1">
                <span>البداية</span>
                <span>باقي {result.remainingDays} يوم</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-l from-pink-500 to-pink-300 transition-all duration-1000" style={{width: `${result.progress}%`}}></div>
            </div>
          </div>

          <button onClick={saveResult} disabled={loading} className="w-full flex items-center justify-center gap-2 text-sm bg-gray-800 text-white px-5 py-3 rounded-xl font-bold hover:bg-gray-900 shadow-md transition-colors">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ النتيجة
          </button>
        </div>
      )}
    </div>
  );
}
