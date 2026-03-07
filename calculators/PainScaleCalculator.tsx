import React, { useState } from 'react';
import { AlertCircle, ArrowRight, Frown, Meh, Smile, Save, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

interface Props { onBack?: () => void; }

export default function PainScaleCalculator({ onBack }: Props) {
  const [level, setLevel] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const scales = [
    { val: 0, text: 'لا يوجد', color: 'bg-green-500', icon: Smile, border: 'border-green-500', textC: 'text-green-600' },
    { val: 2, text: 'بسيط', color: 'bg-lime-500', icon: Smile, border: 'border-lime-500', textC: 'text-lime-600' },
    { val: 4, text: 'متوسط', color: 'bg-yellow-500', icon: Meh, border: 'border-yellow-500', textC: 'text-yellow-600' },
    { val: 6, text: 'مزعج', color: 'bg-orange-500', icon: Meh, border: 'border-orange-500', textC: 'text-orange-600' },
    { val: 8, text: 'شديد', color: 'bg-red-500', icon: Frown, border: 'border-red-500', textC: 'text-red-600' },
    { val: 10, text: 'لا يطاق', color: 'bg-red-800', icon: Frown, border: 'border-red-800', textC: 'text-red-800' },
  ];

  const saveResult = async () => {
    if (level === null) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول');
      const selected = scales.find(s => s.val === level);
      await supabase.from('saved_calculations').insert({
        user_id: user.id, title: 'مقياس الألم (VAS)',
        result: `الدرجة: ${level}/10 - ${selected?.text}`, input_data: { level }
      });
      toast.success('تم الحفظ بنجاح ✅');
    } catch (err: any) { toast.error(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center gap-3 mb-6">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50"><ArrowRight className="w-5 h-5 text-gray-600" /></button>}
        <div className="flex items-center gap-2">
          <div className="p-2 bg-red-100 text-red-600 rounded-xl"><AlertCircle className="w-5 h-5" /></div>
          <h2 className="text-xl font-black text-gray-800">مقياس تقييم الألم (VAS)</h2>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 text-center">
        <h2 className="text-lg font-black text-gray-700 mb-6">كيف تصف حدة الألم الآن؟</h2>
        
        <div className="grid grid-cols-3 gap-3 mb-4">
          {scales.map((s) => {
            const Icon = s.icon;
            const isSelected = level === s.val;
            return (
              <button 
                key={s.val} onClick={() => setLevel(s.val)}
                className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${isSelected ? `${s.border} bg-gray-50 scale-105 shadow-md` : 'border-gray-100 hover:bg-gray-50'}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white shadow-sm ${s.color}`}>
                   <Icon className="w-6 h-6"/>
                </div>
                <div className="flex flex-col items-center">
                  <span className={`font-black text-lg leading-none ${isSelected ? s.textC : 'text-gray-700'}`}>{s.val}</span>
                  <span className="text-[10px] font-bold text-gray-500 mt-1">{s.text}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {level !== null && (
         <div className="mt-6 p-6 bg-white rounded-[2rem] border border-gray-100 shadow-sm animate-in slide-in-from-bottom-4 text-center">
            <p className="text-gray-500 text-xs font-bold mb-1">التقييم المسجل</p>
            <h3 className="text-4xl font-black text-gray-800 mb-1">{level} <span className="text-lg text-gray-400">/ 10</span></h3>
            <p className={`text-sm font-black mb-4 ${scales.find(s => s.val === level)?.textC}`}>
               ({scales.find(s => s.val === level)?.text})
            </p>
            
            {level >= 6 && <div className="bg-red-50 text-red-700 p-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 mb-4 border border-red-100"><AlertCircle className="w-4 h-4"/> ينصح بمراجعة الطبيب أو أخذ مسكن فوراً.</div>}
            
            <button onClick={saveResult} disabled={loading} className="w-full flex items-center justify-center gap-2 text-sm bg-gray-800 text-white px-5 py-3 rounded-xl font-bold shadow-md hover:bg-gray-900 transition-colors">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ التقييم
            </button>
         </div>
      )}
    </div>
  );
}
