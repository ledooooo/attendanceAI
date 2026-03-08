import React, { useState } from 'react';
import { ArrowRight, BookOpen, ExternalLink, Info } from 'lucide-react';

interface Props { onBack?: () => void; }

// ─── SVG Icon ─────────────────────────────────────────────────────────────────
const PerioIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
    <rect width="48" height="48" rx="14" fill="#FFF1F2"/>
    {/* Gum line */}
    <path d="M8 22C8 22 14 18 24 18C34 18 40 22 40 22" stroke="#FDA4AF" strokeWidth="2" strokeLinecap="round"/>
    {/* Teeth */}
    <rect x="13" y="22" width="6" height="10" rx="2" fill="#FEF2F2" stroke="#F87171" strokeWidth="1.2"/>
    <rect x="21" y="22" width="6" height="12" rx="2" fill="#FEF2F2" stroke="#F87171" strokeWidth="1.2"/>
    <rect x="29" y="22" width="6" height="10" rx="2" fill="#FEF2F2" stroke="#F87171" strokeWidth="1.2"/>
    {/* Bone loss indicator - dotted line */}
    <path d="M11 30L37 30" stroke="#EF4444" strokeWidth="1" strokeDasharray="2 2"/>
    {/* Pocket depth arrow */}
    <path d="M24 22V32M22 30L24 32L26 30" stroke="#DC2626" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ─── Stage definitions ────────────────────────────────────────────────────────
const stages = [
  {
    num: 'I',
    label: 'المرحلة الأولى',
    cal: '1 – 2 ملم',
    rd: '< 15%',
    pocket: '≤ 4 ملم',
    teeth: 'لا فقدان',
    color: 'text-green-700',
    bg: 'bg-green-50 border-green-200',
    badge: 'bg-green-100 text-green-700',
    tip: 'التهاب لثة مبدئي. يستجيب جيداً لتنظيف الجير والنظافة الفموية.',
  },
  {
    num: 'II',
    label: 'المرحلة الثانية',
    cal: '3 – 4 ملم',
    rd: '15 – 33%',
    pocket: '≤ 5 ملم',
    teeth: 'لا فقدان',
    color: 'text-yellow-700',
    bg: 'bg-yellow-50 border-yellow-200',
    badge: 'bg-yellow-100 text-yellow-700',
    tip: 'يحتاج تنظيفاً عميقاً (Root Planing) ومتابعة دورية كل 3–4 أشهر.',
  },
  {
    num: 'III',
    label: 'المرحلة الثالثة',
    cal: '≥ 5 ملم',
    rd: '≥ 33% أو كسر عمودي',
    pocket: '≥ 6 ملم',
    teeth: 'فقدان ≤ 4 أسنان',
    color: 'text-orange-700',
    bg: 'bg-orange-50 border-orange-200',
    badge: 'bg-orange-100 text-orange-700',
    tip: 'يحتاج علاجاً متخصصاً (Periodontist) وقد يستلزم جراحة لثوية.',
  },
  {
    num: 'IV',
    label: 'المرحلة الرابعة',
    cal: '≥ 5 ملم',
    rd: '≥ 33%',
    pocket: '≥ 6 ملم',
    teeth: 'فقدان ≥ 5 أسنان أو فقدان وظيفة الإطباق',
    color: 'text-red-700',
    bg: 'bg-red-50 border-red-200',
    badge: 'bg-red-100 text-red-700',
    tip: 'تدهور شديد يهدد وظيفة المضغ. يستلزم علاجاً جراحياً وتأهيلاً تعويضياً.',
  },
];

const grades = [
  { letter: 'A', label: 'بطيء التقدم', desc: 'لا دليل على تقدم خلال 5 سنوات. غير مدخن. سكر طبيعي.', color: 'text-green-600', bg: 'bg-green-50' },
  { letter: 'B', label: 'متوسط التقدم', desc: 'تقدم معتدل الوثيقة. مدخن < 10 سجائر/يوم. HbA1c < 7%.', color: 'text-yellow-700', bg: 'bg-yellow-50' },
  { letter: 'C', label: 'سريع التقدم', desc: 'تقدم سريع موثق. مدخن ≥ 10 سجائر/يوم. HbA1c ≥ 7%.', color: 'text-red-600', bg: 'bg-red-50' },
];

export default function PeriodontalStaging({ onBack }: Props) {
  const [cal, setCal] = useState('1-2');
  const [rd, setRd] = useState('under15');
  const [pocket, setPocket] = useState('under4');
  const [teethLost, setTeethLost] = useState('0');
  const [masticatoryDysfunction, setMasticatoryDysfunction] = useState(false);
  const [smoker, setSmoker] = useState('none');
  const [diabetes, setDiabetes] = useState('none');
  const [activeTab, setActiveTab] = useState<'staging' | 'grading'>('staging');

  const getStage = () => {
    const lost = parseInt(teethLost);
    if (lost >= 5 || masticatoryDysfunction) return stages[3]; // IV
    if (lost > 0 && lost <= 4) return stages[2]; // III
    if (cal === '5+' || rd === 'over33' || pocket === 'over6') return stages[2]; // III
    if (cal === '3-4' || rd === '15-33' || pocket === '5-6') return stages[1]; // II
    return stages[0]; // I
  };

  const getGrade = () => {
    if (smoker === 'heavy' || diabetes === 'uncontrolled') return grades[2]; // C
    if (smoker === 'light' || diabetes === 'controlled') return grades[1]; // B
    return grades[0]; // A
  };

  const stage = getStage();
  const grade = getGrade();

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 pb-10" dir="rtl">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-5">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border"><ArrowRight className="w-5 h-5" /></button>}
        <div className="flex items-center gap-3">
          <PerioIcon />
          <div>
            <h2 className="text-xl font-black text-gray-800">تصنيف أمراض اللثة</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-bold bg-red-50 text-red-600 px-2 py-0.5 rounded border border-red-100">للأطباء فقط ⚕️</span>
              <span className="text-xs text-gray-400 font-semibold">AAP/EFP 2017</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Info ── */}
      <div className="bg-red-50 p-4 rounded-2xl border border-red-100 mb-5 flex gap-3 text-red-800">
        <Info className="w-5 h-5 shrink-0 mt-0.5 text-red-400" />
        <div className="text-xs leading-relaxed">
          <p className="font-bold mb-1">تصنيف AAP/EFP العالمي 2017</p>
          <p>يقوم على بُعدين: <span className="font-black">المرحلة (Stage)</span> لتحديد شدة وامتداد المرض، و<span className="font-black">الدرجة (Grade)</span> لتحديد سرعة تقدمه وعوامل الخطر.</p>
        </div>
      </div>

      {/* ── Tab switch ── */}
      <div className="flex bg-gray-100 p-1.5 rounded-xl mb-5">
        <button onClick={() => setActiveTab('staging')} className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition ${activeTab === 'staging' ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}>
          📊 المرحلة (Stage)
        </button>
        <button onClick={() => setActiveTab('grading')} className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition ${activeTab === 'grading' ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}>
          ⚡ الدرجة (Grade)
        </button>
      </div>

      {activeTab === 'staging' && (
        <div className="bg-white p-5 rounded-[2rem] shadow-sm border space-y-4">
          <p className="text-xs font-black text-gray-500">أدخل القياسات السريرية:</p>

          {/* CAL */}
          <div>
            <label className="text-xs font-bold text-gray-600 mb-1.5 block">فقدان الارتباط السريري (CAL)</label>
            <div className="grid grid-cols-3 gap-2">
              {[{ v: '1-2', l: '1–2 ملم' }, { v: '3-4', l: '3–4 ملم' }, { v: '5+', l: '≥ 5 ملم' }].map(o => (
                <button key={o.v} onClick={() => setCal(o.v)}
                  className={`py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${cal === o.v ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-100 text-gray-500 hover:bg-gray-50'}`}>
                  {o.l}
                </button>
              ))}
            </div>
          </div>

          {/* Pocket depth */}
          <div>
            <label className="text-xs font-bold text-gray-600 mb-1.5 block">عمق الجيب اللثوي (Pocket Depth)</label>
            <div className="grid grid-cols-3 gap-2">
              {[{ v: 'under4', l: '≤ 4 ملم' }, { v: '5-6', l: '5–6 ملم' }, { v: 'over6', l: '≥ 6 ملم' }].map(o => (
                <button key={o.v} onClick={() => setPocket(o.v)}
                  className={`py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${pocket === o.v ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-100 text-gray-500 hover:bg-gray-50'}`}>
                  {o.l}
                </button>
              ))}
            </div>
          </div>

          {/* Radiographic bone loss */}
          <div>
            <label className="text-xs font-bold text-gray-600 mb-1.5 block">فقدان العظم الإشعاعي (Radiographic Bone Loss)</label>
            <div className="grid grid-cols-3 gap-2">
              {[{ v: 'under15', l: '< 15%' }, { v: '15-33', l: '15–33%' }, { v: 'over33', l: '> 33%' }].map(o => (
                <button key={o.v} onClick={() => setRd(o.v)}
                  className={`py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${rd === o.v ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-100 text-gray-500 hover:bg-gray-50'}`}>
                  {o.l}
                </button>
              ))}
            </div>
          </div>

          {/* Teeth lost */}
          <div>
            <label className="text-xs font-bold text-gray-600 mb-1.5 block">عدد الأسنان المفقودة بسبب اللثة</label>
            <div className="grid grid-cols-4 gap-2">
              {[{ v: '0', l: 'لا شيء' }, { v: '1-4', l: '1–4 أسنان' }, { v: '5+', l: '5+ أسنان' }].map(o => (
                <button key={o.v} onClick={() => setTeethLost(o.v)}
                  className={`col-span-1 py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${teethLost === o.v ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-100 text-gray-500 hover:bg-gray-50'}`}>
                  {o.l}
                </button>
              ))}
              <label className={`flex items-center justify-center gap-1 py-2.5 rounded-xl text-xs font-bold border-2 cursor-pointer transition-all ${masticatoryDysfunction ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-100 text-gray-500'}`}>
                <input type="checkbox" checked={masticatoryDysfunction} onChange={e => setMasticatoryDysfunction(e.target.checked)} className="w-3.5 h-3.5 accent-red-500" />
                خلل مضغ
              </label>
            </div>
          </div>

          {/* Stage result */}
          <div className={`p-5 rounded-2xl border-2 ${stage.bg}`}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-[10px] text-gray-400 font-bold mb-0.5">المرحلة المحددة</p>
                <p className={`text-2xl font-black ${stage.color}`}>{stage.label} — Stage {stage.num}</p>
              </div>
              <span className={`text-lg font-black px-3 py-1.5 rounded-xl ${stage.badge}`}>{stage.num}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3 mt-2">
              {[
                { l: 'CAL', v: stage.cal },
                { l: 'عمق الجيب', v: stage.pocket },
                { l: 'فقدان العظم', v: stage.rd },
                { l: 'فقدان الأسنان', v: stage.teeth },
              ].map((item, i) => (
                <div key={i} className="bg-white/60 p-2 rounded-xl border border-white">
                  <p className="text-[9px] text-gray-400 font-bold">{item.l}</p>
                  <p className={`text-[11px] font-black ${stage.color}`}>{item.v}</p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-gray-700 bg-white/60 p-3 rounded-xl font-semibold leading-relaxed">{stage.tip}</p>
          </div>
        </div>
      )}

      {activeTab === 'grading' && (
        <div className="bg-white p-5 rounded-[2rem] shadow-sm border space-y-4">
          <p className="text-xs font-black text-gray-500">عوامل تحديد سرعة تقدم المرض:</p>

          <div>
            <label className="text-xs font-bold text-gray-600 mb-1.5 block">التدخين</label>
            <div className="grid grid-cols-3 gap-2">
              {[{ v: 'none', l: 'غير مدخن' }, { v: 'light', l: '< 10 سجائر/يوم' }, { v: 'heavy', l: '≥ 10 سجائر/يوم' }].map(o => (
                <button key={o.v} onClick={() => setSmoker(o.v)}
                  className={`py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${smoker === o.v ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-100 text-gray-500 hover:bg-gray-50'}`}>
                  {o.l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-600 mb-1.5 block">السكري</label>
            <div className="grid grid-cols-3 gap-2">
              {[{ v: 'none', l: 'لا يوجد' }, { v: 'controlled', l: 'مضبوط HbA1c < 7%' }, { v: 'uncontrolled', l: 'غير مضبوط ≥ 7%' }].map(o => (
                <button key={o.v} onClick={() => setDiabetes(o.v)}
                  className={`py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${diabetes === o.v ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-100 text-gray-500 hover:bg-gray-50'}`}>
                  {o.l}
                </button>
              ))}
            </div>
          </div>

          {/* Grade result */}
          <div className={`p-5 rounded-2xl border-2 border-current ${grade.bg}`}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[10px] text-gray-400 font-bold mb-0.5">درجة التقدم</p>
                <p className={`text-xl font-black ${grade.color}`}>Grade {grade.letter} — {grade.label}</p>
              </div>
              <span className={`text-2xl font-black px-3 py-1.5 rounded-xl bg-white/60 ${grade.color}`}>{grade.letter}</span>
            </div>
            <p className="text-[11px] text-gray-700 bg-white/60 p-3 rounded-xl font-semibold leading-relaxed">{grade.desc}</p>
          </div>

          {/* Grade guide */}
          <div className="bg-gray-50 p-3 rounded-xl">
            <p className="text-[10px] font-black text-gray-500 mb-2">دليل الدرجات</p>
            {grades.map(g => (
              <div key={g.letter} className={`flex items-center gap-2 p-2 rounded-lg mb-1 ${g.bg}`}>
                <span className={`text-sm font-black px-2 py-0.5 rounded bg-white/60 ${g.color}`}>{g.letter}</span>
                <div>
                  <p className={`text-xs font-black ${g.color}`}>{g.label}</p>
                  <p className="text-[9px] text-gray-400 font-semibold">{g.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Sources ── */}
      <div className="mt-6 p-4 bg-gray-50 rounded-2xl border border-gray-100">
        <p className="flex items-center gap-1.5 text-xs font-black text-gray-600 mb-3"><BookOpen className="w-3.5 h-3.5"/> المصادر العلمية</p>
        <div className="space-y-2">
          {[
            { title: 'Tonetti MS et al. — New Classification (J Periodontol, 2018)', url: 'https://pubmed.ncbi.nlm.nih.gov/29926951/' },
            { title: 'Papapanou PN et al. — Periodontitis: Consensus Report (2018)', url: 'https://pubmed.ncbi.nlm.nih.gov/29926943/' },
            { title: 'AAP — 2017 World Workshop Classification', url: 'https://www.perio.org/2017-classification/' },
          ].map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-[10px] text-red-600 font-semibold hover:underline">
              <ExternalLink className="w-3 h-3 shrink-0" />{s.title}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
