import React, { useState } from 'react';
import { Save, ArrowRight, Loader2, BookOpen, ExternalLink, Info } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

interface Props { onBack?: () => void; }

// ─── SVG Icon ─────────────────────────────────────────────────────────────────
const KidneyIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
    <rect width="48" height="48" rx="14" fill="#FFFBEB"/>
    {/* Left kidney */}
    <path d="M14 18C14 13.582 16.686 11 20 11C23.314 11 24 14 22 17C20 20 20 24 22 27C24 30 23.314 33 20 33C16.686 33 14 30.418 14 26V18Z" fill="#FDE68A" stroke="#F59E0B" strokeWidth="1.5" strokeLinejoin="round"/>
    {/* Right kidney */}
    <path d="M34 18C34 13.582 31.314 11 28 11C24.686 11 24 14 26 17C28 20 28 24 26 27C24 30 24.686 33 28 33C31.314 33 34 30.418 34 26V18Z" fill="#FDE68A" stroke="#F59E0B" strokeWidth="1.5" strokeLinejoin="round"/>
    {/* Ureter lines */}
    <path d="M20 33V38M28 33V38M20 38H28" stroke="#F59E0B" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    {/* Inner highlight */}
    <path d="M17 20C17 17 18 15 20 15" stroke="#FCD34D" strokeWidth="1.2" strokeLinecap="round"/>
    <path d="M31 20C31 17 30 15 28 15" stroke="#FCD34D" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

// ─── CKD stages ──────────────────────────────────────────────────────────────
const stages = [
  { min: 90,  label: 'المرحلة 1 — طبيعي',                  color: '#22C55E', bg: 'bg-green-50 border-green-200',   textColor: 'text-green-700',  tip: 'وظائف الكلى طبيعية. الحفاظ على الترطيب الجيد وتجنب الأدوية الكلوية السامة.' },
  { min: 60,  label: 'المرحلة 2 — خفيف',                   color: '#84CC16', bg: 'bg-lime-50 border-lime-200',     textColor: 'text-lime-700',   tip: 'نقص خفيف. مراقبة ضغط الدم والسكر. فحوصات الكلى كل 3 أشهر.' },
  { min: 45,  label: 'المرحلة 3A — متوسط-خفيف',            color: '#F59E0B', bg: 'bg-yellow-50 border-yellow-200', textColor: 'text-yellow-700', tip: 'تعديل جرعات الأدوية المُطرحة عبر الكلى. تجنب NSAIDs. متابعة كل شهرين.' },
  { min: 30,  label: 'المرحلة 3B — متوسط',                 color: '#F97316', bg: 'bg-orange-50 border-orange-200', textColor: 'text-orange-700', tip: 'يُنصح بمراجعة طبيب الكلى. تعديل جرعات أدوية هامة كالميتفورمين والأنسولين.' },
  { min: 15,  label: 'المرحلة 4 — شديد',                   color: '#EF4444', bg: 'bg-red-50 border-red-200',       textColor: 'text-red-700',    tip: 'التحضير لغسيل الكلى. إحالة عاجلة لطبيب الكلى. تجنب معظم الأدوية المُطرحة كلوياً.' },
  { min: 0,   label: 'المرحلة 5 — فشل كلوي',               color: '#DC2626', bg: 'bg-red-100 border-red-300',      textColor: 'text-red-800',    tip: 'غسيل الكلى أو زراعة الكلى. رعاية طبية متخصصة فورية.' },
];

export default function GFRCalculator({ onBack }: Props) {
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [creatinine, setCreatinine] = useState('');
  const [gender, setGender] = useState('male');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const calculateGFR = () => {
    const a = parseFloat(age), w = parseFloat(weight), cr = parseFloat(creatinine);
    if (!a || !w || !cr || a <= 0 || w <= 0 || cr <= 0) { toast.error('يرجى إدخال قيم صحيحة وموجبة'); return; }

    // Cockcroft-Gault
    let crcl = ((140 - a) * w) / (72 * cr);
    if (gender === 'female') crcl *= 0.85;

    const val = parseFloat(crcl.toFixed(1));
    const stage = stages.find(s => val >= s.min) || stages[stages.length - 1];

    // Drug adjustment hints
    const drugNotes: string[] = [];
    if (val < 50)  drugNotes.push('Metformin — يُوقف عند CrCl < 30، يُخفض عند < 45');
    if (val < 50)  drugNotes.push('Digoxin — تخفيض الجرعة مطلوب');
    if (val < 30)  drugNotes.push('NSAIDs — ممنوعة تماماً');
    if (val < 30)  drugNotes.push('Nitrofurantoin — غير فعّال وخطر');
    if (val < 60)  drugNotes.push('Bisphosphonates — احذر، راجع الجرعة');

    setResult({ gfr: val, stage, drugNotes });
  };

  const saveResult = async () => {
    if (!result) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول أولاً');
      await supabase.from('saved_calculations').insert({
        user_id: user.id, title: 'وظائف الكلى — Cockcroft-Gault',
        result: `CrCl: ${result.gfr} mL/min — ${result.stage.label}`,
        input_data: { age, weight, creatinine, gender }
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
          <KidneyIcon />
          <div>
            <h2 className="text-xl font-black text-gray-800">وظائف الكلى (CrCl)</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-bold bg-amber-50 text-amber-600 px-2 py-0.5 rounded border border-amber-100">للأطباء فقط ⚕️</span>
              <span className="text-xs text-gray-400 font-semibold">Cockcroft-Gault</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Info ── */}
      <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 mb-5 flex gap-3 text-amber-800">
        <Info className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
        <div className="text-xs leading-relaxed">
          <p className="font-bold mb-1">الاستخدام السريري</p>
          <p>معادلة Cockcroft-Gault هي المعيار المعتمد لتحديد جرعات الأدوية المُطرحة عبر الكلى. تُستخدم لتصنيف مراحل الفشل الكلوي المزمن (CKD Stages).</p>
          <p className="mt-1 text-[10px] font-bold">المعادلة: CrCl = [(140−العمر) × الوزن] ÷ [72 × الكرياتينين] × (0.85 للإناث)</p>
        </div>
      </div>

      {/* ── Form ── */}
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-4">
        <div className="flex bg-gray-100 p-1.5 rounded-xl">
          <button onClick={() => setGender('male')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${gender === 'male' ? 'bg-white shadow-sm text-amber-600' : 'text-gray-500'}`}>👨 ذكر</button>
          <button onClick={() => setGender('female')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${gender === 'female' ? 'bg-white shadow-sm text-amber-600' : 'text-gray-500'}`}>👩 أنثى (×0.85)</button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'العمر (سنوات)', val: age, set: setAge, ph: '65', unit: 'years' },
            { label: 'الوزن (كجم)', val: weight, set: setWeight, ph: '70', unit: 'kg' },
          ].map((f, i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-gray-600">{f.label}</label>
                <span className="text-[9px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full font-bold">{f.unit}</span>
              </div>
              <input type="number" value={f.val} onChange={e => f.set(e.target.value)}
                className="w-full p-3 rounded-xl border bg-gray-50 focus:bg-white focus:border-amber-400 outline-none font-bold text-gray-800"
                placeholder={f.ph} />
            </div>
          ))}
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-gray-600">الكرياتينين بالدم</label>
            <span className="text-[9px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full font-bold">mg/dL</span>
          </div>
          <input type="number" value={creatinine} onChange={e => setCreatinine(e.target.value)}
            className="w-full p-3 rounded-xl border bg-gray-50 focus:bg-white focus:border-amber-400 outline-none font-bold text-gray-800"
            placeholder="1.2" step="0.1" />
        </div>

        <button onClick={calculateGFR}
          className="w-full bg-amber-500 text-white py-3.5 rounded-xl font-black text-base hover:bg-amber-600 shadow-md active:scale-95 transition-all">
          احسب التصفية
        </button>
      </div>

      {/* ── Result ── */}
      {result && (
        <div className="mt-5 space-y-3 animate-in slide-in-from-bottom-4">
          <div className={`p-6 rounded-[2rem] text-center border-2 shadow-sm ${result.stage.bg}`}>
            <p className="text-sm font-bold text-gray-500 mb-1">معدل تصفية الكرياتينين</p>
            <h2 className={`text-5xl font-black my-1 ${result.stage.textColor}`}>
              {result.gfr} <span className="text-xl">mL/min</span>
            </h2>
            <p className={`text-sm font-black px-3 py-1 bg-white/70 rounded-lg inline-block shadow-sm border border-white mt-1 ${result.stage.textColor}`}>
              {result.stage.label}
            </p>
            <p className="text-xs text-gray-600 bg-white/50 p-3 rounded-xl font-semibold leading-relaxed mt-3">{result.stage.tip}</p>
          </div>

          {/* CKD stages bar */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100">
            <p className="text-xs font-black text-gray-600 mb-3">مراحل الفشل الكلوي المزمن (CKD)</p>
            {[...stages].reverse().map((s, i) => (
              <div key={i} className={`flex items-center justify-between py-2 border-b border-gray-50 last:border-0 ${result.gfr >= s.min && (i === 0 || result.gfr < [...stages].reverse()[i - 1]?.min) ? 'font-black' : ''}`}>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                  <span className="text-xs text-gray-700 font-semibold">{s.label.split(' — ')[1]}</span>
                </div>
                <span className="text-[10px] text-gray-400 font-bold">
                  {s.min > 0 ? `≥ ${s.min}` : '< 15'} mL/min
                </span>
              </div>
            ))}
          </div>

          {/* Drug adjustment notes */}
          {result.drugNotes.length > 0 && (
            <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
              <p className="text-xs font-black text-red-700 mb-2">⚠️ تنبيهات جرعات الأدوية</p>
              {result.drugNotes.map((note: string, i: number) => (
                <div key={i} className="flex items-start gap-2 text-xs text-red-600 font-semibold mb-1.5">
                  <span className="font-black mt-0.5">•</span><span>{note}</span>
                </div>
              ))}
            </div>
          )}

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
            { title: 'Cockcroft DW & Gault MH — Prediction of CrCl from SCr (1976)', url: 'https://pubmed.ncbi.nlm.nih.gov/1244564/' },
            { title: 'KDIGO 2024 — CKD Clinical Practice Guidelines', url: 'https://kdigo.org/guidelines/ckd-evaluation-and-management/' },
            { title: 'ASHP — Drug Dosing in Renal Failure Guidelines', url: 'https://www.ashp.org/pharmacy-practice/resource-centers/renal-disease' },
          ].map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-[10px] text-amber-600 font-semibold hover:underline">
              <ExternalLink className="w-3 h-3 shrink-0" />{s.title}
            </a>
          ))}
        </div>
      </div>

    </div>
  );
}
