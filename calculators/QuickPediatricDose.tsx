import React, { useState } from 'react';
import { Syringe, ArrowRight, AlertOctagon, Info, Save, Loader2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';

interface Props { onBack?: () => void; }

export default function QuickPediatricDose({ onBack }: Props) {
  const [weight, setWeight] = useState('');
  const [drugType, setDrugType] = useState('paracetamol');
  const [loading, setLoading] = useState(false);
  
  const calculateDose = () => {
    const w = parseFloat(weight);
    if (!w) return null;

    if (drugType === 'paracetamol') {
      const min = Math.round(w * 10);
      const max = Math.round(w * 15);
      return {
        name: 'باراسيتامول (سيتال / بانادول)', min, max, freq: 'كل 4 إلى 6 ساعات', maxDaily: 'لا تزيد عن 5 جرعات يومياً',
        syrupInfo: `لشراب تركيز (120مجم/5مل) ⬅️ الجرعة: ${(min/24).toFixed(1)} مل إلى ${(max/24).toFixed(1)} مل`
      };
    }
    if (drugType === 'ibuprofen') {
      const min = Math.round(w * 5);
      const max = Math.round(w * 10);
      return {
        name: 'إيبوبروفين (بروفين / كونتافيفر)', min, max, freq: 'كل 6 إلى 8 ساعات', maxDaily: 'لا يستخدم تحت سن 6 شهور',
        syrupInfo: `لشراب تركيز (100مجم/5مل) ⬅️ الجرعة: ${(min/20).toFixed(1)} مل إلى ${(max/20).toFixed(1)} مل`
      };
    }
    if (drugType === 'amoxicillin') {
      const minDaily = Math.round(w * 25);
      const maxDaily = Math.round(w * 50);
      return {
        name: 'أموكسيسيلين (مضاد حيوي)', min: minDaily, max: maxDaily, freq: 'تقسم الجرعة المكتوبة أعلاه على 2 أو 3 مرات يومياً', maxDaily: 'الجرعة المحسوبة هي "لليوم الكامل"',
        syrupInfo: `لشراب تركيز (250مجم/5مل) ⬅️ الإجمالي اليومي: ${(minDaily/50).toFixed(1)} مل إلى ${(maxDaily/50).toFixed(1)} مل`
      };
    }
  };

  const result = calculateDose();

  const saveResult = async () => {
    if (!result) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول');
      await supabase.from('saved_calculations').insert({
        user_id: user.id, title: `جرعة ${result.name.split(' ')[0]}`,
        result: `${result.min}-${result.max} مجم | ${result.syrupInfo.split('⬅️')[1]}`, input_data: { weight, drugType }
      });
      toast.success('تم الحفظ بنجاح ✅');
    } catch (err: any) { toast.error(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center gap-3 mb-6">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50"><ArrowRight className="w-5 h-5 text-gray-600" /></button>}
        <div className="flex items-center gap-2">
          <div className="p-2 bg-orange-100 text-orange-600 rounded-xl"><Syringe className="w-5 h-5" /></div>
          <h2 className="text-xl font-black text-gray-800">الجرعات السريعة للأطفال</h2>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
        <div className="bg-orange-50 p-3 rounded-xl border border-orange-100 mb-5 flex gap-3">
           <AlertOctagon className="w-6 h-6 text-orange-500 shrink-0"/>
           <p className="text-[10px] text-orange-800 font-bold leading-relaxed">
             تنبيه: هذه الحاسبة استرشادية للرعاية الأولية. يجب التأكد من "تركيز الدواء" المكتوب على العلبة لأن التركيزات تختلف.
           </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">وزن الطفل (كجم)</label>
            <input type="number" value={weight} onChange={e=>setWeight(e.target.value)} className="w-full p-3.5 border bg-gray-50 focus:bg-white rounded-xl outline-none focus:border-orange-500 font-bold text-gray-800" placeholder="مثال: 12" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">الدواء الشائع</label>
            <select value={drugType} onChange={e=>setDrugType(e.target.value)} className="w-full p-3.5 border bg-gray-50 focus:bg-white rounded-xl outline-none focus:border-orange-500 font-bold text-gray-800">
              <option value="paracetamol">باراسيتامول (خافض للحرارة آمن)</option>
              <option value="ibuprofen">إيبوبروفين (مسكن ومضاد التهاب)</option>
              <option value="amoxicillin">أموكسيسيلين (مضاد حيوي)</option>
            </select>
          </div>
        </div>
      </div>

      {result && weight && (
        <div className="mt-6 space-y-3 animate-in slide-in-from-bottom-4">
          <div className="bg-gradient-to-l from-blue-600 to-indigo-600 text-white p-6 rounded-[2rem] text-center shadow-lg shadow-blue-200 border-2 border-blue-400">
            <p className="text-blue-100 text-xs font-bold mb-1">الجرعة الفعالة الموصى بها</p>
            <p className="text-4xl font-black mb-1 dir-ltr">{result.min} - {result.max} <span className="text-lg font-bold">mg</span></p>
            <p className="text-[10px] font-bold bg-white/20 inline-block px-3 py-1 rounded-lg mt-1">{result.freq}</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <p className="font-black text-gray-800 flex items-center gap-1.5 mb-3 text-sm">
              <Info className="w-4 h-4 text-blue-500"/> مثال تطبيقي للأدوية الشراب:
            </p>
            <p className="text-gray-600 text-xs font-bold leading-relaxed bg-gray-50 p-3 rounded-xl border border-gray-100 mb-3">{result.syrupInfo}</p>
            <p className="text-[10px] text-red-500 font-bold flex items-center gap-1"><AlertOctagon className="w-3 h-3"/> {result.maxDaily}</p>
          </div>

          <button onClick={saveResult} disabled={loading} className="w-full flex items-center justify-center gap-2 text-sm bg-white px-5 py-3.5 rounded-xl font-bold text-gray-800 hover:bg-gray-50 shadow-sm border transition-colors">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ الجرعة في السجل
          </button>
        </div>
      )}
    </div>
  );
}
