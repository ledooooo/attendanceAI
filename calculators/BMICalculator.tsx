import React, { useState } from 'react';
import { Activity, Save, ArrowRight, Loader2, Info, BookOpen, ExternalLink } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

interface Props {
  onBack?: () => void;
}

// ─── SVG Icon ────────────────────────────────────────────────────────────────
const BMIIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
    <rect width="48" height="48" rx="14" fill="#EFF6FF"/>
    <path d="M24 10C18.477 10 14 14.477 14 20C14 23.5 15.8 26.6 18.5 28.4L17 38H31L29.5 28.4C32.2 26.6 34 23.5 34 20C34 14.477 29.523 10 24 10Z" fill="#BFDBFE" stroke="#3B82F6" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M20 20H28M24 16V24" stroke="#2563EB" strokeWidth="1.8" strokeLinecap="round"/>
    <path d="M19 33H29" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M20 36H28" stroke="#93C5FD" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

// ─── BMI Scale Visual ─────────────────────────────────────────────────────────
const BMIScale = ({ bmi }: { bmi: number }) => {
  const segments = [
    { label: 'نحافة', range: '< 18.5', color: '#3B82F6', width: 20 },
    { label: 'مثالي', range: '18.5–24.9', color: '#10B981', width: 25 },
    { label: 'زيادة', range: '25–29.9', color: '#F59E0B', width: 25 },
    { label: 'سمنة', range: '≥ 30', color: '#EF4444', width: 30 },
  ];
  const clampedBmi = Math.min(Math.max(bmi, 10), 45);
  const pct = ((clampedBmi - 10) / 35) * 100;

  return (
    <div className="mt-4 mb-2">
      <div className="flex rounded-full overflow-hidden h-3 mb-1">
        {segments.map((s, i) => (
          <div key={i} style={{ width: `${s.width}%`, backgroundColor: s.color }} />
        ))}
      </div>
      <div className="relative h-3">
        <div style={{ left: `${Math.min(pct, 97)}%` }} className="absolute -top-4 transform -translate-x-1/2">
          <div className="w-3 h-3 bg-gray-800 rotate-45 rounded-sm" />
        </div>
      </div>
      <div className="flex mt-2">
        {segments.map((s, i) => (
          <div key={i} style={{ width: `${s.width}%` }} className="text-center">
            <div className="text-[8px] font-bold" style={{ color: s.color }}>{s.label}</div>
            <div className="text-[7px] text-gray-400">{s.range}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function BMICalculator({ onBack }: Props) {
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const calculateBMI = () => {
    const w = parseFloat(weight);
    const h = parseFloat(height) / 100;
    if (!w || !h || w <= 0 || h <= 0) { toast.error('يرجى إدخال قيم صحيحة'); return; }

    const bmi = parseFloat((w / (h * h)).toFixed(1));
    let status = '', color = '', bgColor = '', tip = '';

    if (bmi < 18.5) {
      status = 'نحافة'; color = 'text-blue-600'; bgColor = 'bg-blue-50 border-blue-200';
      tip = 'يُنصح بزيادة السعرات الحرارية وتناول وجبات متوازنة غنية بالبروتين.';
    } else if (bmi < 25) {
      status = 'وزن مثالي'; color = 'text-emerald-600'; bgColor = 'bg-emerald-50 border-emerald-200';
      tip = 'وزنك مثالي! حافظ على نمط حياة صحي ونشاط بدني منتظم.';
    } else if (bmi < 30) {
      status = 'زيادة وزن'; color = 'text-orange-600'; bgColor = 'bg-orange-50 border-orange-200';
      tip = 'يُنصح بتقليل السعرات الحرارية وممارسة الرياضة 150 دقيقة أسبوعياً.';
    } else {
      status = 'سمنة'; color = 'text-red-600'; bgColor = 'bg-red-50 border-red-200';
      tip = 'يُنصح باستشارة الطبيب لوضع خطة علاجية شاملة للتحكم في الوزن.';
    }

    setResult({ bmi, status, color, bgColor, tip });
  };

  const saveResult = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول أولاً');
      const { error } = await supabase.from('saved_calculations').insert({
        user_id: user.id, title: 'مؤشر كتلة الجسم (BMI)',
        result: `${result.bmi} - ${result.status}`, input_data: { weight, height }
      });
      if (error) throw error;
      toast.success('تم حفظ النتيجة ✅');
    } catch (error: any) {
      toast.error(error.message || 'حدث خطأ أثناء الحفظ');
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 duration-300 pb-10">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-6">
        {onBack && (
          <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50">
            <ArrowRight className="w-5 h-5 text-gray-600" />
          </button>
        )}
        <div className="flex items-center gap-3">
          <BMIIcon />
          <div>
            <h2 className="text-xl font-black text-gray-800">حاسبة كتلة الجسم</h2>
            <p className="text-xs text-gray-400 font-semibold">Body Mass Index — BMI</p>
          </div>
        </div>
      </div>

      {/* ── Info Box ── */}
      <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 mb-5 flex gap-3 text-blue-800">
        <Info className="w-5 h-5 shrink-0 mt-0.5 text-blue-500" />
        <div className="text-xs leading-relaxed">
          <p className="font-bold mb-1">ما هو مؤشر كتلة الجسم؟</p>
          <p>مقياس عالمي يحسب العلاقة بين الوزن والطول لتصنيف حالة الوزن. يُستخدم كأداة فرز أولية، وليس تشخيصاً نهائياً — إذ لا يأخذ بالاعتبار توزيع الدهون أو كتلة العضلات.</p>
        </div>
      </div>

      {/* ── Form ── */}
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">الوزن (كجم)</label>
            <input type="number" value={weight} onChange={e => setWeight(e.target.value)}
              className="w-full p-3.5 rounded-xl border bg-gray-50 focus:bg-white focus:border-blue-500 outline-none font-bold text-gray-800 text-lg"
              placeholder="75" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">الطول (سم)</label>
            <input type="number" value={height} onChange={e => setHeight(e.target.value)}
              className="w-full p-3.5 rounded-xl border bg-gray-50 focus:bg-white focus:border-blue-500 outline-none font-bold text-gray-800 text-lg"
              placeholder="175" />
          </div>
        </div>
        <button onClick={calculateBMI}
          className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-black text-base hover:bg-blue-700 shadow-md transition-all active:scale-95">
          احسب النتيجة
        </button>
      </div>

      {/* ── Result ── */}
      {result && (
        <div className={`mt-5 p-6 rounded-[2rem] text-center border-2 shadow-sm animate-in slide-in-from-bottom-4 ${result.bgColor}`}>
          <p className="text-xs font-bold text-gray-400 mb-1">مؤشر الكتلة</p>
          <h2 className={`text-6xl font-black my-1 ${result.color}`}>{result.bmi}</h2>
          <div className={`inline-block px-4 py-1 rounded-lg text-sm font-black ${result.color} bg-white/60 mb-1`}>
            {result.status}
          </div>
          <BMIScale bmi={result.bmi} />
          <p className="text-xs text-gray-600 bg-white/50 p-3 rounded-xl font-semibold leading-relaxed mt-2">{result.tip}</p>
          <button onClick={saveResult} disabled={loading}
            className="mt-4 flex items-center justify-center gap-2 mx-auto w-full text-sm bg-white/70 hover:bg-white px-5 py-2.5 rounded-xl font-bold text-gray-700 transition-colors border border-white/50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {loading ? 'جاري الحفظ...' : 'حفظ النتيجة'}
          </button>
        </div>
      )}

      {/* ── Sources ── */}
      <div className="mt-6 p-4 bg-gray-50 rounded-2xl border border-gray-100">
        <p className="flex items-center gap-1.5 text-xs font-black text-gray-600 mb-3"><BookOpen className="w-3.5 h-3.5"/> المصادر العلمية</p>
        <div className="space-y-2">
          {[
            { title: 'WHO — Body Mass Index Classification', url: 'https://www.who.int/data/nutrition/nlis/info/body-mass-index-(bmi)' },
            { title: 'NIH — Understanding BMI', url: 'https://www.nhlbi.nih.gov/health/educational/lose_wt/BMI/bmicalc.htm' },
            { title: 'CDC — About BMI', url: 'https://www.cdc.gov/bmi/adult-calculator/bmi-categories.html' },
          ].map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-[10px] text-blue-600 font-semibold hover:underline">
              <ExternalLink className="w-3 h-3 shrink-0" />{s.title}
            </a>
          ))}
        </div>
      </div>

    </div>
  );
}
