import React, { useState } from 'react';
import { ArrowRight, BookOpen, ExternalLink, Info } from 'lucide-react';

interface Props { onBack?: () => void; }

// ─── SVG Icon ─────────────────────────────────────────────────────────────────
const ToothIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
    <rect width="48" height="48" rx="14" fill="#ECFEFF"/>
    {/* Tooth */}
    <path d="M15 16C15 13.239 17.239 11 20 11H28C30.761 11 33 13.239 33 16C33 19 31 21 31 24L30 37H26L24 30L22 37H18L17 24C17 21 15 19 15 16Z" fill="#CFFAFE" stroke="#06B6D4" strokeWidth="1.5" strokeLinejoin="round"/>
    {/* Crown highlight */}
    <path d="M20 16C20 14.895 20.895 14 22 14H26C27.105 14 28 14.895 28 16" stroke="#0891B2" strokeWidth="1.3" strokeLinecap="round"/>
    {/* Age marker */}
    <circle cx="36" cy="12" r="6" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="1.2"/>
    <path d="M34.5 12H36.5L36.5 15" stroke="#D97706" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="36" cy="9.5" r="0.7" fill="#D97706"/>
  </svg>
);

// ─── Teeth Data ───────────────────────────────────────────────────────────────
const teethCategories = [
  {
    group: 'الأسنان اللبنية (الحليبية)',
    color: 'sky',
    teeth: [
      { key: 'primary_incisor_lower', name: 'القواطع المركزية السفلية اللبنية', eruption: '6–10 أشهر', shed: '6–7 سنوات', stage: 'لبني' },
      { key: 'primary_incisor_upper', name: 'القواطع المركزية العلوية اللبنية', eruption: '8–12 شهراً', shed: '7–8 سنوات', stage: 'لبني' },
      { key: 'primary_lateral_upper', name: 'القواطع الجانبية العلوية اللبنية', eruption: '9–13 شهراً', shed: '8–9 سنوات', stage: 'لبني' },
      { key: 'primary_molar_first', name: 'الأرحاء الأولى اللبنية', eruption: '13–19 شهراً', shed: '9–11 سنوات', stage: 'لبني' },
      { key: 'primary_canine', name: 'الأنياب اللبنية', eruption: '16–22 شهراً', shed: '10–12 سنة', stage: 'لبني' },
      { key: 'primary_molar_second', name: 'الأرحاء الثانية اللبنية', eruption: '25–33 شهراً', shed: '10–12 سنة', stage: 'لبني' },
    ],
  },
  {
    group: 'الأسنان الدائمة',
    color: 'teal',
    teeth: [
      { key: 'perm_molar_first', name: 'الضرس الدائم الأول ("ضرس الست")', eruption: '6–7 سنوات', shed: 'دائم', stage: 'دائم' },
      { key: 'perm_incisor_lower', name: 'القواطع المركزية السفلية الدائمة', eruption: '6–7 سنوات', shed: 'دائم', stage: 'دائم' },
      { key: 'perm_incisor_upper', name: 'القواطع المركزية العلوية الدائمة', eruption: '7–8 سنوات', shed: 'دائم', stage: 'دائم' },
      { key: 'perm_lateral_upper', name: 'القواطع الجانبية العلوية الدائمة', eruption: '8–9 سنوات', shed: 'دائم', stage: 'دائم' },
      { key: 'perm_premolar_first', name: 'الضواحك الأولى الدائمة', eruption: '10–11 سنة', shed: 'دائم', stage: 'دائم' },
      { key: 'perm_canine', name: 'الأنياب الدائمة', eruption: '9–12 سنة', shed: 'دائم', stage: 'دائم' },
      { key: 'perm_premolar_second', name: 'الضواحك الثانية الدائمة', eruption: '10–12 سنة', shed: 'دائم', stage: 'دائم' },
      { key: 'perm_molar_second', name: 'الضرس الدائم الثاني', eruption: '11–13 سنة', shed: 'دائم', stage: 'دائم' },
      { key: 'perm_wisdom', name: 'ضرس العقل (الثالث)', eruption: '17–25 سنة', shed: 'دائم', stage: 'دائم' },
    ],
  },
];

const colorMap: Record<string, { border: string; bg: string; badge: string; text: string }> = {
  sky:  { border: 'border-sky-300', bg: 'bg-sky-50', badge: 'bg-sky-100 text-sky-700', text: 'text-sky-700' },
  teal: { border: 'border-teal-300', bg: 'bg-teal-50', badge: 'bg-teal-100 text-teal-700', text: 'text-teal-700' },
};

export default function DentalAgeCalc({ onBack }: Props) {
  const [selectedTooth, setSelectedTooth] = useState('');
  const [activeGroup, setActiveGroup] = useState<'لبني' | 'دائم'>('دائم');

  const allTeeth = teethCategories.flatMap(c => c.teeth);
  const selected = allTeeth.find(t => t.key === selectedTooth);
  const filteredTeeth = teethCategories.find(c => c.teeth.some(t => t.stage === activeGroup));

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 pb-10">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-5">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border border-gray-100"><ArrowRight className="w-5 h-5 text-gray-600" /></button>}
        <div className="flex items-center gap-3">
          <ToothIcon />
          <div>
            <h2 className="text-xl font-black text-gray-800">تقدير العمر السنّي</h2>
            <p className="text-xs text-gray-400 font-semibold">Dental Age Estimation</p>
          </div>
        </div>
      </div>

      {/* ── Info ── */}
      <div className="bg-cyan-50 p-4 rounded-2xl border border-cyan-100 mb-5 flex gap-3 text-cyan-800">
        <Info className="w-5 h-5 shrink-0 mt-0.5 text-cyan-400" />
        <div className="text-xs leading-relaxed">
          <p className="font-bold mb-1">الاستخدام السريري</p>
          <p>يُستخدم لتقدير عمر الطفل بناءً على مراحل بزوغ الأسنان، وهو أداة مساعدة في طب أسنان الأطفال والطب الشرعي. يُذكر أن هناك تفاوتاً طبيعياً بين الأطفال.</p>
        </div>
      </div>

      {/* ── Main card ── */}
      <div className="bg-white p-5 rounded-[2rem] shadow-sm border space-y-4">

        {/* Group switch */}
        <div className="flex bg-gray-100 p-1.5 rounded-xl">
          <button onClick={() => { setActiveGroup('لبني'); setSelectedTooth(''); }}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition ${activeGroup === 'لبني' ? 'bg-white shadow text-sky-600' : 'text-gray-500'}`}>
            🥛 الأسنان اللبنية
          </button>
          <button onClick={() => { setActiveGroup('دائم'); setSelectedTooth(''); }}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition ${activeGroup === 'دائم' ? 'bg-white shadow text-teal-600' : 'text-gray-500'}`}>
            🦷 الأسنان الدائمة
          </button>
        </div>

        <p className="text-xs font-black text-gray-500">اختر أحدث سن بَزغ (ظهر) في فم الطفل:</p>

        {teethCategories
          .filter(cat => cat.teeth.some(t => t.stage === activeGroup))
          .map(cat => {
            const c = colorMap[cat.color];
            return (
              <div key={cat.group} className="space-y-2">
                {cat.teeth.filter(t => t.stage === activeGroup).map(tooth => (
                  <button key={tooth.key} onClick={() => setSelectedTooth(tooth.key)}
                    className={`w-full text-right p-3.5 rounded-xl border-2 font-bold text-xs transition-all flex items-center justify-between ${selectedTooth === tooth.key ? `${c.border} ${c.bg} ${c.text}` : 'border-gray-100 hover:bg-gray-50 text-gray-700'}`}>
                    <span>{tooth.name}</span>
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${selectedTooth === tooth.key ? c.badge : 'bg-gray-100 text-gray-400'}`}>
                      {tooth.eruption}
                    </span>
                  </button>
                ))}
              </div>
            );
          })}
      </div>

      {/* ── Result ── */}
      {selected && (
        <div className="mt-4 p-5 bg-cyan-50 rounded-[2rem] border border-cyan-200 animate-in slide-in-from-bottom-4">
          <p className="text-[10px] font-black text-cyan-600 uppercase mb-3 text-center tracking-wider">نتيجة التقدير</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-4 rounded-2xl text-center border border-cyan-100">
              <p className="text-[9px] text-gray-400 font-bold mb-1">العمر التقديري (بزوغ)</p>
              <p className="text-lg font-black text-cyan-700">{selected.eruption}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl text-center border border-cyan-100">
              <p className="text-[9px] text-gray-400 font-bold mb-1">{selected.stage === 'لبني' ? 'موعد التساقط' : 'النوع'}</p>
              <p className="text-lg font-black text-teal-700">{selected.shed}</p>
            </div>
          </div>

          <div className="mt-3 bg-white/70 p-3 rounded-xl border border-cyan-100">
            <p className="text-xs font-bold text-gray-600 text-center">{selected.name}</p>
            <p className="text-[9px] text-gray-400 text-center mt-1 font-semibold">التفاوت الطبيعي بين الأطفال يصل لـ 12–18 شهراً</p>
          </div>
        </div>
      )}

      {/* ── Eruption timeline ── */}
      <div className="mt-4 p-4 bg-white rounded-2xl border border-gray-100">
        <p className="text-xs font-black text-gray-600 mb-3">📅 ملخص أوقات البزوغ الرئيسية</p>
        {[
          { period: '6–12 شهراً', event: 'بزوغ أول الأسنان اللبنية', color: 'bg-sky-100 text-sky-700' },
          { period: '2.5 – 3 سنوات', event: 'اكتمال أسنان الحليب (20 سن)', color: 'bg-blue-100 text-blue-700' },
          { period: '6 سنوات', event: 'أول ضرس دائم وبداية تساقط اللبنية', color: 'bg-teal-100 text-teal-700' },
          { period: '12 – 14 سنة', event: 'اكتمال معظم الأسنان الدائمة', color: 'bg-green-100 text-green-700' },
          { period: '17 – 25 سنة', event: 'ضرس العقل (قد لا يبزغ)', color: 'bg-gray-100 text-gray-600' },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-3 mb-2">
            <span className={`text-[9px] font-black px-2 py-1 rounded-full shrink-0 ${item.color}`}>{item.period}</span>
            <span className="text-[10px] text-gray-600 font-semibold">{item.event}</span>
          </div>
        ))}
      </div>

      {/* ── Sources ── */}
      <div className="mt-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
        <p className="flex items-center gap-1.5 text-xs font-black text-gray-600 mb-3"><BookOpen className="w-3.5 h-3.5"/> المصادر العلمية</p>
        <div className="space-y-2">
          {[
            { title: 'American Academy of Pediatric Dentistry — Tooth Eruption Charts', url: 'https://www.aapd.org/resources/parent/tooth-eruption-charts/' },
            { title: 'WHO — Oral Health in Children — Development & Eruption', url: 'https://www.who.int/health-topics/oral-health' },
            { title: 'Schour I & Massler M — Studies in tooth development (1940)', url: 'https://pubmed.ncbi.nlm.nih.gov/20989516/' },
          ].map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-[10px] text-cyan-600 font-semibold hover:underline">
              <ExternalLink className="w-3 h-3 shrink-0" />{s.title}
            </a>
          ))}
        </div>
      </div>

    </div>
  );
}
