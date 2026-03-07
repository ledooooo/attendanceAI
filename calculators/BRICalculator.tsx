import React, { useState } from 'react';
import { Activity, ArrowRight, Info, Save, Loader2, BookOpen, ExternalLink } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

interface Props { onBack?: () => void; }

// ─── SVG Icon ─────────────────────────────────────────────────────────────────
const BRIIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
    <rect width="48" height="48" rx="14" fill="#ECFEFF"/>
    <ellipse cx="24" cy="28" rx="12" ry="8" fill="#A5F3FC" stroke="#06B6D4" strokeWidth="1.5"/>
    <ellipse cx="24" cy="28" rx="7" ry="4.5" fill="#CFFAFE" stroke="#06B6D4" strokeWidth="1"/>
    <path d="M17 22C17 17.582 20.134 14 24 14C27.866 14 31 17.582 31 22" stroke="#0891B2" strokeWidth="1.8" strokeLinecap="round"/>
    <path d="M20 22C20 19.239 21.791 17 24 17C26.209 17 28 19.239 28 22" stroke="#22D3EE" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

// ─── Gauge ────────────────────────────────────────────────────────────────────
const BRIGauge = ({ value }: { value: number }) => {
  const clamp = Math.min(Math.max(value, 1), 13);
  const pct = ((clamp - 1) / 12) * 100;
  return (
    <div className="mt-3 mb-1">
      <div className="flex rounded-full overflow-hidden h-3">
        <div style={{ width: '18%', backgroundColor: '#3B82F6' }} />
        <div style={{ width: '17%', backgroundColor: '#10B981' }} />
        <div style={{ width: '17%', backgroundColor: '#22C55E' }} />
        <div style={{ width: '17%', backgroundColor: '#F59E0B' }} />
        <div style={{ width: '17%', backgroundColor: '#F97316' }} />
        <div style={{ width: '14%', backgroundColor: '#EF4444' }} />
      </div>
      <div className="relative h-3">
        <div style={{ left: `${Math.min(pct, 96)}%` }} className="absolute -top-4 transform -translate-x-1/2">
          <div className="w-3 h-3 bg-gray-800 rotate-45 rounded-sm" />
        </div>
      </div>
      <div className="flex mt-2 text-center">
        {[{ l: 'نحيف', c: '#3B82F6' }, { l: 'طبيعي', c: '#10B981' }, { l: 'صحي', c: '#22C55E' }, { l: 'متوسط', c: '#F59E0B' }, { l: 'مرتفع', c: '#F97316' }, { l: 'خطر', c: '#EF4444' }].map((s, i) => (
          <div key={i} className="flex-1">
            <div className="text-[8px] font-bold" style={{ color: s.c }}>{s.l}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function BRICalculator({ onBack }: Props) {
  const [height, setHeight] = useState('');
  const [waist, setWaist] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const calculate = () => {
    const h = parseFloat(height) / 100;
    const w = parseFloat(waist) / 100;
    if (!h || !w) { toast.error('يرجى إدخال الطول ومحيط الخصر'); return; }

    const numerator = Math.pow(w / (2 * Math.PI), 2);
    const denominator = Math.pow(0.5 * h, 2);
    const term = 1 - (numerator / denominator);
    if (term < 0) { toast.error('الأرقام المدخلة غير منطقية — تحقق من محيط الخصر'); return; }

    const bri = parseFloat((364.2 - 365.5 * Math.sqrt(term)).toFixed(2));
    let status = '', color = '', bg = '', tip = '';

    if (bri < 3) {
      status = 'جسم نحيف جداً'; color = 'text-blue-600'; bg = 'bg-blue-50 border-blue-200';
      tip = 'نسبة دهون الجسم منخفضة جداً. قد يستدعي ذلك تقييماً غذائياً.';
    } else if (bri <= 4) {
      status = 'شكل جسم طبيعي'; color = 'text-green-600'; bg = 'bg-green-50 border-green-200';
      tip = 'توزيع الدهون الحشوية طبيعي. استمر بنمط حياة صحي.';
    } else if (bri <= 5) {
      status = 'وزن صحي (حد أعلى)'; color = 'text-emerald-600'; bg = 'bg-emerald-50 border-emerald-200';
      tip = 'لا تزال ضمن النطاق الصحي لكن يُنصح بمراقبة الخصر.';
    } else if (bri <= 6) {
      status = 'استدارة متوسطة'; color = 'text-orange-500'; bg = 'bg-orange-50 border-orange-200';
      tip = 'ارتفاع طفيف في الدهون الحشوية. يُنصح بزيادة النشاط البدني.';
    } else if (bri <= 7) {
      status = 'دهون حشوية مرتفعة'; color = 'text-orange-600'; bg = 'bg-orange-50 border-orange-200';
      tip = 'خطر صحي متوسط. يُنصح باستشارة طبيب ووضع خطة غذائية.';
    } else {
      status = 'استدارة عالية — خطر صحي'; color = 'text-red-600'; bg = 'bg-red-50 border-red-200';
      tip = 'مستوى دهون حشوية مرتفع جداً. يستوجب تدخلاً طبياً وتغييراً في نمط الحياة.';
    }

    setResult({ val: bri, status, color, bg, tip });
  };

  const saveResult = async () => {
    if (!result) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول');
      await supabase.from('saved_calculations').insert({
        user_id: user.id, title: 'مؤشر استدارة الجسم (BRI)',
        result: `${result.val} — ${result.status}`, input_data: { height, waist }
      });
      toast.success('تم الحفظ بنجاح ✅');
    } catch (err: any) { toast.error(err.message); } finally { setLoading(false); }
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
          <BRIIcon />
          <div>
            <h2 className="text-xl font-black text-gray-800">مؤشر استدارة الجسم</h2>
            <p className="text-xs text-gray-400 font-semibold">Body Roundness Index — BRI</p>
          </div>
        </div>
      </div>

      {/* ── Info ── */}
      <div className="bg-cyan-50 p-4 rounded-2xl border border-cyan-100 mb-5 flex gap-3 text-cyan-800">
        <Info className="w-5 h-5 shrink-0 mt-0.5 text-cyan-500" />
        <div className="text-xs leading-relaxed">
          <p className="font-bold mb-1">لماذا BRI أدق من BMI؟</p>
          <p>على عكس مؤشر كتلة الجسم، يعتمد BRI على محيط الخصر لتقدير نسبة الدهون الحشوية المحيطة بالأعضاء الداخلية — وهي الأخطر صحياً — بصرف النظر عن الوزن الكلي.</p>
        </div>
      </div>

      {/* ── Form ── */}
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">الطول (سم)</label>
            <input type="number" value={height} onChange={e => setHeight(e.target.value)}
              className="w-full p-3.5 border bg-gray-50 focus:bg-white rounded-xl outline-none focus:border-cyan-500 font-bold"
              placeholder="175" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">محيط الخصر (سم)</label>
            <input type="number" value={waist} onChange={e => setWaist(e.target.value)}
              className="w-full p-3.5 border bg-gray-50 focus:bg-white rounded-xl outline-none focus:border-cyan-500 font-bold"
              placeholder="85" />
          </div>
        </div>
        <p className="text-[10px] text-gray-400 font-semibold">📍 قِس محيط الخصر عند أعلى نقطة من عظمة الحوض، بعد زفير طبيعي.</p>
        <button onClick={calculate}
          className="w-full bg-cyan-600 text-white font-black py-3.5 rounded-xl hover:bg-cyan-700 shadow-md active:scale-95 transition-all">
          احسب المؤشر
        </button>
      </div>

      {/* ── Result ── */}
      {result && (
        <div className={`mt-5 p-6 rounded-[2rem] border-2 shadow-sm animate-in slide-in-from-bottom-4 text-center ${result.bg}`}>
          <p className="text-xs text-gray-400 font-bold mb-1">قيمة المؤشر</p>
          <p className={`text-5xl font-black mb-1 ${result.color}`}>{result.val}</p>
          <p className={`text-sm font-black bg-white/60 inline-block px-4 py-1 rounded-lg ${result.color}`}>{result.status}</p>
          <BRIGauge value={result.val} />
          <p className="text-xs text-gray-600 bg-white/50 p-3 rounded-xl font-semibold leading-relaxed mt-2">{result.tip}</p>
          <button onClick={saveResult} disabled={loading}
            className="mt-4 w-full flex items-center justify-center gap-2 text-sm bg-white px-5 py-3 rounded-xl font-bold text-gray-800 shadow-sm border hover:bg-gray-50">
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
            { title: 'Thomas DM et al. — A novel body roundness index for measuring obesity (2013)', url: 'https://pubmed.ncbi.nlm.nih.gov/23499980/' },
            { title: 'Evaluation of BRI as obesity screening tool — PubMed', url: 'https://pubmed.ncbi.nlm.nih.gov/36450323/' },
            { title: 'WHO — Waist circumference and waist-hip ratio guidelines', url: 'https://www.who.int/publications/i/item/9789241501491' },
          ].map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-[10px] text-cyan-600 font-semibold hover:underline">
              <ExternalLink className="w-3 h-3 shrink-0" />{s.title}
            </a>
          ))}
        </div>
      </div>

    </div>
  );
}
