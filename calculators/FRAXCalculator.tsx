import React, { useState } from 'react';
import { ArrowRight, BookOpen, ExternalLink, Info, Save, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

interface Props { onBack?: () => void; }

// ─── SVG Icon ─────────────────────────────────────────────────────────────────
const BoneIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
    <rect width="48" height="48" rx="14" fill="#FFF7ED"/>
    <circle cx="14" cy="14" r="5" fill="#FED7AA" stroke="#F97316" strokeWidth="1.5"/>
    <circle cx="34" cy="14" r="5" fill="#FED7AA" stroke="#F97316" strokeWidth="1.5"/>
    <circle cx="14" cy="34" r="5" fill="#FED7AA" stroke="#F97316" strokeWidth="1.5"/>
    <circle cx="34" cy="34" r="5" fill="#FED7AA" stroke="#F97316" strokeWidth="1.5"/>
    <rect x="11" y="21" width="6" height="6" rx="2" fill="#FDBA74" stroke="#F97316" strokeWidth="1.2"/>
    <rect x="31" y="21" width="6" height="6" rx="2" fill="#FDBA74" stroke="#F97316" strokeWidth="1.2"/>
    <path d="M17 24H31" stroke="#F97316" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

// ─── Selector button group ────────────────────────────────────────────────────
const SegmentedSelect = ({ label, options, value, onChange }: any) => (
  <div>
    <p className="text-xs font-black text-gray-600 mb-2">{label}</p>
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(options.length, 3)}, 1fr)` }}>
      {options.map((opt: any) => (
        <button key={opt.value} onClick={() => onChange(opt.value)}
          className={`py-2.5 px-2 rounded-xl text-[11px] font-bold border-2 transition-all text-center leading-tight ${value === opt.value ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-100 bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
          {opt.label}
        </button>
      ))}
    </div>
  </div>
);

export default function FRAXCalculator({ onBack }: Props) {
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('female');
  const [bmi, setBmi] = useState('');
  const [prevFracture, setPrevFracture] = useState(false);
  const [parentFracture, setParentFracture] = useState(false);
  const [currentSmoker, setCurrentSmoker] = useState(false);
  const [steroids, setSteroids] = useState(false);
  const [rheumatoid, setRheumatoid] = useState(false);
  const [alcohol, setAlcohol] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const calculate = () => {
    const a = parseFloat(age);
    const b = parseFloat(bmi);
    if (!a || !b || a < 40 || a > 90) { toast.error('يرجى إدخال عمر صحيح (40–90 سنة) ومؤشر كتلة الجسم'); return; }

    // Simplified FRAX estimation (without BMD)
    let baseRisk = gender === 'female' ? 8 : 4;

    // Age factor
    if (a >= 75) baseRisk += 12;
    else if (a >= 70) baseRisk += 8;
    else if (a >= 65) baseRisk += 5;
    else if (a >= 60) baseRisk += 3;
    else if (a >= 55) baseRisk += 1;

    // BMI factor
    if (b < 20) baseRisk += 4;
    else if (b < 25) baseRisk += 1;
    else if (b > 30) baseRisk -= 2;

    // Risk factors
    if (prevFracture) baseRisk += 8;
    if (parentFracture) baseRisk += 3;
    if (currentSmoker) baseRisk += 2;
    if (steroids) baseRisk += 5;
    if (rheumatoid) baseRisk += 4;
    if (alcohol) baseRisk += 2;

    const hipRisk = Math.max(0.5, Math.min(baseRisk * 0.22, 40)).toFixed(1);
    const majorRisk = Math.max(1, Math.min(baseRisk, 60)).toFixed(1);

    let level = '', color = '', bg = '', rec = '';
    if (parseFloat(majorRisk) < 10) {
      level = 'خطر منخفض'; color = 'text-green-700'; bg = 'bg-green-50 border-green-200';
      rec = 'متابعة سنوية. نصائح غذائية (كالسيوم وفيتامين D) وتمارين تحمّل الثقل.';
    } else if (parseFloat(majorRisk) < 20) {
      level = 'خطر متوسط'; color = 'text-orange-600'; bg = 'bg-orange-50 border-orange-200';
      rec = 'يُنصح بإجراء قياس كثافة العظام (DXA scan) لتحديد الحاجة للعلاج الدوائي.';
    } else {
      level = 'خطر مرتفع'; color = 'text-red-700'; bg = 'bg-red-50 border-red-200';
      rec = 'يُنصح بشدة بالعلاج الدوائي (Bisphosphonates) ومراجعة متخصص عظام.';
    }

    setResult({ majorRisk, hipRisk, level, color, bg, rec });
  };

  const saveResult = async () => {
    if (!result) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول');
      await supabase.from('saved_calculations').insert({
        user_id: user.id, title: 'مقياس FRAX لهشاشة العظام',
        result: `خطر الكسر الرئيسي: ${result.majorRisk}% — ${result.level}`,
        input_data: { age, gender, bmi, prevFracture, parentFracture, steroids, rheumatoid }
      });
      toast.success('تم الحفظ ✅');
    } catch (err: any) { toast.error(err.message); } finally { setLoading(false); }
  };

  const checkboxItems = [
    { v: prevFracture, s: setPrevFracture, l: 'كسر سابق بعد سن 50 (هشاشة)', d: 'Previous fragility fracture' },
    { v: parentFracture, s: setParentFracture, l: 'أحد الوالدين أصيب بكسر في الورك', d: 'Parental hip fracture' },
    { v: currentSmoker, s: setCurrentSmoker, l: 'مدخن حالياً', d: 'Current smoker' },
    { v: steroids, s: setSteroids, l: 'يتناول كورتيزون > 3 أشهر', d: 'Glucocorticoid use' },
    { v: rheumatoid, s: setRheumatoid, l: 'التهاب مفاصل روماتويدي', d: 'Rheumatoid arthritis' },
    { v: alcohol, s: setAlcohol, l: 'يتناول الكحول (3+ وحدات/يوم)', d: 'Alcohol 3+ units/day' },
  ];

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 pb-10" dir="rtl">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-5">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border"><ArrowRight className="w-5 h-5 text-gray-600" /></button>}
        <div className="flex items-center gap-3">
          <BoneIcon />
          <div>
            <h2 className="text-xl font-black text-gray-800">مقياس FRAX لهشاشة العظام</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-bold bg-orange-50 text-orange-600 px-2 py-0.5 rounded border border-orange-100">للأطباء فقط ⚕️</span>
              <span className="text-xs text-gray-400 font-semibold">Fracture Risk Assessment</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Info ── */}
      <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 mb-5 flex gap-3 text-orange-800">
        <Info className="w-5 h-5 shrink-0 mt-0.5 text-orange-400" />
        <div className="text-xs leading-relaxed">
          <p className="font-bold mb-1">الاستخدام السريري</p>
          <p>يُقدّر احتمالية الإصابة بكسر هشاشة العظام الرئيسي (ورك، عمود فقري، رسغ، كتف) خلال 10 سنوات، بدون الحاجة لقياس كثافة العظام DXA. هذه النسخة تقديرية — للنتيجة الدقيقة استخدم الموقع الرسمي.</p>
        </div>
      </div>

      {/* ── Form ── */}
      <div className="bg-white p-5 rounded-[2rem] shadow-sm border space-y-5">

        {/* Gender */}
        <div className="flex bg-gray-100 p-1.5 rounded-xl">
          <button onClick={() => setGender('female')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition ${gender === 'female' ? 'bg-white shadow text-pink-600' : 'text-gray-500'}`}>👩 أنثى</button>
          <button onClick={() => setGender('male')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition ${gender === 'male' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>👨 ذكر</button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-gray-500 mb-1.5 block">العمر (سنة) — 40 إلى 90</label>
            <input type="number" value={age} onChange={e => setAge(e.target.value)}
              className="w-full p-3 border bg-gray-50 focus:bg-white focus:border-orange-400 outline-none rounded-xl font-bold text-sm"
              placeholder="65" min="40" max="90" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 mb-1.5 block">مؤشر كتلة الجسم (BMI)</label>
            <input type="number" value={bmi} onChange={e => setBmi(e.target.value)}
              className="w-full p-3 border bg-gray-50 focus:bg-white focus:border-orange-400 outline-none rounded-xl font-bold text-sm"
              placeholder="25" />
          </div>
        </div>

        <div>
          <p className="text-xs font-black text-gray-500 mb-3">عوامل الخطر — حدد ما ينطبق</p>
          <div className="space-y-2">
            {checkboxItems.map((item, i) => (
              <label key={i} className={`flex items-start gap-3 p-3.5 border-2 rounded-xl cursor-pointer transition-all ${item.v ? 'border-orange-400 bg-orange-50' : 'border-gray-100 hover:bg-gray-50'}`}>
                <input type="checkbox" checked={item.v} onChange={e => item.s(e.target.checked)} className="w-5 h-5 accent-orange-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-xs text-gray-800">{item.l}</p>
                  <p className="text-[9px] text-gray-400 font-semibold">{item.d}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <button onClick={calculate} className="w-full bg-gray-800 text-white font-black py-3.5 rounded-xl hover:bg-gray-900 active:scale-95 transition-all">
          احسب خطر الكسر
        </button>
      </div>

      {/* ── Result ── */}
      {result && (
        <div className={`mt-5 p-6 rounded-[2rem] border-2 animate-in slide-in-from-bottom-4 ${result.bg}`}>
          <p className="text-xs text-gray-400 font-bold text-center mb-3">احتمالية الكسر خلال 10 سنوات</p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white/70 p-4 rounded-2xl border border-white text-center">
              <p className="text-[9px] text-gray-400 font-bold mb-1">كسر رئيسي</p>
              <p className={`text-3xl font-black ${result.color}`}>{result.majorRisk}%</p>
              <p className="text-[9px] text-gray-400">(ورك، عمود، رسغ، كتف)</p>
            </div>
            <div className="bg-white/70 p-4 rounded-2xl border border-white text-center">
              <p className="text-[9px] text-gray-400 font-bold mb-1">كسر الورك تحديداً</p>
              <p className={`text-3xl font-black ${result.color}`}>{result.hipRisk}%</p>
              <p className="text-[9px] text-gray-400">Hip fracture</p>
            </div>
          </div>
          <div className="text-center mb-3">
            <span className={`text-sm font-black px-4 py-1.5 rounded-lg bg-white/60 inline-block ${result.color}`}>{result.level}</span>
          </div>
          <p className="text-xs text-gray-600 bg-white/50 p-3 rounded-xl font-semibold leading-relaxed">{result.rec}</p>
          <p className="text-[9px] text-gray-400 text-center mt-2 font-semibold">* هذه نتيجة تقديرية. استخدم الموقع الرسمي shef.ac.uk/FRAX للنتيجة الدقيقة.</p>
          <button onClick={saveResult} disabled={loading}
            className="mt-3 w-full flex items-center justify-center gap-2 text-sm bg-white px-5 py-3 rounded-xl font-bold text-gray-800 border hover:bg-gray-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ
          </button>
        </div>
      )}

      {/* ── Sources ── */}
      <div className="mt-6 p-4 bg-gray-50 rounded-2xl border border-gray-100">
        <p className="flex items-center gap-1.5 text-xs font-black text-gray-600 mb-3"><BookOpen className="w-3.5 h-3.5"/> المصادر العلمية</p>
        <div className="space-y-2">
          {[
            { title: 'WHO FRAX Tool — University of Sheffield (الرسمي)', url: 'https://www.sheffield.ac.uk/FRAX' },
            { title: 'IOF — International Osteoporosis Foundation Guidelines', url: 'https://www.osteoporosis.foundation/health-professionals/fragility-fractures/fracture-risk-assessment' },
            { title: 'Kanis JA et al. — FRAX and the assessment of fracture probability (2008)', url: 'https://pubmed.ncbi.nlm.nih.gov/18292978/' },
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
