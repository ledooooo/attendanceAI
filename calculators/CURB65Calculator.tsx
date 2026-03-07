import React, { useState } from 'react';
import { ArrowRight, BookOpen, Save, Loader2, ExternalLink, Info } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

interface Props { onBack?: () => void; }

// ─── SVG Icon ─────────────────────────────────────────────────────────────────
const LungIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
    <rect width="48" height="48" rx="14" fill="#EFF6FF"/>
    {/* Trachea */}
    <path d="M24 11V22" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round"/>
    {/* Left lung */}
    <path d="M24 22C24 22 20 22 17 25C14 28 13 32 14 35C15 37 17 38 20 37C22 36 24 34 24 34" fill="#BFDBFE" stroke="#3B82F6" strokeWidth="1.5" strokeLinejoin="round"/>
    {/* Right lung */}
    <path d="M24 22C24 22 28 22 31 25C34 28 35 32 34 35C33 37 31 38 28 37C26 36 24 34 24 34" fill="#BFDBFE" stroke="#3B82F6" strokeWidth="1.5" strokeLinejoin="round"/>
    {/* Bronchi */}
    <path d="M24 22C22 24 19 25 18 27" stroke="#2563EB" strokeWidth="1" strokeLinecap="round"/>
    <path d="M24 22C26 24 29 25 30 27" stroke="#2563EB" strokeWidth="1" strokeLinecap="round"/>
  </svg>
);

// ─── Severity visual ──────────────────────────────────────────────────────────
const SeverityBar = ({ score }: { score: number }) => {
  const levels = [
    { label: 'منزل', color: '#22C55E' },
    { label: 'منزل', color: '#86EFAC' },
    { label: 'مستشفى', color: '#FB923C' },
    { label: 'عناية', color: '#F87171' },
    { label: 'عناية مكثفة', color: '#EF4444' },
    { label: 'عناية مكثفة', color: '#DC2626' },
  ];
  return (
    <div className="flex gap-1 justify-center mt-2">
      {levels.map((l, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <div className={`w-8 h-2 rounded-full transition-all ${i === score ? 'scale-y-150' : 'opacity-30'}`} style={{ backgroundColor: l.color }} />
          {i === score && <span className="text-[8px] font-bold text-gray-500">{l.label}</span>}
        </div>
      ))}
    </div>
  );
};

export default function CURB65Calculator({ onBack }: Props) {
  const [c, setC] = useState(false);
  const [u, setU] = useState(false);
  const [r, setR] = useState(false);
  const [b, setB] = useState(false);
  const [a, setA] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const liveScore = [c, u, r, b, a].filter(Boolean).length;

  const calculate = () => {
    const score = liveScore;
    let recommendation = '', color = '', bg = '', mortality = '', setting = '', mgmt = '';

    if (score <= 1) {
      recommendation = 'الالتهاب الرئوي خفيف — علاج منزلي';
      color = 'text-green-700'; bg = 'bg-green-50 border-green-200';
      mortality = '1.5%'; setting = 'Outpatient';
      mgmt = 'مضاد حيوي فموي (Amoxicillin أو Azithromycin) لمدة 5–7 أيام.';
    } else if (score === 2) {
      recommendation = 'الالتهاب الرئوي متوسط — تنويم';
      color = 'text-orange-600'; bg = 'bg-orange-50 border-orange-200';
      mortality = '9.2%'; setting = 'Inpatient — General Ward';
      mgmt = 'مضاد حيوي وريدي أو فموي مكثف. مراقبة الأكسجين والعلامات الحيوية.';
    } else {
      recommendation = 'الالتهاب الرئوي شديد — عناية مركزة';
      color = 'text-red-700'; bg = 'bg-red-50 border-red-200';
      mortality = score >= 4 ? '> 30%' : '> 22%'; setting = 'ICU / HDU';
      mgmt = 'مضاد حيوي وريدي مزدوج. تقييم فوري للتنفس الاصطناعي ودعم الدوران.';
    }

    setResult({ score, recommendation, color, bg, mortality, setting, mgmt });
  };

  const saveResult = async () => {
    if (!result) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول');
      await supabase.from('saved_calculations').insert({
        user_id: user.id, title: 'مقياس CURB-65 (الالتهاب الرئوي)',
        result: `النقاط: ${result.score} — ${result.setting}`,
        input_data: { c, u, r, b, a }
      });
      toast.success('تم الحفظ');
    } catch (err: any) { toast.error(err.message); } finally { setLoading(false); }
  };

  const items = [
    { state: c, set: setC, letter: 'C', label: 'تشوش ذهني جديد', desc: 'Confusion — ارتباك حديث غير موجود قبل الالتهاب' },
    { state: u, set: setU, letter: 'U', label: 'اليوريا مرتفعة', desc: 'Urea > 19 mg/dL (BUN) / 7 mmol/L' },
    { state: r, set: setR, letter: 'R', label: 'سرعة التنفس مرتفعة', desc: 'Respiratory rate ≥ 30 نفس/دقيقة' },
    { state: b, set: setB, letter: 'B', label: 'انخفاض ضغط الدم', desc: 'Systolic < 90 mmHg أو Diastolic ≤ 60 mmHg' },
    { state: a, set: setA, letter: '65', label: 'العمر 65 سنة فأكثر', desc: 'Age ≥ 65 years' },
  ];

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 pb-10">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-5">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border"><ArrowRight className="w-5 h-5" /></button>}
        <div className="flex items-center gap-3">
          <LungIcon />
          <div>
            <h2 className="text-xl font-black text-gray-800">مقياس CURB-65</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100">للأطباء فقط ⚕️</span>
              <span className="text-xs text-gray-400 font-semibold">شدة الالتهاب الرئوي</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Info ── */}
      <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 mb-5 flex gap-3 text-blue-800">
        <Info className="w-5 h-5 shrink-0 mt-0.5 text-blue-400" />
        <div className="text-xs leading-relaxed">
          <p className="font-bold mb-1">الاستخدام السريري</p>
          <p>يُقيّم شدة الالتهاب الرئوي المكتسب من المجتمع (CAP) لاتخاذ قرار مكان العلاج: منزل، قسم داخلي، أو وحدة عناية مركزة. يُوصى به من قِبَل BTS كأداة تقييم أولية.</p>
        </div>
      </div>

      {/* ── Form ── */}
      <div className="bg-white p-5 rounded-[2rem] shadow-sm border space-y-2.5">
        <p className="text-xs font-black text-gray-500 mb-1">المعايير السريرية — حدد ما ينطبق</p>
        {items.map((item, i) => (
          <label key={i} className={`flex items-start gap-3 p-3.5 border-2 rounded-xl cursor-pointer transition-all ${item.state ? 'border-blue-400 bg-blue-50' : 'border-gray-100 hover:bg-gray-50'}`}>
            <input type="checkbox" checked={item.state} onChange={e => item.set(e.target.checked)} className="w-5 h-5 accent-blue-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-black px-1.5 py-0.5 rounded ${item.state ? 'bg-blue-200 text-blue-800' : 'bg-gray-100 text-gray-500'}`}>{item.letter}</span>
                <span className="font-bold text-xs text-gray-800">{item.label}</span>
              </div>
              <p className="text-[9px] text-gray-400 font-semibold mt-0.5">{item.desc}</p>
            </div>
            <span className={`text-sm font-black shrink-0 ${item.state ? 'text-blue-500' : 'text-gray-200'}`}>+1</span>
          </label>
        ))}

        {/* Live score */}
        <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border">
          <span className="text-xs font-bold text-gray-500">المجموع الحالي</span>
          <span className="text-xl font-black text-gray-800">{liveScore} <span className="text-xs text-gray-400">/ 5</span></span>
        </div>

        <button onClick={calculate} className="w-full bg-gray-800 text-white font-black py-3.5 rounded-xl hover:bg-gray-900 active:scale-95 transition-all">
          التقييم
        </button>
      </div>

      {/* ── Result ── */}
      {result && (
        <div className={`mt-5 p-6 rounded-[2rem] border-2 text-center animate-in slide-in-from-bottom-4 ${result.bg}`}>
          <p className="text-xs text-gray-400 font-bold mb-1">النقاط</p>
          <div className={`text-6xl font-black mb-1 ${result.color}`}>{result.score}</div>
          <p className={`text-sm font-black inline-block px-4 py-1 rounded-lg bg-white/60 ${result.color}`}>{result.recommendation}</p>
          <SeverityBar score={result.score} />

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-white/60 p-3 rounded-xl border border-white">
              <p className="text-[9px] text-gray-400 font-bold mb-1">معدل الوفاة</p>
              <p className={`text-xl font-black ${result.color}`}>{result.mortality}</p>
            </div>
            <div className="bg-white/60 p-3 rounded-xl border border-white">
              <p className="text-[9px] text-gray-400 font-bold mb-1">مكان العلاج</p>
              <p className="text-xs font-black text-gray-700">{result.setting}</p>
            </div>
          </div>

          <div className="bg-white/50 p-3 rounded-xl mt-3 text-right border border-white">
            <p className="text-[9px] font-black text-gray-400 mb-1">التوصية العلاجية</p>
            <p className="text-xs font-semibold text-gray-700 leading-relaxed">{result.mgmt}</p>
          </div>

          <button onClick={saveResult} disabled={loading}
            className="mt-4 w-full flex justify-center gap-2 text-sm bg-white text-blue-700 px-5 py-3 rounded-xl font-bold border hover:bg-blue-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ النتيجة
          </button>
        </div>
      )}

      {/* ── Sources ── */}
      <div className="mt-6 p-4 bg-gray-50 rounded-2xl border border-gray-100">
        <p className="flex items-center gap-1.5 text-xs font-black text-gray-600 mb-3"><BookOpen className="w-3.5 h-3.5"/> المصادر العلمية</p>
        <div className="space-y-2">
          {[
            { title: 'Lim WS et al. — BTS Guidelines CAP & CURB-65 (Thorax, 2003)', url: 'https://pubmed.ncbi.nlm.nih.gov/12728155/' },
            { title: 'BTS Guidelines — Community Acquired Pneumonia 2009 (Updated)', url: 'https://www.brit-thoracic.org.uk/quality-improvement/guidelines/pneumonia-adults/' },
            { title: 'IDSA/ATS Consensus Guidelines on CAP 2007', url: 'https://pubmed.ncbi.nlm.nih.gov/17278083/' },
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
