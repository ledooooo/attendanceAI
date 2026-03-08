import React, { useState } from 'react';
import { ArrowRight, Save, Loader2, BookOpen, ExternalLink, Info, RefreshCw } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

interface Props { onBack?: () => void; }

// ─── SVG Icon ─────────────────────────────────────────────────────────────────
const PainIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
    <rect width="48" height="48" rx="14" fill="#FFF1F2"/>
    {/* Face circle */}
    <circle cx="24" cy="22" r="13" fill="#FFE4E6" stroke="#F43F5E" strokeWidth="1.5"/>
    {/* Eyes - sad */}
    <circle cx="19" cy="19" r="1.5" fill="#F43F5E"/>
    <circle cx="29" cy="19" r="1.5" fill="#F43F5E"/>
    {/* Frown */}
    <path d="M18 27C18 27 20 24 24 24C28 24 30 27 30 27" stroke="#F43F5E" strokeWidth="1.5" strokeLinecap="round"/>
    {/* Sweat drop */}
    <path d="M34 10C34 10 32 12.5 32 13.5C32 14.3 32.7 15 33.5 15C34.3 15 35 14.3 35 13.5C35 12.5 34 10 34 10Z" fill="#FDA4AF"/>
    {/* Zigzag pain lines */}
    <path d="M8 14L10 12L12 15L14 13" stroke="#F43F5E" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" opacity="0.6"/>
    <path d="M34 35L36 33L38 36L40 34" stroke="#F43F5E" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" opacity="0.6"/>
  </svg>
);

// ─── Scale data ───────────────────────────────────────────────────────────────
const vasScales = [
  { val: 0,  emoji: '😊', label: 'لا ألم',    labelEn: 'No Pain',      color: 'bg-green-500',   border: 'border-green-400',   textC: 'text-green-700',   tip: 'لا يحتاج تدخل. تابع الحالة.', barColor: 'bg-green-400' },
  { val: 2,  emoji: '🙂', label: 'خفيف',       labelEn: 'Mild',          color: 'bg-lime-500',    border: 'border-lime-400',    textC: 'text-lime-700',    tip: 'باراسيتامول / إيبوبروفين إذا لزم + راحة.', barColor: 'bg-lime-400' },
  { val: 4,  emoji: '😐', label: 'متوسط',      labelEn: 'Moderate',      color: 'bg-yellow-500',  border: 'border-yellow-400',  textC: 'text-yellow-700',  tip: 'مسكن فموي منتظم. راجع السبب.', barColor: 'bg-yellow-400' },
  { val: 6,  emoji: '😟', label: 'مزعج',       labelEn: 'Distressing',   color: 'bg-orange-500',  border: 'border-orange-400',  textC: 'text-orange-700',  tip: 'يستحق مسكن قوي. إحالة إذا استمر > 3 أيام.', barColor: 'bg-orange-400' },
  { val: 8,  emoji: '😣', label: 'شديد',       labelEn: 'Intense',       color: 'bg-red-500',     border: 'border-red-400',     textC: 'text-red-700',     tip: 'مسكن قوي (أوبيويد إذا لزم). تقييم طبي عاجل.', barColor: 'bg-red-400' },
  { val: 10, emoji: '😭', label: 'لا يُطاق',   labelEn: 'Unbearable',    color: 'bg-red-800',     border: 'border-red-700',     textC: 'text-red-900',     tip: '🚨 طوارئ. ألم شديد يستوجب تدخلاً فورياً.', barColor: 'bg-red-800' },
];

// Faces Pain Scale (for children)
const wongBakerFaces = [
  { val: 0,  emoji: '😊', label: 'سعيد جداً — لا ألم' },
  { val: 2,  emoji: '🙂', label: 'يؤلم قليلاً' },
  { val: 4,  emoji: '😕', label: 'يؤلم أكثر' },
  { val: 6,  emoji: '😟', label: 'يؤلم أكثر من ذلك' },
  { val: 8,  emoji: '😢', label: 'يؤلم جداً' },
  { val: 10, emoji: '😭', label: 'أسوأ ألم ممكن' },
];

// Pain quality descriptors
const painQualities = [
  { id: 'burning', label: '🔥 حرقة' },
  { id: 'stabbing', label: '🔪 طعن' },
  { id: 'throbbing', label: '💓 نبضي' },
  { id: 'cramping', label: '🪢 تقلص' },
  { id: 'shooting', label: '⚡ صاعق' },
  { id: 'pressure', label: '🏋️ ضغط' },
];

export default function PainScaleCalculator({ onBack }: Props) {
  const [scaleType, setScaleType] = useState<'vas' | 'wong'>('vas');
  const [level, setLevel] = useState<number | null>(null);
  const [qualities, setQualities] = useState<string[]>([]);
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);

  const toggleQuality = (id: string) => setQualities(prev => prev.includes(id) ? prev.filter(q => q !== id) : [...prev, id]);

  const currentScale = scaleType === 'vas' ? vasScales : wongBakerFaces;
  const selectedItem = vasScales.find(s => s.val === level);

  const saveResult = async () => {
    if (level === null) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول أولاً');
      await supabase.from('saved_calculations').insert({
        user_id: user.id, title: 'مقياس الألم (VAS/Wong-Baker)',
        result: `الدرجة: ${level}/10 — ${selectedItem?.label}`,
        input_data: { level, scaleType, qualities, location }
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
          <PainIcon />
          <div>
            <h2 className="text-xl font-black text-gray-800">مقياس تقييم الألم</h2>
            <p className="text-xs text-gray-400 font-semibold">VAS / Wong-Baker FACES</p>
          </div>
        </div>
      </div>

      {/* ── Info ── */}
      <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 mb-5 flex gap-3 text-rose-800">
        <Info className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
        <div className="text-xs leading-relaxed">
          <p className="font-bold mb-1">أدوات قياس الألم المعتمدة</p>
          <p><span className="font-black">VAS</span> — للبالغين القادرين على التعبير اللفظي. <span className="font-black">Wong-Baker FACES</span> — للأطفال (3 سنوات فأكثر) وكبار السن.</p>
        </div>
      </div>

      {/* ── Scale selector ── */}
      <div className="flex bg-gray-100 p-1.5 rounded-xl mb-5">
        <button onClick={() => setScaleType('vas')} className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${scaleType === 'vas' ? 'bg-white shadow text-rose-600' : 'text-gray-500'}`}>
          📊 VAS (بالغين)
        </button>
        <button onClick={() => setScaleType('wong')} className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${scaleType === 'wong' ? 'bg-white shadow text-rose-600' : 'text-gray-500'}`}>
          😊 Wong-Baker (أطفال)
        </button>
      </div>

      {/* ── Pain scale grid ── */}
      <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-gray-100">
        <p className="text-xs font-black text-gray-500 mb-4 text-center">
          {scaleType === 'vas' ? 'اضغط على الدرجة التي تصف شعورك الآن:' : 'اضغط على الوجه الذي يعبر عن ألمك:'}
        </p>

        {/* Pain bar visual */}
        {level !== null && (
          <div className="mb-4">
            <div className="flex justify-between text-[9px] text-gray-400 font-bold mb-1">
              <span>لا ألم</span><span>أشد ألم</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${selectedItem?.barColor}`}
                style={{ width: `${(level / 10) * 100}%` }}
              />
            </div>
            <div className="text-center mt-1">
              <span className={`text-2xl font-black ${selectedItem?.textC}`}>{level}/10</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2.5">
          {currentScale.map((s) => {
            const isSelected = level === s.val;
            return (
              <button key={s.val} onClick={() => setLevel(s.val)}
                className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center gap-1.5 ${isSelected ? `${vasScales.find(v => v.val === s.val)?.border ?? 'border-rose-400'} bg-rose-50 scale-105 shadow-md` : 'border-gray-100 hover:bg-gray-50'}`}>
                <span className="text-2xl">{s.emoji}</span>
                <span className={`font-black text-lg leading-none ${isSelected ? (vasScales.find(v => v.val === s.val)?.textC ?? 'text-rose-700') : 'text-gray-700'}`}>{s.val}</span>
                <span className="text-[9px] font-bold text-gray-400 text-center leading-tight">{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Pain quality ── */}
      <div className="mt-4 bg-white p-4 rounded-2xl border border-gray-100">
        <p className="text-xs font-black text-gray-600 mb-3">طبيعة الألم (اختياري — اختر ما ينطبق)</p>
        <div className="flex flex-wrap gap-2">
          {painQualities.map(q => (
            <button key={q.id} onClick={() => toggleQuality(q.id)}
              className={`text-[10px] font-bold px-3 py-1.5 rounded-full border transition-all ${qualities.includes(q.id) ? 'bg-rose-100 border-rose-300 text-rose-700' : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-rose-200'}`}>
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Location ── */}
      <div className="mt-3 bg-white p-4 rounded-2xl border border-gray-100">
        <label className="text-xs font-black text-gray-600 mb-2 block">موقع الألم (اختياري)</label>
        <input value={location} onChange={e => setLocation(e.target.value)}
          placeholder="مثال: أسفل الظهر، الرأس، البطن..."
          className="w-full p-3 rounded-xl border border-gray-100 bg-gray-50 text-xs font-bold text-gray-700 outline-none focus:border-rose-300" />
      </div>

      {/* ── Result card ── */}
      {level !== null && (
        <div className={`mt-5 p-6 bg-white rounded-[2rem] border-2 shadow-sm animate-in slide-in-from-bottom-4 ${selectedItem?.border ?? 'border-rose-200'}`}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] text-gray-400 font-bold">التقييم المسجل</p>
              <p className={`text-3xl font-black ${selectedItem?.textC}`}>{level} <span className="text-base text-gray-400">/ 10</span></p>
              <p className={`text-sm font-black ${selectedItem?.textC}`}>{selectedItem?.label} — {selectedItem?.labelEn}</p>
            </div>
            <span className="text-4xl">{selectedItem?.emoji}</span>
          </div>

          <div className="bg-gray-50 p-3 rounded-xl mb-4">
            <p className="text-[10px] font-black text-gray-500 mb-1">التوصية السريرية</p>
            <p className="text-xs font-semibold text-gray-700">{selectedItem?.tip}</p>
          </div>

          {level >= 6 && (
            <div className="bg-red-50 text-red-700 p-3 rounded-xl text-xs font-bold flex items-center gap-2 mb-4 border border-red-100">
              ⚠️ ألم متقدم — يُنصح بمراجعة الطبيب للتقييم والعلاج المناسب.
            </div>
          )}

          {/* WHO analgesic ladder hint */}
          <div className="bg-amber-50 p-3 rounded-xl mb-4 border border-amber-100">
            <p className="text-[10px] font-black text-amber-700 mb-1">💊 سُلّم WHO للمسكنات</p>
            <p className="text-[10px] text-amber-600 font-semibold">
              {level <= 3 ? 'الدرجة 1: باراسيتامول / NSAIDs (إيبوبروفين، ديكلوفيناك)' :
               level <= 6 ? 'الدرجة 2: مسكن خفيف + كودايين أو ترامادول' :
               'الدرجة 3: مورفين أو أوبيويد قوي تحت إشراف طبي'}
            </p>
          </div>

          <button onClick={saveResult} disabled={loading}
            className="w-full flex items-center justify-center gap-2 text-sm bg-gray-800 text-white px-5 py-3.5 rounded-xl font-bold shadow-md hover:bg-gray-900 transition-colors">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ التقييم
          </button>
        </div>
      )}

      {/* ── Interpretation table ── */}
      <div className="mt-5 bg-white p-4 rounded-2xl border border-gray-100">
        <p className="text-xs font-black text-gray-600 mb-3">📋 دليل تفسير الدرجات</p>
        <div className="space-y-1.5">
          {[
            { range: '0', label: 'لا ألم', color: 'bg-green-100 text-green-700' },
            { range: '1 – 3', label: 'ألم خفيف — لا يؤثر على النشاط اليومي', color: 'bg-lime-100 text-lime-700' },
            { range: '4 – 6', label: 'ألم متوسط — يحد من بعض الأنشطة', color: 'bg-yellow-100 text-yellow-700' },
            { range: '7 – 9', label: 'ألم شديد — يمنع معظم الأنشطة', color: 'bg-orange-100 text-orange-700' },
            { range: '10',    label: 'أشد ألم — طوارئ طبية', color: 'bg-red-100 text-red-700' },
          ].map((r, i) => (
            <div key={i} className={`flex items-center justify-between px-3 py-1.5 rounded-lg ${r.color}`}>
              <span className="text-[10px] font-black">{r.range}</span>
              <span className="text-[10px] font-semibold">{r.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Sources ── */}
      <div className="mt-5 p-4 bg-gray-50 rounded-2xl border border-gray-100">
        <p className="flex items-center gap-1.5 text-xs font-black text-gray-600 mb-3"><BookOpen className="w-3.5 h-3.5"/> المصادر العلمية</p>
        <div className="space-y-2">
          {[
            { title: 'Hawker GA et al. — Measures of Adult Pain (Arthritis Care, 2011)', url: 'https://pubmed.ncbi.nlm.nih.gov/22127845/' },
            { title: 'Wong DL & Baker CM — Pain in Children (Pediatric Nursing, 1988)', url: 'https://pubmed.ncbi.nlm.nih.gov/3353853/' },
            { title: 'WHO — Pain Ladder for Adults (Cancer Pain Relief)', url: 'https://www.who.int/news-room/fact-sheets/detail/palliative-care' },
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
