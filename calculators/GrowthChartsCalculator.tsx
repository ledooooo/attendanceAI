import React, { useState } from 'react';
import { ArrowRight, Save, Loader2, BookOpen, ExternalLink, Info, AlertCircle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

interface Props { onBack?: () => void; }

// ─── SVG Icon ─────────────────────────────────────────────────────────────────
const GrowthIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
    <rect width="48" height="48" rx="14" fill="#FFF7ED"/>
    {/* Child silhouette */}
    <circle cx="24" cy="13" r="4.5" fill="#FED7AA" stroke="#F97316" strokeWidth="1.3"/>
    <path d="M18 22C18 19.239 20.686 17 24 17C27.314 17 30 19.239 30 22V28H18V22Z" fill="#FDBA74" stroke="#F97316" strokeWidth="1.3"/>
    <path d="M18 28L16 36M30 28L32 36" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round"/>
    {/* Growth arrow */}
    <path d="M35 34L35 14M35 14L32 17M35 14L38 17" stroke="#22C55E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    {/* Ruler marks */}
    <path d="M33 20H35M33 24H35M33 28H35M33 32H35" stroke="#22C55E" strokeWidth="1" strokeLinecap="round"/>
  </svg>
);

// ─── WHO Growth Standards (50th percentile) ──────────────────────────────────
// Extended data with more age points for better accuracy
const standards: Record<string, Record<number, { w: number; l: number; wSD: number; lSD: number }>> = {
  boy: {
    0:  { w: 3.3,  l: 49.9, wSD: 0.44, lSD: 1.9 },
    1:  { w: 4.5,  l: 54.7, wSD: 0.52, lSD: 1.9 },
    2:  { w: 5.6,  l: 58.4, wSD: 0.62, lSD: 2.0 },
    3:  { w: 6.4,  l: 61.4, wSD: 0.65, lSD: 2.0 },
    4:  { w: 7.0,  l: 63.9, wSD: 0.67, lSD: 2.0 },
    5:  { w: 7.5,  l: 65.9, wSD: 0.68, lSD: 2.1 },
    6:  { w: 7.9,  l: 67.6, wSD: 0.73, lSD: 2.2 },
    9:  { w: 8.9,  l: 72.0, wSD: 0.84, lSD: 2.4 },
    12: { w: 9.6,  l: 75.7, wSD: 0.95, lSD: 2.6 },
    15: { w: 10.3, l: 79.1, wSD: 1.03, lSD: 2.7 },
    18: { w: 10.9, l: 82.3, wSD: 1.10, lSD: 2.8 },
    24: { w: 12.2, l: 87.8, wSD: 1.21, lSD: 3.0 },
    30: { w: 13.3, l: 92.7, wSD: 1.30, lSD: 3.2 },
    36: { w: 14.3, l: 96.1, wSD: 1.39, lSD: 3.4 },
    48: { w: 16.3, l: 103.3, wSD: 1.60, lSD: 3.7 },
    60: { w: 18.3, l: 110.0, wSD: 1.82, lSD: 4.0 },
  },
  girl: {
    0:  { w: 3.2,  l: 49.1, wSD: 0.40, lSD: 1.9 },
    1:  { w: 4.2,  l: 53.7, wSD: 0.48, lSD: 1.9 },
    2:  { w: 5.1,  l: 57.1, wSD: 0.56, lSD: 2.0 },
    3:  { w: 5.8,  l: 59.8, wSD: 0.60, lSD: 2.0 },
    4:  { w: 6.4,  l: 62.1, wSD: 0.63, lSD: 2.0 },
    5:  { w: 6.9,  l: 64.0, wSD: 0.65, lSD: 2.1 },
    6:  { w: 7.3,  l: 65.7, wSD: 0.69, lSD: 2.2 },
    9:  { w: 8.2,  l: 70.1, wSD: 0.79, lSD: 2.4 },
    12: { w: 8.9,  l: 74.0, wSD: 0.90, lSD: 2.6 },
    15: { w: 9.6,  l: 77.5, wSD: 0.98, lSD: 2.7 },
    18: { w: 10.2, l: 80.7, wSD: 1.05, lSD: 2.8 },
    24: { w: 11.5, l: 86.4, wSD: 1.16, lSD: 3.0 },
    30: { w: 12.7, l: 91.4, wSD: 1.26, lSD: 3.2 },
    36: { w: 13.9, l: 95.1, wSD: 1.35, lSD: 3.4 },
    48: { w: 16.1, l: 102.7, wSD: 1.57, lSD: 3.7 },
    60: { w: 18.2, l: 109.4, wSD: 1.80, lSD: 4.0 },
  },
};

const getZScore = (val: number, median: number, sd: number) => ((val - median) / sd).toFixed(1);

const getPercentile = (z: number) => {
  if (z <= -3) return '< 1';
  if (z <= -2) return '2–3';
  if (z <= -1) return '16';
  if (z <= 0)  return '50';
  if (z <= 1)  return '84';
  if (z <= 2)  return '97–98';
  return '> 99';
};

const statusConfig = (zScore: number) => {
  if (zScore < -3) return { label: 'نحافة شديدة / قصر شديد', color: 'text-red-700', bg: 'bg-red-50 border-red-200', flag: true };
  if (zScore < -2) return { label: 'أقل من المعدل', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', flag: false };
  if (zScore < -1) return { label: 'في النطاق الطبيعي (حد أدنى)', color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200', flag: false };
  if (zScore <= 1) return { label: 'طبيعي ومثالي', color: 'text-green-700', bg: 'bg-green-50 border-green-200', flag: false };
  if (zScore <= 2) return { label: 'أعلى من المعدل', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', flag: false };
  return { label: 'وزن مرتفع جداً', color: 'text-red-600', bg: 'bg-red-50 border-red-200', flag: true };
};

export default function GrowthChartsCalculator({ onBack }: Props) {
  const [gender, setGender] = useState('boy');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [length, setLength] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const calculate = () => {
    const a = parseInt(age);
    const w = parseFloat(weight);
    if (!a || !w || a < 0 || a > 60) { toast.error('يرجى إدخال عمر صحيح (0–60 شهراً) والوزن'); return; }

    const ageKeys = Object.keys(standards[gender]).map(Number);
    const closestAge = ageKeys.reduce((prev, curr) => Math.abs(curr - a) < Math.abs(prev - a) ? curr : prev);
    const std = standards[gender][closestAge];

    const wZ = parseFloat(getZScore(w, std.w, std.wSD));
    const wStatus = statusConfig(wZ);

    let lResult = null;
    const l = parseFloat(length);
    if (l && l > 0) {
      const lZ = parseFloat(getZScore(l, std.l, std.lSD));
      lResult = { lZ, status: statusConfig(lZ), stdL: std.l };
    }

    setResult({ stdW: std.w, stdL: std.l, wZ, wStatus, lResult, closestAge, ageInput: a });
  };

  const saveResult = async () => {
    if (!result) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول أولاً');
      await supabase.from('saved_calculations').insert({
        user_id: user.id, title: 'منحنيات النمو (WHO)',
        result: `${age} شهر — الوزن: ${result.wStatus.label} (Z: ${result.wZ})`,
        input_data: { age, weight, length, gender }
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
          <GrowthIcon />
          <div>
            <h2 className="text-xl font-black text-gray-800">منحنيات النمو (WHO)</h2>
            <p className="text-xs text-gray-400 font-semibold">Child Growth Standards — 0 to 5 years</p>
          </div>
        </div>
      </div>

      {/* ── Info ── */}
      <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 mb-5 flex gap-3 text-orange-800">
        <Info className="w-5 h-5 shrink-0 mt-0.5 text-orange-400" />
        <div className="text-xs leading-relaxed">
          <p className="font-bold mb-1">معايير WHO للنمو</p>
          <p>تُقارن قياسات الطفل (وزن وطول) بالمعدل العالمي للأطفال الأصحاء من نفس العمر والجنس. تُستخدم Z-Score والنسب المئوية لتصنيف النمو بدقة.</p>
        </div>
      </div>

      {/* ── Form ── */}
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-4">
        <div className="flex bg-gray-100 p-1.5 rounded-xl">
          <button onClick={() => setGender('boy')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${gender === 'boy' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}>👦 ولد</button>
          <button onClick={() => setGender('girl')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${gender === 'girl' ? 'bg-white shadow-sm text-pink-600' : 'text-gray-500'}`}>👧 بنت</button>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5">عمر الطفل (بالشهور) — 0 إلى 60</label>
          <input type="number" value={age} onChange={e => setAge(e.target.value)}
            className="w-full p-3.5 border bg-gray-50 focus:bg-white rounded-xl outline-none font-bold focus:border-orange-400"
            placeholder="مثال: 12" min="0" max="60" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">الوزن (كجم) *</label>
            <input type="number" value={weight} onChange={e => setWeight(e.target.value)}
              className="w-full p-3.5 border bg-gray-50 focus:bg-white rounded-xl outline-none font-bold focus:border-orange-400"
              placeholder="9.5" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">الطول (سم) اختياري</label>
            <input type="number" value={length} onChange={e => setLength(e.target.value)}
              className="w-full p-3.5 border bg-gray-50 focus:bg-white rounded-xl outline-none font-bold focus:border-orange-400"
              placeholder="75" />
          </div>
        </div>

        <button onClick={calculate}
          className="w-full bg-orange-600 text-white font-black py-3.5 rounded-xl hover:bg-orange-700 shadow-md active:scale-95 transition-all">
          تحليل النمو
        </button>
      </div>

      {/* ── Result ── */}
      {result && (
        <div className="mt-5 space-y-3 animate-in slide-in-from-bottom-4">

          {/* Reference */}
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500 font-bold">مقارنة بمعيار WHO لعمر {result.closestAge} شهر</span>
            <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">
              {gender === 'boy' ? '👦 ذكر' : '👧 أنثى'}
            </span>
          </div>

          {/* Weight result */}
          <div className={`p-5 rounded-2xl border-2 ${result.wStatus.bg}`}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-[10px] text-gray-400 font-bold mb-0.5">الوزن</p>
                <p className={`text-sm font-black ${result.wStatus.color}`}>{result.wStatus.label}</p>
              </div>
              <div className="text-left">
                <p className="text-[9px] text-gray-400 font-bold">Z-Score</p>
                <p className={`text-2xl font-black ${result.wStatus.color}`}>{result.wZ}</p>
              </div>
            </div>
            <div className="flex gap-3 mt-2">
              <div className="bg-white/60 px-3 py-2 rounded-xl text-center flex-1 border border-white">
                <p className="text-[9px] text-gray-400 font-bold">المعدل للعمر</p>
                <p className="font-black text-gray-700">{result.stdW} كجم</p>
              </div>
              <div className="bg-white/60 px-3 py-2 rounded-xl text-center flex-1 border border-white">
                <p className="text-[9px] text-gray-400 font-bold">النسبة المئوية</p>
                <p className="font-black text-gray-700">{getPercentile(result.wZ)} th</p>
              </div>
            </div>
            {result.wStatus.flag && (
              <div className="mt-2 flex items-start gap-2 bg-white/60 p-2 rounded-xl">
                <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-red-600 font-bold">يُنصح بمراجعة طبيب الأطفال لتقييم أسباب الانحراف عن المعدل.</p>
              </div>
            )}
          </div>

          {/* Height result */}
          {result.lResult && (
            <div className={`p-5 rounded-2xl border-2 ${result.lResult.status.bg}`}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-[10px] text-gray-400 font-bold mb-0.5">الطول</p>
                  <p className={`text-sm font-black ${result.lResult.status.color}`}>{result.lResult.status.label}</p>
                </div>
                <div className="text-left">
                  <p className="text-[9px] text-gray-400 font-bold">Z-Score</p>
                  <p className={`text-2xl font-black ${result.lResult.status.color}`}>{result.lResult.lZ}</p>
                </div>
              </div>
              <div className="flex gap-3 mt-2">
                <div className="bg-white/60 px-3 py-2 rounded-xl text-center flex-1 border border-white">
                  <p className="text-[9px] text-gray-400 font-bold">المعدل للعمر</p>
                  <p className="font-black text-gray-700">{result.stdL} سم</p>
                </div>
                <div className="bg-white/60 px-3 py-2 rounded-xl text-center flex-1 border border-white">
                  <p className="text-[9px] text-gray-400 font-bold">النسبة المئوية</p>
                  <p className="font-black text-gray-700">{getPercentile(result.lResult.lZ)} th</p>
                </div>
              </div>
            </div>
          )}

          {/* Z-score guide */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100">
            <p className="text-xs font-black text-gray-600 mb-2">دليل تفسير Z-Score</p>
            {[
              { r: 'أقل من −3', l: 'نحافة/قصر شديد جداً', c: 'text-red-600' },
              { r: '−3 إلى −2', l: 'أقل من المعدل', c: 'text-orange-500' },
              { r: '−2 إلى +2', l: 'نطاق طبيعي', c: 'text-green-600' },
              { r: 'أكثر من +2', l: 'أعلى من المعدل', c: 'text-blue-600' },
            ].map((t, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                <span className={`text-xs font-bold ${t.c}`}>{t.l}</span>
                <span className="text-[10px] text-gray-400 font-bold">{t.r}</span>
              </div>
            ))}
          </div>

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
            { title: 'WHO Child Growth Standards — Weight & Height Tables', url: 'https://www.who.int/tools/child-growth-standards/standards' },
            { title: 'de Onis M et al. — WHO Child Growth Standards development', url: 'https://pubmed.ncbi.nlm.nih.gov/16420387/' },
            { title: 'AAP — Using WHO Growth Charts for Children', url: 'https://www.cdc.gov/growthcharts/who_charts.htm' },
          ].map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-[10px] text-orange-600 font-semibold hover:underline">
              <ExternalLink className="w-3 h-3 shrink-0" />{s.title}
            </a>
          ))}
        </div>
      </div>

    </div>
  );
}
