import React, { useState } from 'react';
import { Activity, ArrowRight, AlertTriangle, Save, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

interface Props { onBack?: () => void; }

export default function OsteoporosisCalculator({ onBack }: Props) {
  const [checks, setChecks] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const factors = [
    { id: 1, text: 'هل سبق أن تعرض أحد والديك لكسر في الفخذ؟' },
    { id: 2, text: 'هل تعرضت لكسر بعد سقوط بسيط؟' },
    { id: 3, text: 'هل تتناول الكورتيزون لأكثر من 3 شهور؟' },
    { id: 4, text: 'هل تدخن حالياً؟' },
    { id: 5, text: 'هل تعاني من التهاب المفاصل الروماتويدي؟' },
    { id: 6, text: 'هل تتناول الكحوليات بانتظام؟' },
    { id: 7, text: '(للنساء) هل انقطع الطمث قبل سن 45؟' },
    { id: 8, text: '(للرجال) هل تعاني من نقص التستوستيرون؟' },
  ];

  const toggle = (id: number) => {
    if (checks.includes(id)) setChecks(checks.filter(c => c !== id));
    else setChecks([...checks, id]);
    setIsSaved(false); // Reset save state on change
  };

  const saveResult = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول أولاً');
      
      const riskStatus = checks.length === 0 ? 'لا توجد عوامل خطر' : `يوجد ${checks.length} عوامل خطر`;
      
      await supabase.from('saved_calculations').insert({
        user_id: user.id,
        title: 'مخاطر هشاشة العظام (IOF)',
        result: riskStatus,
        input_data: { riskFactorsCount: checks.length }
      });
      toast.success('تم الحفظ بنجاح ✅');
      setIsSaved(true);
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
          <div className="p-2 bg-blue-100 text-blue-600 rounded-xl"><Activity className="w-5 h-5" /></div>
          <h2 className="text-xl font-black text-gray-800">مخاطر هشاشة العظام</h2>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
        <p className="text-gray-500 mb-4 text-xs font-bold bg-gray-50 p-3 rounded-xl border border-gray-100">حدد "نعم" على الأسئلة التي تنطبق عليك:</p>
        
        <div className="space-y-2 mb-6 max-h-[45vh] overflow-y-auto custom-scrollbar pr-1">
          {factors.map(f => (
            <label key={f.id} className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${checks.includes(f.id) ? 'bg-blue-50 border-blue-500 text-blue-800 shadow-sm' : 'bg-white border-gray-100 hover:bg-gray-50 text-gray-700'}`}>
              <input type="checkbox" checked={checks.includes(f.id)} onChange={() => toggle(f.id)} className="w-4 h-4 accent-blue-600" />
              <span className="font-bold text-xs leading-relaxed">{f.text}</span>
            </label>
          ))}
        </div>

        <div className={`p-5 rounded-2xl text-center border-2 transition-all ${checks.length === 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
           <p className="text-xs text-gray-500 mb-1 font-bold">النتيجة والتقييم</p>
           {checks.length === 0 ? (
             <p className="text-green-600 font-black text-lg">لا توجد عوامل خطر واضحة حالياً ✅</p>
           ) : (
             <div>
                <p className="text-red-600 font-black text-lg mb-2 flex items-center justify-center gap-1.5"><AlertTriangle className="w-5 h-5"/> لديك {checks.length} عوامل خطر!</p>
                <p className="text-red-800 text-[10px] font-bold leading-relaxed">وجود عامل واحد أو أكثر يعني ضرورة استشارة الطبيب لإجراء فحص كثافة العظام (DEXA).</p>
             </div>
           )}
        </div>

        <button onClick={saveResult} disabled={loading || isSaved} className={`mt-4 w-full flex items-center justify-center gap-2 text-sm px-5 py-3.5 rounded-xl font-bold transition-all shadow-md active:scale-95 ${isSaved ? 'bg-green-100 text-green-700 cursor-not-allowed' : 'bg-gray-800 text-white hover:bg-gray-900'}`}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 
          {isSaved ? 'تم الحفظ في السجل' : 'حفظ النتيجة'}
        </button>
      </div>
    </div>
  );
}
