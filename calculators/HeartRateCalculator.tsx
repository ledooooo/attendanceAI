import React, { useState } from 'react';
import { ArrowRight, Save, Loader2, BookOpen, ExternalLink, Info } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

interface Props { onBack?: () => void; }

// ─── SVG Icon ─────────────────────────────────────────────────────────────────
const HeartRateIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
    <rect width="48" height="48" rx="14" fill="#FFF1F2"/>
    <path d="M24 36C24 36 11 28 11 19C11 14.5 14.5 11 19 11C21.5 11 23.5 12.2 24 13C24.5 12.2 26.5 11 29 11C33.5 11 37 14.5 37 19C37 28 24 36 24 36Z" fill="#FECDD3" stroke="#F43F5E" strokeWidth="1.5"/>
    <path d="M10 24H16L18 20L21 28L23 22L25 26L27 24H38" stroke="#E11D48" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ─── Zone visual bar ──────────────────────────────────────────────────────────
const ZoneBar = ({ maxHR, currentMin, currentMax, label, color }: any) => {
  const left = (currentMin / maxHR) * 100;
  const width = ((currentMax - currentMin) / maxHR) * 100;
  return (
    <div className="mt-1">
      <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
        <div style={{ left: `${left}%`, width: `${width}%`, backgroundColor: color }}
          className="absolute h-full rounded-full opacity-80" />
      </div>
    </div>
  );
};

const zones = [
  { name: 'الراحة التامة',       pctMin: 0,    pctMax: 0.50, color: '#94A3B8', benefit: 'تعافٍ نشط' },
  { name: 'حرق الدهون',          pctMin: 0.50, pctMax: 0.60, color: '#22C55E', benefit: '50–60%' },
  { name: 'نشاط هوائي متوسط',    pctMin: 0.60, pctMax: 0.70, color: '#84CC16', benefit: '60–70%' },
  { name: 'تحمّل قلبي وعائي',    pctMin: 0.70, pctMax: 0.80, color: '#F59E0B', benefit: '70–80%' },
  { name: 'لياقة عالية (Anaerobic)', pctMin: 0.80, pctMax: 0.90, color: '#F97316', benefit: '80–90%' },
  { name: 'أقصى جهد',            pctMin: 0.90, pctMax: 1.00, color: '#EF4444', benefit: '90–100%' },
];

export default function HeartRateCalculator({ onBack }: Props) {
  const [age, setAge] = useState('');
  const [method, setMethod] = useState<'simple' | 'karvonen'>('simple');
  const [restHR, setRestHR] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const calculate = () => {
    const a = parseInt(age);
    if (!a || a < 5 || a > 100) { toast.error('يرجى إدخال عمر صحيح (5–100)'); return; }

    const maxHR = 220 - a;
    let computedZones;

    if (method === 'karvonen') {
      const rhr = parseInt(restHR);
      if (!rhr || rhr < 30 || rhr > 120) { toast.error('يرجى إدخال معدل الراحة (30–120)'); return; }
      const hrr = maxHR - rhr; // Heart Rate Reserve
      computedZones = zones.map(z => ({
        ...z,
        min: Math.round(z.pctMin * hrr + rhr),
        max: Math.round(z.pctMax * hrr + rhr),
      }));
    } else {
      computedZones = zones.map(z => ({
        ...z,
        min: Math.round(z.pctMin * maxHR),
        max: Math.round(z.pctMax * maxHR),
      }));
    }

    setResult({ maxHR, zones: computedZones, age: a });
  };

  const saveResult = async () => {
    if (!result) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول');
      await supabase.from('saved_calculations').insert({
        user_id: user.id, title: 'نطاقات معدل نبضات القلب',
        result: `أقصى معدل: ${result.maxHR} نبضة/دقيقة — الطريقة: ${method === 'simple' ? 'بسيطة' : 'كارفونن'}`,
        input_data: { age, method, restHR }
      });
      toast.success('تم الحفظ ✅');
    } catch (err: any) { toast.error(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 duration-300 pb-10">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-5">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50"><ArrowRight className="w-5 h-5 text-gray-600" /></button>}
        <div className="flex items-center gap-3">
          <HeartRateIcon />
          <div>
            <h2 className="text-xl font-black text-gray-800">نبضات القلب المستهدفة</h2>
            <p className="text-xs text-gray-400 font-semibold">Target Heart Rate Zones</p>
          </div>
        </div>
      </div>

      {/* ── Info ── */}
      <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 mb-5 flex gap-3 text-rose-800">
        <Info className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
        <div className="text-xs leading-relaxed">
          <p className="font-bold mb-1">لماذا تعرف نطاقاتك؟</p>
          <p>كل نطاق لنبضات القلب يُحقق هدفاً مختلفاً: حرق الدهون يحتاج نطاقاً مختلفاً عن تقوية القلب والأوعية. معرفة نطاقك الدقيق يجعل تدريبك أكثر كفاءة وأماناً.</p>
        </div>
      </div>

      {/* ── Form ── */}
      <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-gray-100 space-y-4">

        {/* Method selector */}
        <div>
          <p className="text-xs font-black text-gray-500 mb-2">طريقة الحساب</p>
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button onClick={() => setMethod('simple')}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex flex-col items-center transition-all ${method === 'simple' ? 'bg-white shadow text-rose-600' : 'text-gray-500'}`}>
              <span>بسيطة</span>
              <span className="text-[9px] opacity-60">220 − العمر</span>
            </button>
            <button onClick={() => setMethod('karvonen')}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex flex-col items-center transition-all ${method === 'karvonen' ? 'bg-white shadow text-rose-600' : 'text-gray-500'}`}>
              <span>كارفونن</span>
              <span className="text-[9px] opacity-60">أدق (مع نبضات الراحة)</span>
            </button>
          </div>
        </div>

        <div className={`grid gap-3 ${method === 'karvonen' ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">العمر (سنة)</label>
            <input type="number" value={age} onChange={e => setAge(e.target.value)}
              className="w-full p-4 border bg-gray-50 focus:bg-white rounded-xl outline-none font-bold text-lg focus:border-rose-400"
              placeholder="30" />
          </div>
          {method === 'karvonen' && (
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5">نبضات الراحة</label>
              <input type="number" value={restHR} onChange={e => setRestHR(e.target.value)}
                className="w-full p-4 border bg-gray-50 focus:bg-white rounded-xl outline-none font-bold text-lg focus:border-rose-400"
                placeholder="65" />
            </div>
          )}
        </div>

        <button onClick={calculate}
          className="w-full bg-rose-600 text-white font-black py-3.5 rounded-xl hover:bg-rose-700 shadow-md active:scale-95 transition-all">
          احسب النطاقات
        </button>
      </div>

      {/* ── Result ── */}
      {result && (
        <div className="mt-5 space-y-3 animate-in slide-in-from-bottom-4">

          {/* Max HR */}
          <div className="bg-white p-5 rounded-2xl border text-center shadow-sm">
            <p className="text-gray-400 text-xs font-bold mb-1">أقصى معدل لضربات قلبك (HRmax)</p>
            <p className="text-5xl font-black text-rose-600">{result.maxHR} <span className="text-sm font-bold text-gray-400">نبضة/دقيقة</span></p>
            <p className="text-[10px] text-gray-400 mt-1 font-semibold">معادلة: 220 − {result.age}</p>
          </div>

          {/* Zone cards */}
          {result.zones.filter((z: any) => z.pctMin > 0).map((z: any, i: number) => (
            <div key={i} className="bg-white p-4 rounded-2xl border shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-black text-sm text-gray-800">{z.name}</p>
                  <p className="text-[10px] text-gray-400 font-semibold">{z.benefit} من HRmax</p>
                </div>
                <div className="text-left">
                  <p className="text-xl font-black" style={{ color: z.color }}>{z.min}–{z.max}</p>
                  <p className="text-[9px] text-gray-400 font-bold text-left">نبضة/دقيقة</p>
                </div>
              </div>
              <ZoneBar maxHR={result.maxHR} currentMin={z.min} currentMax={z.max} color={z.color} label={z.name} />
            </div>
          ))}

          <button onClick={saveResult} disabled={loading}
            className="w-full flex items-center justify-center gap-2 text-sm bg-white px-5 py-3.5 rounded-xl font-bold text-gray-800 hover:bg-gray-50 shadow-sm border">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ النتيجة
          </button>
        </div>
      )}

      {/* ── Sources ── */}
      <div className="mt-6 p-4 bg-gray-50 rounded-2xl border border-gray-100">
        <p className="flex items-center gap-1.5 text-xs font-black text-gray-600 mb-3"><BookOpen className="w-3.5 h-3.5"/> المصادر العلمية</p>
        <div className="space-y-2">
          {[
            { title: 'AHA — Target Heart Rates Chart', url: 'https://www.heart.org/en/healthy-living/fitness/fitness-basics/target-heart-rates' },
            { title: 'Karvonen M et al. — Heart rate method validation (1957)', url: 'https://pubmed.ncbi.nlm.nih.gov/13470504/' },
            { title: 'ACSM — Exercise Intensity Guidelines (2022)', url: 'https://www.acsm.org/education-resources/trending-topics-resources/physical-activity-guidelines' },
          ].map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-[10px] text-rose-600 font-semibold hover:underline">
              <ExternalLink className="w-3 h-3 shrink-0" />{s.title}
            </a>
          ))}
        </div>
      </div>

    </div>
  );
}
