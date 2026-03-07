import React, { useState } from 'react';
import { Activity, Save, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '../../supabaseClient'; // تأكد من صحة مسار ملف supabase
import toast from 'react-hot-toast';

interface Props {
  onBack?: () => void; // دالة للعودة للقائمة السابقة
}

export default function BMICalculator({ onBack }: Props) {
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const calculateBMI = () => {
    const w = parseFloat(weight);
    const h = parseFloat(height) / 100; // تحويل الطول إلى متر
    
    if (!w || !h || w <= 0 || h <= 0) {
      toast.error('يرجى إدخال قيم صحيحة للوزن والطول');
      return;
    }

    const bmi = (w / (h * h)).toFixed(1);
    let status = '';
    let color = '';
    let bgColor = '';

    if (Number(bmi) < 18.5) { 
      status = 'نحافة'; 
      color = 'text-blue-600'; 
      bgColor = 'bg-blue-50 border-blue-200'; 
    }
    else if (Number(bmi) < 25) { 
      status = 'وزن مثالي'; 
      color = 'text-emerald-600'; 
      bgColor = 'bg-emerald-50 border-emerald-200'; 
    }
    else if (Number(bmi) < 30) { 
      status = 'زيادة وزن'; 
      color = 'text-orange-600'; 
      bgColor = 'bg-orange-50 border-orange-200'; 
    }
    else { 
      status = 'سمنة'; 
      color = 'text-red-600'; 
      bgColor = 'bg-red-50 border-red-200'; 
    }

    setResult({ bmi, status, color, bgColor });
  };

  const saveResult = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول أولاً');

      if (result) {
        const { error } = await supabase.from('saved_calculations').insert({
          user_id: user.id,
          title: 'مؤشر كتلة الجسم (BMI)',
          result: `${result.bmi} - ${result.status}`,
          input_data: { weight, height }
        });
        
        if (error) throw error;
        toast.success('تم حفظ النتيجة في سجلك بنجاح ✅');
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'حدث خطأ أثناء الحفظ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 duration-300">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        {onBack && (
          <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50 transition-colors">
            <ArrowRight className="w-5 h-5 text-gray-600" />
          </button>
        )}
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
            <Activity className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-black text-gray-800">حاسبة كتلة الجسم (BMI)</h2>
        </div>
      </div>

      {/* Input Form */}
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-5">
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5">الوزن (كجم)</label>
          <input 
            type="number" 
            value={weight} 
            onChange={e => setWeight(e.target.value)} 
            className="w-full p-3.5 rounded-xl border bg-gray-50 focus:bg-white focus:border-blue-500 outline-none transition-all font-bold text-gray-800 text-lg" 
            placeholder="مثال: 75" 
          />
        </div>
        
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5">الطول (سم)</label>
          <input 
            type="number" 
            value={height} 
            onChange={e => setHeight(e.target.value)} 
            className="w-full p-3.5 rounded-xl border bg-gray-50 focus:bg-white focus:border-blue-500 outline-none transition-all font-bold text-gray-800 text-lg" 
            placeholder="مثال: 175" 
          />
        </div>

        <button 
          onClick={calculateBMI} 
          className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-black text-lg hover:bg-blue-700 shadow-md hover:shadow-blue-200 transition-all active:scale-95"
        >
          احسب النتيجة
        </button>
      </div>

      {/* Result Display */}
      {result && (
        <div className={`mt-6 p-6 rounded-[2rem] text-center border-2 shadow-sm animate-in slide-in-from-bottom-4 ${result.bgColor}`}>
          <p className="text-sm font-bold text-gray-500 mb-1">مؤشر الكتلة لديك هو</p>
          <h2 className={`text-6xl font-black my-2 ${result.color}`}>{result.bmi}</h2>
          <div className={`inline-block px-4 py-1.5 rounded-lg text-sm font-black text-white ${result.color.replace('text-', 'bg-')}`}>
            {result.status}
          </div>
          
          <button 
            onClick={saveResult} 
            disabled={loading} 
            className="mt-6 flex items-center justify-center gap-2 mx-auto text-sm bg-white/60 hover:bg-white px-5 py-2.5 rounded-xl font-bold text-gray-700 transition-colors w-full border border-white/50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {loading ? 'جاري الحفظ...' : 'حفظ النتيجة في السجل'}
          </button>
        </div>
      )}
    </div>
  );
}
