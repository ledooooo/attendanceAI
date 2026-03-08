import React, { useState } from 'react';
import { ArrowRight, BookOpen, ExternalLink, Info, CheckCircle2, Shield } from 'lucide-react';

interface Props { onBack?: () => void; }

// ─── SVG Icon ─────────────────────────────────────────────────────────────────
const VaccineIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
    <rect width="48" height="48" rx="14" fill="#ECFDF5"/>
    {/* Syringe body */}
    <path d="M34 8L40 14" stroke="#10B981" strokeWidth="2" strokeLinecap="round"/>
    <rect x="14" y="16" width="22" height="7" rx="2.5" fill="#A7F3D0" stroke="#10B981" strokeWidth="1.3" transform="rotate(-45 14 16)"/>
    {/* Needle */}
    <path d="M10 38L16 32" stroke="#10B981" strokeWidth="2" strokeLinecap="round"/>
    {/* Plunger */}
    <path d="M32 12L36 16" stroke="#10B981" strokeWidth="2" strokeLinecap="round"/>
    {/* Shield */}
    <path d="M30 26C30 26 36 28 36 34C36 37 33 39 30 40C27 39 24 37 24 34C24 28 30 26 30 26Z" fill="#D1FAE5" stroke="#10B981" strokeWidth="1.2"/>
    <path d="M27.5 33.5L29.5 35.5L33 31" stroke="#10B981" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ─── Schedule ─────────────────────────────────────────────────────────────────
interface VaxItem {
  age: string;
  sortKey: number;
  vac: string;
  vacEn: string;
  type: string;
  note: string;
  category: 'mandatory' | 'recommended';
  color: string;
}

const schedule: VaxItem[] = [
  { age: 'عند الولادة', sortKey: 0, vac: 'التهاب الكبد B (الجرعة الصفرية)', vacEn: 'Hepatitis B — Dose 0', type: 'حقن عضل', note: 'خلال 24 ساعة من الولادة', category: 'mandatory', color: 'bg-cyan-500' },
  { age: 'عند الولادة', sortKey: 0, vac: 'شلل الأطفال الفموي (OPV — الجرعة الصفرية)', vacEn: 'OPV Dose 0', type: 'نقط فم', note: 'خلال أول أيام الولادة', category: 'mandatory', color: 'bg-cyan-500' },
  { age: 'عند الولادة', sortKey: 0, vac: 'السل (BCG)', vacEn: 'BCG', type: 'حقن في الجلد (كتف أيسر)', note: 'حتى 40 يوماً من الولادة', category: 'mandatory', color: 'bg-cyan-500' },
  { age: 'شهرين', sortKey: 2, vac: 'الخماسي: DTP + Hib + Hep B', vacEn: 'Pentavalent Vaccine', type: 'حقن عضل (فخذ أيسر)', note: 'يتضمن: دفتيريا، تيتانوس، سعال ديكي، المستدمية النزلية B، التهاب الكبد B', category: 'mandatory', color: 'bg-teal-500' },
  { age: 'شهرين', sortKey: 2, vac: 'شلل الأطفال الفموي (OPV)', vacEn: 'OPV', type: 'نقط فم', note: 'الجرعة الأولى', category: 'mandatory', color: 'bg-teal-500' },
  { age: 'شهرين', sortKey: 2, vac: 'شلل الأطفال المعطّل (IPV)', vacEn: 'IPV', type: 'حقن عضل', note: 'الجرعة الأولى — يُدار مع OPV', category: 'mandatory', color: 'bg-teal-500' },
  { age: 'شهرين', sortKey: 2, vac: 'الروتاviروس (Rota)', vacEn: 'Rotavirus Vaccine', type: 'نقط فم', note: 'جرعة أولى — يقي من الإسهال الشديد', category: 'recommended', color: 'bg-teal-500' },
  { age: '4 شهور', sortKey: 4, vac: 'الخماسي: DTP + Hib + Hep B', vacEn: 'Pentavalent — Dose 2', type: 'حقن عضل', note: 'الجرعة الثانية', category: 'mandatory', color: 'bg-green-500' },
  { age: '4 شهور', sortKey: 4, vac: 'شلل الأطفال الفموي والمعطّل (OPV + IPV)', vacEn: 'OPV + IPV Dose 2', type: 'نقط + حقن', note: 'الجرعة الثانية', category: 'mandatory', color: 'bg-green-500' },
  { age: '4 شهور', sortKey: 4, vac: 'الروتاviروس (Rota)', vacEn: 'Rotavirus — Dose 2', type: 'نقط فم', note: 'الجرعة الثانية', category: 'recommended', color: 'bg-green-500' },
  { age: '6 شهور', sortKey: 6, vac: 'الخماسي: DTP + Hib + Hep B', vacEn: 'Pentavalent — Dose 3', type: 'حقن عضل', note: 'الجرعة الثالثة والأخيرة من السلسلة الأولى', category: 'mandatory', color: 'bg-lime-500' },
  { age: '6 شهور', sortKey: 6, vac: 'شلل الأطفال الفموي (OPV)', vacEn: 'OPV Dose 3', type: 'نقط فم', note: '', category: 'mandatory', color: 'bg-lime-500' },
  { age: '9 شهور', sortKey: 9, vac: 'شلل الأطفال الفموي (OPV)', vacEn: 'OPV Dose 4', type: 'نقط فم', note: '', category: 'mandatory', color: 'bg-yellow-500' },
  { age: '12 شهر', sortKey: 12, vac: 'شلل الأطفال الفموي (OPV)', vacEn: 'OPV Dose 5', type: 'نقط فم', note: '', category: 'mandatory', color: 'bg-orange-400' },
  { age: '12 شهر', sortKey: 12, vac: 'الحصبة والنكاف والحصبة الألمانية (MMR)', vacEn: 'MMR — Dose 1', type: 'حقن تحت الجلد (كتف أيمن)', note: 'الجرعة الأولى', category: 'mandatory', color: 'bg-orange-400' },
  { age: '12 شهر', sortKey: 12, vac: 'الالتهاب الرئوي (PCV13)', vacEn: 'Pneumococcal Vaccine', type: 'حقن عضل', note: 'يقي من التهاب السحايا والرئة', category: 'recommended', color: 'bg-orange-400' },
  { age: '18 شهر', sortKey: 18, vac: 'شلل الأطفال الفموي (OPV)', vacEn: 'OPV Booster', type: 'نقط فم', note: 'جرعة معززة', category: 'mandatory', color: 'bg-red-400' },
  { age: '18 شهر', sortKey: 18, vac: 'MMR — الجرعة الثانية', vacEn: 'MMR Dose 2', type: 'حقن تحت الجلد', note: 'الجرعة المعززة', category: 'mandatory', color: 'bg-red-400' },
  { age: '18 شهر', sortKey: 18, vac: 'الثلاثي البكتيري (DTP Booster)', vacEn: 'DTP Booster', type: 'حقن عضل', note: 'دفتيريا + تيتانوس + سعال ديكي', category: 'mandatory', color: 'bg-red-400' },
  { age: '4 – 6 سنوات', sortKey: 60, vac: 'الثلاثي البكتيري (DTP) والشلل (OPV)', vacEn: 'DTP + OPV Booster', type: 'حقن + نقط', note: 'جرعة قبل المدرسة', category: 'mandatory', color: 'bg-purple-500' },
  { age: '11 – 12 سنة', sortKey: 132, vac: 'HPV (لوقاية من سرطان عنق الرحم)', vacEn: 'HPV Vaccine (Girls)', type: 'حقن عضل', note: 'للفتيات — جرعتان بفارق 6 أشهر', category: 'recommended', color: 'bg-pink-500' },
  { age: 'سنوياً (أكثر من 6 شهور)', sortKey: 999, vac: 'الإنفلونزا الموسمية', vacEn: 'Influenza (Flu)', type: 'حقن عضل', note: 'يُنصح به سنوياً للأطفال والبالغين', category: 'recommended', color: 'bg-sky-400' },
];

const ageGroups = ['الكل', 'عند الولادة', 'شهرين', '4 شهور', '6 شهور', '9–12 شهر', '18 شهر+'];

export default function VaccinesSchedule({ onBack }: Props) {
  const [filter, setFilter] = useState('الكل');
  const [showRecommended, setShowRecommended] = useState(true);

  const filtered = schedule.filter(item => {
    const catOk = showRecommended || item.category === 'mandatory';
    if (filter === 'الكل') return catOk;
    if (filter === '9–12 شهر') return catOk && (item.age === '9 شهور' || item.age === '12 شهر');
    if (filter === '18 شهر+') return catOk && item.sortKey >= 18;
    return catOk && item.age === filter;
  });

  // Group by age
  const grouped = filtered.reduce((acc: Record<string, VaxItem[]>, item) => {
    if (!acc[item.age]) acc[item.age] = [];
    acc[item.age].push(item);
    return acc;
  }, {});

  const ageOrder = [...new Set(schedule.map(i => i.age))];
  const sortedGroups = Object.keys(grouped).sort((a, b) => ageOrder.indexOf(a) - ageOrder.indexOf(b));

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 duration-300 pb-10">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-5">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50"><ArrowRight className="w-5 h-5 text-gray-600" /></button>}
        <div className="flex items-center gap-3">
          <VaccineIcon />
          <div>
            <h2 className="text-xl font-black text-gray-800">جدول التطعيمات</h2>
            <p className="text-xs text-gray-400 font-semibold">برنامج التطعيمات المصري + العالمي</p>
          </div>
        </div>
      </div>

      {/* ── Info ── */}
      <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 mb-5 flex gap-3 text-emerald-800">
        <Info className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
        <div className="text-xs leading-relaxed">
          <p className="font-bold mb-1">البرنامج الوطني للتطعيمات</p>
          <p>يتضمن التطعيمات الإجبارية الرسمية والموصى بها. يُنصح بمراجعة طبيب الأطفال أو وحدة التطعيم المحلية للجدول الحالي.</p>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3 no-scrollbar">
        {ageGroups.map(g => (
          <button key={g} onClick={() => setFilter(g)}
            className={`shrink-0 text-[10px] font-bold px-3 py-1.5 rounded-full border transition ${filter === g ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-gray-500 border-gray-200'}`}>
            {g}
          </button>
        ))}
      </div>

      {/* ── Toggle recommended ── */}
      <label className="flex items-center gap-2 mb-4 cursor-pointer w-fit">
        <div className={`relative w-10 h-5 rounded-full transition-all ${showRecommended ? 'bg-emerald-500' : 'bg-gray-300'}`}>
          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${showRecommended ? 'right-0.5' : 'left-0.5'}`} />
        </div>
        <input type="checkbox" className="hidden" checked={showRecommended} onChange={e => setShowRecommended(e.target.checked)} />
        <span className="text-xs font-bold text-gray-600">إظهار الموصى بها أيضاً</span>
      </label>

      {/* ── Timeline ── */}
      <div className="relative">
        <div className="absolute top-0 right-7 w-0.5 h-full bg-emerald-100 rounded-full" />
        <div className="space-y-4">
          {sortedGroups.map(age => {
            const items = grouped[age];
            const color = items[0].color;
            return (
              <div key={age} className="flex gap-4 items-start">
                <div className="z-10 shrink-0 w-14 flex flex-col items-center">
                  <div className={`w-14 min-h-14 ${color} rounded-xl border-2 border-white shadow-md flex items-center justify-center p-1`}>
                    <span className="text-white text-[9px] font-black text-center leading-tight">{age.replace(' شهر', '\nشهر').replace(' شهور', '\nشهور')}</span>
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  {items.map((item, idx) => (
                    <div key={idx} className={`p-3.5 rounded-2xl border transition-colors ${item.category === 'mandatory' ? 'bg-white border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/30' : 'bg-sky-50/50 border-sky-100 hover:border-sky-200'}`}>
                      <div className="flex items-start gap-2">
                        {item.category === 'mandatory'
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                          : <Shield className="w-4 h-4 text-sky-400 mt-0.5 shrink-0" />}
                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-1">
                            <p className="font-bold text-xs text-gray-800 leading-relaxed">{item.vac}</p>
                            {item.category === 'recommended' && (
                              <span className="text-[8px] font-black bg-sky-100 text-sky-600 px-1.5 py-0.5 rounded-full shrink-0">موصى به</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="text-[9px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md">{item.type}</span>
                            {item.note && <span className="text-[9px] font-semibold text-gray-400">{item.note}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="mt-5 bg-white p-4 rounded-2xl border border-gray-100">
        <p className="text-xs font-black text-gray-600 mb-3">دليل الرموز</p>
        <div className="flex gap-4">
          <div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500"/><span className="text-[10px] text-gray-600 font-bold">إجباري (برنامج وطني)</span></div>
          <div className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-sky-400"/><span className="text-[10px] text-gray-600 font-bold">موصى به (اختياري)</span></div>
        </div>
      </div>

      {/* ── Sources ── */}
      <div className="mt-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
        <p className="flex items-center gap-1.5 text-xs font-black text-gray-600 mb-3"><BookOpen className="w-3.5 h-3.5"/> المصادر العلمية</p>
        <div className="space-y-2">
          {[
            { title: 'وزارة الصحة المصرية — برنامج التطعيمات الوطني', url: 'http://www.mohp.gov.eg' },
            { title: 'WHO — Immunization Schedule (Egypt)', url: 'https://www.who.int/immunization/policy/immunization_tables/en/' },
            { title: 'AAP — Childhood Immunization Schedule 2024', url: 'https://www.aap.org/en/patient-care/immunizations/' },
          ].map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-[10px] text-emerald-600 font-semibold hover:underline">
              <ExternalLink className="w-3 h-3 shrink-0" />{s.title}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
