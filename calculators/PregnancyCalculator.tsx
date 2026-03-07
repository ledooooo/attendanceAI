import React, { useState } from 'react';
import { CalendarHeart, Save, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';

interface Props { onBack?: () => void; }

export default function PregnancyCalculator({ onBack }: Props) {
  const [lmp, setLmp] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const calculatePregnancy = () => {
    if (!lmp) {
      toast.error('يرجى إدخال تاريخ أول يوم من آخر دورة');
      return;
    }

    const lmpDate = new Date(lmp);
    const eddDate = new Date(lmpDate);
    eddDate.setDate(lmpDate.getDate() + 280); // Naegele's rule (9 months + 7 days)

    const today = new Date();
    const diffTime = Math.abs(today.getTime() - lmpDate.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    const weeks = Math.floor(diffDays / 7);
    const days = diffDays % 7;

    let trimester = '';
    if (weeks < 13) trimester = 'الثلث الأول (First Trimester)';
    else if (weeks < 27) trimester = 'الثلث الثاني (Second Trimester)';
    else trimester = 'الثلث الثالث (Third Trimester)';

    setResult({
      edd: eddDate.toLocaleDateString('ar-EG'),
      gestationalAge: `${weeks} أسبوع و ${days} يوم`,
      trimester
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
          title: 'حاسبة الحمل (EDD & GA)',
          result: `الموعد: ${result.edd} | العمر: ${result.gestationalAge}`,
          input_data: { lmp }
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
          <div className="p-2 bg-pink-100 text-pink-600 rounded-xl"><CalendarHeart className="w-5 h-5" /></div>
          <h2 className="text-xl font-black text-gray-800">حاسبة الحمل والولادة</h2>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-5">
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5">تاريخ أول يوم لآخر دورة شهرية (LMP)</label>
          <input type="date" value={lmp} onChange={e => setLmp(e.target.value)} className="w-full p-3.5 rounded-xl border bg-gray-50 focus:bg-white focus:border-pink-500 outline-none font-bold text-gray-800" />
        </div>
        <button onClick={calculatePregnancy} className="w-full bg-pink-500 text-white py-3.5 rounded-xl font-black text-lg hover:bg-pink-600 shadow-md active:scale-95 transition-all">احسب الموعد</button>
      </div>

      {result && (
        <div className="mt-6 p-6 rounded-[2rem] border-2 bg-pink-50 border-pink-200 shadow-sm animate-in slide-in-from-bottom-4">
          <div className="space-y-4 text-center">
            <div>
              <p className="text-xs font-bold text-gray-500">موعد الولادة المتوقع (EDD)</p>
              <h2 className="text-3xl font-black text-pink-600 mt-1">{result.edd}</h2>
            </div>
            <div className="border-t border-pink-100 pt-4">
              <p className="text-xs font-bold text-gray-500">عمر الجنين الحالي</p>
              <h3 className="text-2xl font-bold text-gray-800">{result.gestationalAge}</h3>
              <p className="text-sm font-bold text-pink-500 mt-1">{result.trimester}</p>
            </div>
          </div>
          
          <button onClick={saveResult} disabled={loading} className="mt-6 flex items-center justify-center gap-2 mx-auto text-sm bg-white hover:bg-pink-100 px-5 py-2.5 rounded-xl font-bold text-pink-700 transition-colors w-full border border-pink-100 shadow-sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            حفظ النتيجة
          </button>
        </div>
      )}
    </div>
  );
}
