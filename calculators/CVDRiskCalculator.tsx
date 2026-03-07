import React, { useState } from 'react';
import { ArrowRight, Save, Loader2, BookOpen, ExternalLink, Info } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

interface Props { onBack?: () => void; }

// ─── SVG Icon ─────────────────────────────────────────────────────────────────
const CVDIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
    <rect width="48" height="48" rx="14" fill="#FFF1F2"/>
    <path d="M24 38C24 38 11 30 11 21C11 16.5 14.5 13 19 13C21.5 13 23.5 14.2 24 15C24.5 14.2 26.5 13 29 13C33.5 13 37 16.5 37 21C37 30 24 38 24 38Z" fill="#FECDD3" stroke="#F43F5E" strokeWidth="1.5"/>
    {/* ECG line inside heart */}
    <path d="M15 22H19L20.5 19L22 24L23.5 20L25 25L26.5 22H33" stroke="#E11D48" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ─── Risk Gauge ───────────────────────────────────────────────────────────────
const RiskGauge = ({ pct }: { pct: number }) => {
  const clamp = Math.min(pct, 40);
  const barPct = (clamp / 40) * 100;
  const color = pct < 10 ? '#22C55E' : pct <= 20 ? '#F97316' : '#EF4444';
  return (
    <div className="mt-3 mb-1">
      <div className="flex rounded-full overflow-hidden h-3 bg-gray-100">
        <div style={{ width: `${barPct}%`, backgroundColor: color, transition: 'width 0.8s ease' }} className="rounded-full" />
      </div>
      <div className="flex justify-between mt-1 text-[9px] text-gray-400 font-bold">
        <span>0%</span><span className="text-green-500">منخفض &lt;10%</span><span className="text-orange-500">متوسط 10–20%</span><span className="text-red-500">مرتفع &gt;20%</span>
      </div>
    </div>
  );
};

export default function CVDRiskCalculator({ onBack }: Props) {
  const [gender, setGender] = useState('male');
  const [age, setAge] = useState('');
  const [cholesterol, setCholesterol] = useState('');
  const [hdl, setHdl] = useState('');
  const [systolic, setSystolic] = useState('');
  const [smoker, setSmoker] = useState(false);
  const [diabetes, setDiabetes] = useState(false);
  const [treated, setTreated] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const calculate = () => {
    let points = 0;
    const a = parseInt(age), chol = parseInt(cholesterol), h = parseInt(hdl), sys = parseInt(systolic);
    if (!a || !chol || !h || !sys) { toast.error('يرجى إدخال جميع البيانات'); return; }

    if (gender === 'male') {
      if (a <= 34) points -= 9; else if (a <= 39) points -= 4; else if (a <= 44) points += 0; else if (a <= 49) points += 3; else if (a <= 54) points += 6; else if (a <= 59) points += 8; else points += 10;
      if (chol < 160) points += 0; else if (chol < 200) points += 4; else if (chol < 240) points += 7; else points += 9;
      if (smoker) points += 8;
    } else {
      if (a <= 34) points -= 7; else if (a <= 39) points -= 3; else if (a <= 44) points += 0; else if (a <= 49) points += 3; else if (a <= 54) points += 6; else points += 8;
      if (chol < 160) points += 0; else if (chol < 200) points += 4; else if (chol < 240) points += 8; else points += 11;
      if (smoker) points += 9;
    }

    if (h >= 60) points -= 1; else if (h < 40) points += 2; else points += 1;
    if (sys < 120) points += 0; else if (sys < 130) points += (treated ? 1 : 0); else if (sys < 140) points += (treated ? 2 : 1); else points += (treated ? 3 : 2);

    const riskTable = [1, 1, 1, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 25, 30];
    let risk = points <= 0 ? 1 : points >= 16 ? 30 : riskTable[points];
    if (diabetes) risk = Math.min(Math.round(risk * 1.5), 99);

    let riskStatus = '', statusColor = '', bgColor = '', tips: string[] = [];
    if (risk < 10) {
      riskStatus = 'خطر منخفض'; statusColor = 'text-green-700'; bgColor = 'bg-green-50 border-green-200';
      tips = ['متابعة سنوية مع الطبيب', 'الحفاظ على النشاط البدني (150 دق/أسبوع)', 'نظام غذائي منخفض الدهون المشبعة'];
    } else if (risk <= 20) {
      riskStatus = 'خطر متوسط'; statusColor = 'text-orange-600'; bgColor = 'bg-orange-50 border-orange-200';
      tips = ['مناقشة بدء الستاتين مع الطبيب', 'التحكم في ضغط الدم والسكر', 'الإقلاع عن التدخين إن وجد'];
    } else {
      riskStatus = 'خطر مرتفع'; statusColor = 'text-red-700'; bgColor = 'bg-red-50 border-red-200';
      tips = ['يُنصح ببدء علاج بالستاتين', 'تحسين جميع عوامل الخطر المعدّلة', 'متابعة كل 3 أشهر مع الطبيب'];
    }

    setResult({ score: Math.round(risk), points, riskStatus, statusColor, bgColor, tips });
  };

  const saveResult = async () => {
    if (!result) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول أولاً');
      await supabase.from('saved_calculations').insert({
        user_id: user.id, title: 'مخاطر القلب — Framingham Risk Score',
        result: `${result.score}% — ${result.riskStatus}`,
        input_data: { age, gender, systolic, cholesterol, hdl, smoker, diabetes, treated }
      });
      toast.success('تم حفظ النتيجة ✅');
    } catch (err: any) { toast.error(err.message); } finally { setLoading(false); }
  };

  const checkboxItems = [
    { checked: smoker, set: setSmoker, label: 'مدخن حالياً', desc: 'Current smoker' },
    { checked: diabetes, set: setDiabetes, label: 'مريض سكري', desc: 'Diabetes mellitus' },
    { checked: treated, set: setTreated, label: 'يتناول علاج لضغط الدم', desc: 'On antihypertensive treatment' },
  ];

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 duration-300 pb-10">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-5">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50"><ArrowRight className="w-5 h-5 text-gray-600" /></button>}
        <div className="flex items-center gap-3">
          <CVDIcon />
          <div>
            <h2 className="text-xl font-black text-gray-800">حاسبة مخاطر القلب والأوعية</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-bold bg-rose-50 text-rose-600 px-2 py-0.5 rounded border border-rose-100">للأطباء فقط ⚕️</span>
              <span className="text-xs text-gray-400 font-semibold">Framingham Risk Score</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Info ── */}
      <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 mb-5 flex gap-3 text-rose-800">
        <Info className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
        <div className="text-xs leading-relaxed">
          <p className="font-bold mb-1">الاستخدام السريري</p>
          <p>يُقدّر احتمالية الإصابة بحدث قلبي وعائي رئيسي (أزمة قلبية أو سكتة) خلال 10 سنوات، لتحديد الحاجة لتدخل دوائي وقائي وفق إرشادات AHA/ACC.</p>
        </div>
      </div>

      {/* ── Form ── */}
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-4">

        {/* Gender */}
        <div className="flex bg-gray-100 p-1.5 rounded-xl">
          <button onClick={() => setGender('male')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition ${gender === 'male' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>👨 ذكر</button>
          <button onClick={() => setGender('female')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition ${gender === 'female' ? 'bg-white shadow text-pink-600' : 'text-gray-500'}`}>👩 أنثى</button>
        </div>

        {/* Numeric inputs */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'العمر (سنة)', val: age, set: setAge, ph: '45' },
            { label: 'الضغط الانقباضي (mmHg)', val: systolic, set: setSystolic, ph: '120' },
            { label: 'الكوليسترول الكلي (mg/dL)', val: cholesterol, set: setCholesterol, ph: '200' },
            { label: 'HDL الكوليسترول الجيد (mg/dL)', val: hdl, set: setHdl, ph: '50' },
          ].map((f, i) => (
            <div key={i}>
              <label className="block text-[10px] font-bold text-gray-500 mb-1.5">{f.label}</label>
              <input type="number" value={f.val} onChange={e => f.set(e.target.value)}
                className="w-full p-3 border bg-gray-50 focus:bg-white focus:border-rose-400 outline-none rounded-xl font-bold text-sm"
                placeholder={f.ph} />
            </div>
          ))}
        </div>

        {/* Checkboxes */}
        <div className="space-y-2">
          {checkboxItems.map((item, i) => (
            <label key={i} className={`flex items-center gap-3 cursor-pointer p-3 border-2 rounded-xl transition-all ${item.checked ? 'border-rose-400 bg-rose-50' : 'border-gray-100 hover:bg-gray-50'}`}>
              <input type="checkbox" checked={item.checked} onChange={e => item.set(e.target.checked)} className="w-5 h-5 accent-rose-600 shrink-0" />
              <div>
                <p className="font-bold text-xs text-gray-800">{item.label}</p>
                <p className="text-[9px] text-gray-400">{item.desc}</p>
              </div>
            </label>
          ))}
        </div>

        <button onClick={calculate}
          className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black py-4 rounded-xl transition-all shadow-md active:scale-95">
          احسب الخطر
        </button>
      </div>

      {/* ── Result ── */}
      {result && (
        <div className={`mt-5 p-6 rounded-[2rem] border-2 text-center shadow-sm animate-in slide-in-from-bottom-4 ${result.bgColor}`}>
          <p className="text-xs text-gray-400 font-bold mb-1">احتمالية حدث قلبي خلال 10 سنوات</p>
          <div className={`text-6xl font-black mb-1 ${result.statusColor}`}>{result.score}%</div>
          <span className={`text-sm font-black bg-white/70 inline-block px-4 py-1 rounded-lg border ${result.statusColor}`}>{result.riskStatus}</span>
          <RiskGauge pct={result.score} />

          {/* Tips */}
          <div className="bg-white/60 p-4 rounded-xl text-right mt-3 border border-white">
            <p className="text-[10px] font-black text-gray-500 mb-2">💡 التوصيات:</p>
            {result.tips.map((tip: string, i: number) => (
              <div key={i} className="flex items-start gap-2 text-xs text-gray-700 font-semibold mb-1">
                <span className="text-rose-400">•</span><span>{tip}</span>
              </div>
            ))}
          </div>

          <button onClick={saveResult} disabled={loading}
            className="mt-4 w-full flex items-center justify-center gap-2 text-sm bg-white px-5 py-3 rounded-xl font-bold text-gray-800 border hover:bg-gray-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ النتيجة
          </button>
        </div>
      )}

      {/* ── Sources ── */}
      <div className="mt-6 p-4 bg-gray-50 rounded-2xl border border-gray-100">
        <p className="flex items-center gap-1.5 text-xs font-black text-gray-600 mb-3"><BookOpen className="w-3.5 h-3.5"/> المصادر العلمية</p>
        <div className="space-y-2">
          {[
            { title: 'Wilson PW et al. — Framingham Heart Study prediction score (Circulation, 1998)', url: 'https://pubmed.ncbi.nlm.nih.gov/9603539/' },
            { title: 'ACC/AHA 2019 — Cardiovascular Risk Assessment Guidelines', url: 'https://www.acc.org/latest-in-cardiology/ten-points-to-remember/2019/03/15/14/39/2019-acc-aha-guideline-on-primary-prevention' },
            { title: 'ESC — SCORE2 Risk Calculator (2021 Guidelines)', url: 'https://www.escardio.org/Guidelines/Clinical-Practice-Guidelines/CVD-Prevention-in-clinical-practice' },
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
