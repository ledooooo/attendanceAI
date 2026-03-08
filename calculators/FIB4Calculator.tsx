import React, { useState } from 'react';
import { ArrowRight, BookOpen, Save, Loader2, ExternalLink, Info } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

interface Props { onBack?: () => void; }

// ─── SVG Icon ─────────────────────────────────────────────────────────────────
const FIB4Icon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
    <rect width="48" height="48" rx="14" fill="#FFF7ED"/>
    {/* Liver shape */}
    <path d="M10 22C10 16 14 11 22 11C30 11 38 15 38 24C38 32 32 37 24 37C16 37 10 32 10 26V22Z" fill="#FED7AA" stroke="#F97316" strokeWidth="1.5" strokeLinejoin="round"/>
    {/* Fibrosis pattern lines */}
    <path d="M16 20L32 20" stroke="#EA580C" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
    <path d="M15 24L33 24" stroke="#EA580C" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
    <path d="M16 28L30 28" stroke="#EA580C" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
    <path d="M20 15L20 33" stroke="#EA580C" strokeWidth="1" strokeLinecap="round" opacity="0.3"/>
    <path d="M26 13L26 35" stroke="#EA580C" strokeWidth="1" strokeLinecap="round" opacity="0.3"/>
    {/* Warning dot */}
    <circle cx="34" cy="14" r="5" fill="#FEF2F2" stroke="#F87171" strokeWidth="1.2"/>
    <path d="M34 11.5V14" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="34" cy="16" r="0.7" fill="#EF4444"/>
  </svg>
);

// ─── Fibrosis Stage Visual ────────────────────────────────────────────────────
const FibrosisBar = ({ score }: { score: number }) => {
  const stages = [
    { label: 'F0-F1', color: '#22C55E', max: 1.3 },
    { label: 'F2', color: '#F59E0B', max: 2.67 },
    { label: 'F3-F4', color: '#EF4444', max: 6 },
  ];
  const clamp = Math.min(score, 6);
  const pct = (clamp / 6) * 100;
  return (
    <div className="mt-3">
      <div className="flex rounded-full overflow-hidden h-3">
        <div style={{ width: '30%', backgroundColor: '#22C55E' }} />
        <div style={{ width: '28%', backgroundColor: '#F59E0B' }} />
        <div style={{ width: '42%', backgroundColor: '#EF4444' }} />
      </div>
      <div className="relative h-4 mt-0.5">
        <div style={{ left: `${Math.min(pct, 96)}%` }} className="absolute top-0 transform -translate-x-1/2">
          <div className="w-3 h-3 bg-gray-800 rotate-45 rounded-sm" />
        </div>
      </div>
      <div className="flex mt-1">
        {stages.map((s, i) => (
          <div key={i} className="text-center" style={{ width: i === 0 ? '30%' : i === 1 ? '28%' : '42%' }}>
            <div className="text-[9px] font-bold" style={{ color: s.color }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function FIB4Calculator({ onBack }: Props) {
  const [age, setAge] = useState('');
  const [ast, setAst] = useState('');
  const [alt, setAlt] = useState('');
  const [plt, setPlt] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const calculate = () => {
    const a = parseFloat(age), s = parseFloat(ast), l = parseFloat(alt), p = parseFloat(plt);
    if (!a || !s || !l || !p) { toast.error('يرجى إدخال جميع القيم'); return; }
    if (l <= 0) { toast.error('قيمة ALT يجب أن تكون أكبر من صفر'); return; }

    const fib4 = (a * s) / (p * Math.sqrt(l));
    const score = parseFloat(fib4.toFixed(2));

    // Age-adjusted cutoffs
    const lowCutoff = a >= 65 ? 2.0 : 1.30;
    const highCutoff = a >= 65 ? 4.0 : 2.67;

    let stage = '', rec = '', color = '', bg = '', tip = '';

    if (fib4 < lowCutoff) {
      stage = 'F0 – F1 (خطر منخفض)'; color = 'text-green-700'; bg = 'bg-green-50 border-green-200';
      rec = 'احتمالية منخفضة جداً لوجود تليف متقدم.';
      tip = 'متابعة سنوية مع تكرار الفحص. لا حاجة لتصوير فيبروسكان في الغالب.';
    } else if (fib4 > highCutoff) {
      stage = 'F3 – F4 (تليف متقدم)'; color = 'text-red-700'; bg = 'bg-red-50 border-red-200';
      rec = 'احتمالية عالية لتليف كبدي متقدم أو تشمع.';
      tip = 'يُنصح بإحالة المريض لطبيب كبد وإجراء فيبروسكان أو خزعة كبدية.';
    } else {
      stage = 'F2 (غير محدد — Indeterminate)'; color = 'text-orange-600'; bg = 'bg-orange-50 border-orange-200';
      rec = 'النتيجة في المنطقة الرمادية — تحتاج تحقيقاً إضافياً.';
      tip = 'يُنصح بإجراء فحص FibroScan أو ELF test لتحديد درجة التليف بدقة.';
    }

    setResult({ score, stage, rec, color, bg, tip, lowCutoff, highCutoff });
  };

  const saveResult = async () => {
    if (!result) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول');
      await supabase.from('saved_calculations').insert({
        user_id: user.id, title: 'مؤشر تليف الكبد (FIB-4)',
        result: `${result.score} — ${result.stage}`,
        input_data: { age, ast, alt, plt }
      });
      toast.success('تم الحفظ');
    } catch (err: any) { toast.error(err.message); } finally { setLoading(false); }
  };

  const inputs = [
    { label: 'العمر (سنوات)', val: age, set: setAge, ph: '45', unit: 'years' },
    { label: 'الصفائح الدموية', val: plt, set: setPlt, ph: '250', unit: '10⁹/L' },
    { label: 'AST', val: ast, set: setAst, ph: '40', unit: 'U/L' },
    { label: 'ALT', val: alt, set: setAlt, ph: '35', unit: 'U/L' },
  ];

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 pb-10">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-5">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border"><ArrowRight className="w-5 h-5" /></button>}
        <div className="flex items-center gap-3">
          <FIB4Icon />
          <div>
            <h2 className="text-xl font-black text-gray-800">مؤشر FIB-4 لتليف الكبد</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-bold bg-red-50 text-red-600 px-2 py-0.5 rounded border border-red-100">للأطباء فقط ⚕️</span>
              <span className="text-xs text-gray-400 font-semibold">Liver Fibrosis Index</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Info ── */}
      <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 mb-5 flex gap-3 text-orange-800">
        <Info className="w-5 h-5 shrink-0 mt-0.5 text-orange-400" />
        <div className="text-xs leading-relaxed">
          <p className="font-bold mb-1">الاستخدام السريري</p>
          <p>مؤشر غير جراحي لتقدير درجة التليف الكبدي لدى مرضى الكبد الدهني (NAFLD/MASLD) والتهاب الكبد الفيروسي، يُغني عن الخزعة في كثير من الحالات.</p>
          <p className="mt-1 font-bold text-[10px]">المعادلة: FIB-4 = (العمر × AST) ÷ (الصفائح × √ALT)</p>
        </div>
      </div>

      {/* ── Form ── */}
      <div className="bg-white p-5 rounded-[2rem] shadow-sm border mb-4">
        <div className="grid grid-cols-2 gap-3 mb-4">
          {inputs.map((inp, i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-gray-600">{inp.label}</label>
                <span className="text-[9px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{inp.unit}</span>
              </div>
              <input type="number" value={inp.val} onChange={e => inp.set(e.target.value)}
                className="w-full p-3 border rounded-xl font-bold bg-gray-50 focus:bg-white focus:border-orange-400 outline-none text-sm"
                placeholder={inp.ph} />
            </div>
          ))}
        </div>
        <button onClick={calculate} className="w-full bg-gray-800 text-white font-black py-3.5 rounded-xl hover:bg-gray-900 active:scale-95 transition-all">
          احسب المؤشر
        </button>
      </div>

      {/* ── Result ── */}
      {result && (
        <div className={`p-6 rounded-[2rem] border-2 text-center animate-in slide-in-from-bottom-4 ${result.bg}`}>
          <p className="text-xs text-gray-400 font-bold mb-1">قيمة FIB-4</p>
          <div className={`text-5xl font-black mb-1 ${result.color}`}>{result.score}</div>
          <p className={`text-sm font-black inline-block px-4 py-1 rounded-lg bg-white/60 ${result.color}`}>{result.stage}</p>
          <FibrosisBar score={result.score} />
          <div className="grid grid-cols-2 gap-2 mt-3 mb-3">
            <div className="bg-white/60 p-2 rounded-xl border border-white text-center">
              <p className="text-[9px] text-gray-400 font-bold">حد الخطر المنخفض</p>
              <p className="font-black text-green-600 text-base">&lt; {result.lowCutoff}</p>
            </div>
            <div className="bg-white/60 p-2 rounded-xl border border-white text-center">
              <p className="text-[9px] text-gray-400 font-bold">حد الخطر المرتفع</p>
              <p className="font-black text-red-600 text-base">&gt; {result.highCutoff}</p>
            </div>
          </div>
          <p className="text-xs text-gray-600 bg-white/50 p-3 rounded-xl font-semibold leading-relaxed">{result.tip}</p>
          <button onClick={saveResult} disabled={loading}
            className="mt-3 w-full flex justify-center gap-2 text-sm bg-white text-orange-700 px-5 py-3 rounded-xl font-bold border hover:bg-orange-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ النتيجة
          </button>
        </div>
      )}

      {/* ── Sources ── */}
      <div className="mt-6 p-4 bg-gray-50 rounded-2xl border border-gray-100">
        <p className="flex items-center gap-1.5 text-xs font-black text-gray-600 mb-3"><BookOpen className="w-3.5 h-3.5"/> المصادر العلمية</p>
        <div className="space-y-2">
          {[
            { title: 'Sterling RK et al. — Development of FIB-4 index (Hepatology, 2006)', url: 'https://pubmed.ncbi.nlm.nih.gov/16729309/' },
            { title: 'AASLD/EASL — NAFLD Clinical Practice Guidelines 2023', url: 'https://www.journal-of-hepatology.eu/article/S0168-8278(23)00327-1/fulltext' },
            { title: 'European Association — Non-invasive fibrosis tests in NAFLD', url: 'https://www.easl.eu/research/our-contributions/clinical-practice-guidelines' },
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
