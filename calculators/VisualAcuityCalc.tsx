import React, { useState } from 'react';
import { ArrowRight, BookOpen, ExternalLink, Info } from 'lucide-react';

interface Props { onBack?: () => void; }

// ─── SVG Icon ─────────────────────────────────────────────────────────────────
const EyeIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
    <rect width="48" height="48" rx="14" fill="#EEF2FF"/>
    <path d="M8 24C8 24 14 14 24 14C34 14 40 24 40 24C40 24 34 34 24 34C14 34 8 24 8 24Z" fill="#C7D2FE" stroke="#6366F1" strokeWidth="1.5" strokeLinejoin="round"/>
    <circle cx="24" cy="24" r="6" fill="#818CF8" stroke="#6366F1" strokeWidth="1.3"/>
    <circle cx="24" cy="24" r="3" fill="#4338CA"/>
    <circle cx="22" cy="22" r="1.2" fill="white" opacity="0.8"/>
    <path d="M8 24H11M37 24H40" stroke="#6366F1" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

// ─── Data ─────────────────────────────────────────────────────────────────────
interface Entry {
  snellen: string; decimal: number; logmar: number;
  desc: string; descEn: string; who: string; whoColor: string;
}

const conversions: Record<string, Entry> = {
  '6/4':  { snellen: '20/13', decimal: 1.5,  logmar: -0.18, desc: 'إبصار فوق الطبيعي',          descEn: 'Better than normal',   who: 'طبيعي',           whoColor: 'bg-emerald-100 text-emerald-700' },
  '6/5':  { snellen: '20/16', decimal: 1.2,  logmar: -0.08, desc: 'إبصار ممتاز',                 descEn: 'Excellent',            who: 'طبيعي',           whoColor: 'bg-emerald-100 text-emerald-700' },
  '6/6':  { snellen: '20/20', decimal: 1.0,  logmar: 0.0,   desc: 'إبصار طبيعي',                 descEn: 'Normal',               who: 'طبيعي',           whoColor: 'bg-emerald-100 text-emerald-700' },
  '6/7.5':{ snellen: '20/25', decimal: 0.8,  logmar: 0.1,   desc: 'إبصار جيد جداً',              descEn: 'Near normal',          who: 'طبيعي',           whoColor: 'bg-green-100 text-green-700' },
  '6/9':  { snellen: '20/30', decimal: 0.67, logmar: 0.18,  desc: 'إبصار جيد',                   descEn: 'Good',                 who: 'طبيعي',           whoColor: 'bg-green-100 text-green-700' },
  '6/12': { snellen: '20/40', decimal: 0.5,  logmar: 0.3,   desc: 'ضعف إبصار خفيف',             descEn: 'Mild impairment',      who: 'ضعف خفيف',        whoColor: 'bg-yellow-100 text-yellow-700' },
  '6/18': { snellen: '20/60', decimal: 0.33, logmar: 0.48,  desc: 'ضعف إبصار متوسط',            descEn: 'Moderate impairment',  who: 'ضعف متوسط',       whoColor: 'bg-orange-100 text-orange-700' },
  '6/24': { snellen: '20/80', decimal: 0.25, logmar: 0.6,   desc: 'ضعف إبصار ملحوظ',            descEn: 'Moderate-severe',      who: 'ضعف متوسط–شديد',  whoColor: 'bg-orange-100 text-orange-700' },
  '6/36': { snellen: '20/120',decimal: 0.17, logmar: 0.78,  desc: 'ضعف إبصار شديد',             descEn: 'Severe impairment',    who: 'ضعف شديد',        whoColor: 'bg-red-100 text-red-700' },
  '6/60': { snellen: '20/200',decimal: 0.1,  logmar: 1.0,   desc: 'عمى قانوني (حد الإعاقة)',    descEn: 'Legal blindness',      who: 'عمى قانوني',      whoColor: 'bg-red-200 text-red-800' },
  '3/60': { snellen: '20/400',decimal: 0.05, logmar: 1.3,   desc: 'ضعف إبصار بالغ الشدة',       descEn: 'Near blindness',       who: 'عمى',             whoColor: 'bg-gray-200 text-gray-700' },
  '1/60': { snellen: '20/1200',decimal: 0.016,logmar:1.78,  desc: 'عمى شبه كامل (عدّ أصابع)',   descEn: 'Counting fingers',     who: 'عمى',             whoColor: 'bg-gray-200 text-gray-700' },
};

// Visual bar segments
const scaleSegments = [
  { label: '6/4–6/6', color: 'bg-emerald-400', range: [0, 3] },
  { label: '6/9–6/12', color: 'bg-yellow-400', range: [3, 5] },
  { label: '6/18–6/36', color: 'bg-orange-400', range: [5, 8] },
  { label: '6/60+', color: 'bg-red-500', range: [8, 12] },
];

const keys = Object.keys(conversions);

export default function VisualAcuityCalc({ onBack }: Props) {
  const [value, setValue] = useState('6/6');
  const [mode, setMode] = useState<'metric' | 'snellen' | 'logmar'>('metric');

  const current = conversions[value];
  const idx = keys.indexOf(value);
  const barPercent = Math.min(100, (idx / (keys.length - 1)) * 100);

  const handleSnellenInput = (v: string) => {
    const match = Object.entries(conversions).find(([, e]) => e.snellen === v);
    if (match) setValue(match[0]);
  };

  const handleLogmarInput = (v: string) => {
    const num = parseFloat(v);
    const match = Object.entries(conversions).sort((a, b) =>
      Math.abs(a[1].logmar - num) - Math.abs(b[1].logmar - num)
    )[0];
    if (match) setValue(match[0]);
  };

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 pb-10 text-right" dir="rtl">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-5">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border"><ArrowRight className="w-5 h-5" /></button>}
        <div className="flex items-center gap-3">
          <EyeIcon />
          <div>
            <h2 className="text-xl font-black text-gray-800">تحويل حدة الإبصار</h2>
            <p className="text-xs text-gray-400 font-semibold">Visual Acuity Converter</p>
          </div>
        </div>
      </div>

      {/* ── Info ── */}
      <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 mb-5 flex gap-3 text-indigo-800">
        <Info className="w-5 h-5 shrink-0 mt-0.5 text-indigo-400" />
        <div className="text-xs leading-relaxed">
          <p className="font-bold mb-1">أنظمة قياس حدة الإبصار</p>
          <p><span className="font-black">المتري (6/6)</span> — مسافة 6 أمتار (يُستخدم في معظم العالم). <span className="font-black">Snellen (20/20)</span> — مسافة 20 قدم (يُستخدم في أمريكا). <span className="font-black">LogMAR</span> — نظام الجذر اللوغاريتمي (الأبحاث السريرية).</p>
        </div>
      </div>

      {/* ── Mode selector ── */}
      <div className="flex bg-gray-100 p-1.5 rounded-xl mb-4">
        {[{ v: 'metric', l: 'متري 6/6' }, { v: 'snellen', l: 'Snellen 20/20' }, { v: 'logmar', l: 'LogMAR' }].map(m => (
          <button key={m.v} onClick={() => setMode(m.v as any)}
            className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition ${mode === m.v ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}>
            {m.l}
          </button>
        ))}
      </div>

      <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-gray-100">

        {/* Input based on mode */}
        {mode === 'metric' && (
          <div className="mb-5">
            <label className="text-xs font-bold text-gray-600 mb-1.5 block">اختر قيمة حدة الإبصار (المتري)</label>
            <select value={value} onChange={e => setValue(e.target.value)}
              className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl font-black text-xl outline-none focus:border-indigo-400">
              {keys.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
            {/* Quick buttons */}
            <div className="flex gap-2 mt-2 flex-wrap">
              {['6/4', '6/6', '6/12', '6/18', '6/36', '6/60'].map(k => (
                <button key={k} onClick={() => setValue(k)}
                  className={`text-[10px] font-black px-2.5 py-1 rounded-full border transition ${value === k ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                  {k}
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === 'snellen' && (
          <div className="mb-5">
            <label className="text-xs font-bold text-gray-600 mb-1.5 block">اختر قيمة Snellen (20/…)</label>
            <select value={current.snellen} onChange={e => handleSnellenInput(e.target.value)}
              className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl font-black text-xl outline-none focus:border-indigo-400">
              {Object.entries(conversions).map(([, e]) => <option key={e.snellen} value={e.snellen}>{e.snellen}</option>)}
            </select>
          </div>
        )}

        {mode === 'logmar' && (
          <div className="mb-5">
            <label className="text-xs font-bold text-gray-600 mb-1.5 block">أدخل قيمة LogMAR</label>
            <input type="number" step="0.1" defaultValue={current.logmar}
              onBlur={e => handleLogmarInput(e.target.value)}
              className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl font-black text-xl outline-none focus:border-indigo-400 dir-ltr" />
            <p className="text-[9px] text-gray-400 font-semibold mt-1">القيم: -0.2 (فوق الطبيعي) إلى 1.8 (عمى شبه كامل)</p>
          </div>
        )}

        {/* Visual scale bar */}
        <div className="mb-5">
          <div className="flex justify-between text-[9px] text-gray-400 font-bold mb-1.5">
            <span>ممتاز</span><span>ضعيف</span><span>عمى</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden flex">
            <div className="flex-1 bg-emerald-300 rounded-r-full"/>
            <div className="flex-1 bg-yellow-300"/>
            <div className="flex-1 bg-orange-400"/>
            <div className="flex-1 bg-red-500 rounded-l-full"/>
          </div>
          <div className="relative h-4 mt-1">
            <div className="absolute h-4 w-1 bg-indigo-600 rounded-full transition-all duration-500"
              style={{ right: `${100 - barPercent}%` }}>
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-indigo-600 rounded-full shadow"/>
            </div>
          </div>
        </div>

        {/* Result grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-indigo-50 p-4 rounded-2xl text-center border border-indigo-100">
            <p className="text-[9px] font-black text-indigo-400 uppercase mb-1">متري</p>
            <p className="text-2xl font-black text-indigo-700">{value}</p>
          </div>
          <div className="bg-indigo-50 p-4 rounded-2xl text-center border border-indigo-100">
            <p className="text-[9px] font-black text-indigo-400 uppercase mb-1">Snellen</p>
            <p className="text-2xl font-black text-indigo-700">{current.snellen}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-2xl text-center border border-gray-100">
            <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Decimal</p>
            <p className="text-xl font-black text-gray-700">{current.decimal.toFixed(2)}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-2xl text-center border border-gray-100">
            <p className="text-[9px] font-black text-gray-400 uppercase mb-1">LogMAR</p>
            <p className="text-xl font-black text-gray-700">{current.logmar.toFixed(2)}</p>
          </div>
          <div className="col-span-2 bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-indigo-500 mb-0.5">التقييم السريري</p>
                <p className="font-black text-gray-800 text-sm">{current.desc}</p>
                <p className="text-[10px] text-gray-400 font-semibold">{current.descEn}</p>
              </div>
              <span className={`text-[10px] font-black px-2.5 py-1.5 rounded-xl ${current.whoColor}`}>{current.who}</span>
            </div>
          </div>
        </div>

        {/* WHO categories note */}
        <div className="mt-4 bg-amber-50 p-3 rounded-xl border border-amber-100">
          <p className="text-[10px] font-black text-amber-700 mb-1">تصنيف WHO لضعف الإبصار</p>
          <p className="text-[9px] text-amber-600 font-semibold leading-relaxed">خفيف: &lt; 6/12 | متوسط: &lt; 6/18 | شديد: &lt; 6/60 | عمى: &lt; 3/60 أو مجال رؤية &lt; 10°</p>
        </div>
      </div>

      {/* ── Snellen chart reference ── */}
      <div className="mt-4 bg-white p-4 rounded-2xl border border-gray-100">
        <p className="text-xs font-black text-gray-600 mb-3">📊 جدول تحويل كامل</p>
        <div className="space-y-1.5">
          {Object.entries(conversions).map(([k, e]) => (
            <button key={k} onClick={() => setValue(k)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border transition-all ${value === k ? 'border-indigo-300 bg-indigo-50' : 'border-gray-50 hover:bg-gray-50'}`}>
              <span className="font-black text-xs text-indigo-700 w-12">{k}</span>
              <span className="text-[10px] text-gray-400 font-mono w-16">{e.snellen}</span>
              <span className="text-[10px] text-gray-400 font-mono w-12">{e.logmar.toFixed(2)}</span>
              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${e.whoColor}`}>{e.who}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Sources ── */}
      <div className="mt-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
        <p className="flex items-center gap-1.5 text-xs font-black text-gray-600 mb-3"><BookOpen className="w-3.5 h-3.5"/> المصادر العلمية</p>
        <div className="space-y-2">
          {[
            { title: 'AAO — Visual Acuity Measurement (2020)', url: 'https://www.aao.org/eye-health/tips-prevention/visual-acuity-what-is-20-20-vision' },
            { title: 'WHO — Visual Impairment Classification (ICD-11)', url: 'https://www.who.int/news-room/fact-sheets/detail/blindness-and-visual-impairment' },
            { title: 'Bailey IL & Lovie JE — LogMAR Chart Design (1980)', url: 'https://pubmed.ncbi.nlm.nih.gov/7406069/' },
          ].map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-[10px] text-indigo-600 font-semibold hover:underline">
              <ExternalLink className="w-3 h-3 shrink-0" />{s.title}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
