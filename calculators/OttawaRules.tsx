import React, { useState } from 'react';
import { ArrowRight, BookOpen, ExternalLink, Info, AlertCircle, CheckCircle2 } from 'lucide-react';

interface Props { onBack?: () => void; }

// ─── SVG Icon ─────────────────────────────────────────────────────────────────
const OttawaIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
    <rect width="48" height="48" rx="14" fill="#FFF1F2"/>
    {/* Leg/ankle shape */}
    <path d="M20 8C20 8 18 20 18 28C18 33 20 36 24 37C28 38 31 36 32 33C33 30 32 26 30 22C28 18 27 8 27 8H20Z" fill="#FECDD3" stroke="#F43F5E" strokeWidth="1.3"/>
    {/* Bone indicator */}
    <path d="M20 28H30" stroke="#BE123C" strokeWidth="1.5" strokeLinecap="round"/>
    {/* Tender spots */}
    <circle cx="19" cy="30" r="2.5" fill="#FCA5A5" stroke="#F43F5E" strokeWidth="1"/>
    <circle cx="31" cy="30" r="2.5" fill="#FCA5A5" stroke="#F43F5E" strokeWidth="1"/>
    {/* X-ray icon */}
    <rect x="32" y="8" width="10" height="13" rx="2" fill="#FEF2F2" stroke="#F43F5E" strokeWidth="1"/>
    <path d="M34 11L40 19M40 11L34 19" stroke="#F43F5E" strokeWidth="1.2" strokeLinecap="round"/>
    <path d="M35 14.5H39" stroke="#F43F5E" strokeWidth="1" strokeLinecap="round"/>
  </svg>
);

// ─── Criteria data ────────────────────────────────────────────────────────────
const ankleCriteria = [
  {
    id: 'posterior_lateral',
    label: 'ألم عند الضغط على الجزء الخلفي للكعب الخارجي (Lateral Malleolus)',
    sub: 'آخر 6 سم من الكعب الخارجي',
    zone: 'A',
  },
  {
    id: 'posterior_medial',
    label: 'ألم عند الضغط على الجزء الخلفي للكعب الداخلي (Medial Malleolus)',
    sub: 'آخر 6 سم من الكعب الداخلي',
    zone: 'B',
  },
  {
    id: 'weight_bearing_ankle',
    label: 'عدم القدرة على حمل الوزن والمشي 4 خطوات (فوراً وفي العيادة)',
    sub: 'المشية مؤلمة جداً تمنع الوزن الكامل',
    zone: null,
  },
];

const footCriteria = [
  {
    id: 'navicular',
    label: 'ألم عند الضغط على منطقة الزورقي (Navicular)',
    sub: 'مقدمة القدم الداخلية',
    zone: 'C',
  },
  {
    id: 'fifth_metatarsal',
    label: 'ألم عند الضغط على قاعدة مشط القدم الخامس (5th Metatarsal)',
    sub: 'نتوء الجانب الخارجي لمنتصف القدم',
    zone: 'D',
  },
  {
    id: 'weight_bearing_foot',
    label: 'عدم القدرة على حمل الوزن والمشي 4 خطوات',
    sub: 'نفس معيار الكاحل',
    zone: null,
  },
];

const kneeCriteria = [
  {
    id: 'patella',
    label: 'ألم معزول عند الضغط على الرضفة (Patella)',
    sub: 'صابونة الركبة — الألم بلا كدمة نسيجية',
    zone: null,
  },
  {
    id: 'fibula_head',
    label: 'ألم عند الضغط على رأس الشظية (Fibula Head)',
    sub: 'الجانب الخارجي لأسفل الركبة',
    zone: null,
  },
  {
    id: 'flexion_90',
    label: 'عدم القدرة على ثني الركبة 90 درجة',
    sub: 'صعوبة الثني الكامل',
    zone: null,
  },
  {
    id: 'weight_bearing_knee',
    label: 'عدم القدرة على المشي 4 خطوات',
    sub: 'نفس معيار الكاحل',
    zone: null,
  },
];

export default function OttawaRules({ onBack }: Props) {
  const [mode, setMode] = useState<'ankle' | 'knee'>('ankle');
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => setChecked(prev => ({ ...prev, [id]: !prev[id] }));

  const currentCriteria = mode === 'ankle'
    ? [...ankleCriteria, ...footCriteria]
    : kneeCriteria;

  const anyChecked = currentCriteria.some(c => checked[c.id]);
  const needsXray = anyChecked;

  const resetAll = () => setChecked({});

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 pb-10 text-right" dir="rtl">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-5">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border"><ArrowRight className="w-5 h-5" /></button>}
        <div className="flex items-center gap-3">
          <OttawaIcon />
          <div>
            <h2 className="text-xl font-black text-gray-800">قواعد Ottawa للأشعة</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-bold bg-red-50 text-red-600 px-2 py-0.5 rounded border border-red-100">للأطباء فقط ⚕️</span>
              <span className="text-xs text-gray-400 font-semibold">Ottawa Rules</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Info ── */}
      <div className="bg-red-50 p-4 rounded-2xl border border-red-100 mb-5 flex gap-3 text-red-800">
        <Info className="w-5 h-5 shrink-0 mt-0.5 text-red-400" />
        <div className="text-xs leading-relaxed">
          <p className="font-bold mb-1">الاستخدام السريري</p>
          <p>أداة سريرية معتمدة عالمياً لتقرير ضرورة إجراء أشعة X لإصابات الكاحل والقدم والركبة الحادة. الحساسية 96–99% لاستبعاد الكسور. تُطبّق فقط على الإصابات الحادة (أقل من 10 أيام).</p>
        </div>
      </div>

      {/* ── Mode switch ── */}
      <div className="flex bg-gray-100 p-1.5 rounded-xl mb-5">
        <button onClick={() => { setMode('ankle'); resetAll(); }}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${mode === 'ankle' ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}>
          🦶 كاحل وقدم
        </button>
        <button onClick={() => { setMode('knee'); resetAll(); }}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${mode === 'knee' ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}>
          🦵 ركبة
        </button>
      </div>

      {/* ── Criteria ── */}
      <div className="bg-white p-5 rounded-[2rem] shadow-sm border space-y-4">

        {mode === 'ankle' && (
          <>
            <p className="text-xs font-black text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">🦴 معايير الكاحل — Ottawa Ankle Rules</p>
            {ankleCriteria.map(c => (
              <label key={c.id} className={`flex items-start gap-3 p-3.5 border-2 rounded-xl cursor-pointer transition-all ${checked[c.id] ? 'border-red-400 bg-red-50' : 'border-gray-100 hover:bg-gray-50'}`}>
                <input type="checkbox" checked={!!checked[c.id]} onChange={() => toggle(c.id)} className="w-5 h-5 accent-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-xs text-gray-800">{c.label}</p>
                  <p className="text-[9px] text-gray-400 font-semibold mt-0.5 italic">{c.sub}</p>
                </div>
              </label>
            ))}
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-black text-gray-500 bg-gray-50 px-3 py-2 rounded-lg mb-3">🦴 معايير القدم — Ottawa Foot Rules</p>
              {footCriteria.map(c => (
                <label key={c.id} className={`flex items-start gap-3 p-3.5 border-2 rounded-xl cursor-pointer transition-all mb-2 ${checked[c.id] ? 'border-red-400 bg-red-50' : 'border-gray-100 hover:bg-gray-50'}`}>
                  <input type="checkbox" checked={!!checked[c.id]} onChange={() => toggle(c.id)} className="w-5 h-5 accent-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-xs text-gray-800">{c.label}</p>
                    <p className="text-[9px] text-gray-400 font-semibold mt-0.5 italic">{c.sub}</p>
                  </div>
                </label>
              ))}
            </div>
          </>
        )}

        {mode === 'knee' && (
          <>
            <p className="text-xs font-black text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">🦵 معايير الركبة — Ottawa Knee Rules</p>
            {kneeCriteria.map(c => (
              <label key={c.id} className={`flex items-start gap-3 p-3.5 border-2 rounded-xl cursor-pointer transition-all ${checked[c.id] ? 'border-red-400 bg-red-50' : 'border-gray-100 hover:bg-gray-50'}`}>
                <input type="checkbox" checked={!!checked[c.id]} onChange={() => toggle(c.id)} className="w-5 h-5 accent-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-xs text-gray-800">{c.label}</p>
                  <p className="text-[9px] text-gray-400 font-semibold mt-0.5 italic">{c.sub}</p>
                </div>
              </label>
            ))}
          </>
        )}

        {/* Decision */}
        <div className={`p-5 rounded-2xl border-2 text-center transition-all ${!anyChecked ? 'bg-gray-50 border-gray-200' : needsXray ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-300'}`}>
          {!anyChecked ? (
            <p className="text-xs text-gray-400 font-bold">حدد الأعراض الموجودة للحصول على التوصية</p>
          ) : needsXray ? (
            <div>
              <div className="flex items-center justify-center gap-2 mb-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <p className="text-red-700 font-black text-sm">يُنصح بعمل أشعة (X-ray)</p>
              </div>
              <p className="text-[11px] text-red-600 font-semibold leading-relaxed">
                وجود أحد معايير Ottawa يستوجب إجراء أشعة للكشف عن الكسر.
              </p>
              <div className="mt-3 bg-white/70 p-3 rounded-xl">
                <p className="text-[10px] text-gray-600 font-bold">
                  {mode === 'ankle'
                    ? '📌 للكاحل: AP + Lateral + Mortise views\nللقدم: AP + Lateral + Oblique views'
                    : '📌 للركبة: AP + Lateral views'}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <p className="text-green-700 font-black text-sm">لا حاجة للأشعة</p>
            </div>
          )}
        </div>

        <button onClick={resetAll} className="w-full text-xs text-gray-400 font-bold hover:text-gray-600 py-2 transition-colors">
          ↩ إعادة ضبط
        </button>
      </div>

      {/* ── Clinical notes ── */}
      <div className="mt-4 bg-amber-50 p-4 rounded-2xl border border-amber-100">
        <p className="text-xs font-black text-amber-700 mb-2">⚠️ موانع تطبيق القاعدة</p>
        {['المريض أقل من 18 سنة (دقة أقل)', 'الحمل', 'الإصابة القديمة (أكثر من 10 أيام)', 'حالة سكر الحس (Altered sensation)', 'إصابات متعددة تشتت الانتباه'].map((n, i) => (
          <p key={i} className="text-[10px] text-amber-600 font-semibold mb-1">• {n}</p>
        ))}
      </div>

      {/* ── Sources ── */}
      <div className="mt-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
        <p className="flex items-center gap-1.5 text-xs font-black text-gray-600 mb-3"><BookOpen className="w-3.5 h-3.5"/> المصادر العلمية</p>
        <div className="space-y-2">
          {[
            { title: 'Stiell IG et al. — Ottawa Ankle Rules (JAMA, 1994)', url: 'https://pubmed.ncbi.nlm.nih.gov/8258895/' },
            { title: 'Stiell IG et al. — Ottawa Knee Rules (Ann Emerg Med, 1996)', url: 'https://pubmed.ncbi.nlm.nih.gov/8610825/' },
            { title: 'Bachmann LM — Accuracy of Ottawa ankle rules (BMJ, 2003)', url: 'https://pubmed.ncbi.nlm.nih.gov/12543835/' },
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
