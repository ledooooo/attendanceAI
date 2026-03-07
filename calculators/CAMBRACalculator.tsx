import React, { useState } from 'react';
import { ArrowRight, BookOpen, Search, ExternalLink, Info, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

interface Props { onBack?: () => void; }

// ─── SVG Icon ─────────────────────────────────────────────────────────────────
const BeersIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
    <rect width="48" height="48" rx="14" fill="#FFF1F2"/>
    <rect x="14" y="13" width="20" height="26" rx="3" fill="#FECDD3" stroke="#F43F5E" strokeWidth="1.5"/>
    <path d="M18 20H30M18 25H30M18 30H24" stroke="#E11D48" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="34" cy="14" r="6" fill="#FEF2F2" stroke="#F87171" strokeWidth="1.2"/>
    <path d="M34 11.5V14.5L35.5 16" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M20 13V10" stroke="#FB7185" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M28 13V10" stroke="#FB7185" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

// ─── Data ─────────────────────────────────────────────────────────────────────
const criteria = [
  {
    drug: 'Amiodarone',
    category: 'قلبية وعائية',
    reason: 'خطر مرتفع للسمية الرئوية والغدة الدرقية (فرط أو قصور). مدة نصف العمر الطويلة جداً تجعل التأثيرات الجانبية مستمرة.',
    alt: 'Dronedarone أو بيتا-حاصرات (بتقييم متخصص)',
    severity: 'عالي',
  },
  {
    drug: 'Digoxin > 0.125 mg/day',
    category: 'قلبية وعائية',
    reason: 'يرتفع خطر التسمم الرقمي لدى كبار السن بسبب انخفاض وظائف الكلى وتغير التوزيع الحجمي للدواء.',
    alt: 'بيتا-حاصرات أو حاصرات قنوات الكالسيوم للتحكم في معدل القلب',
    severity: 'عالي',
  },
  {
    drug: 'Amitriptyline / Imipramine',
    category: 'نفسية وعصبية',
    reason: 'مضادات كولين قوية: جفاف فم، إمساك، احتباس بول، ارتباك ذهني، تأثير تهدئة مفرط، وخطر سقوط.',
    alt: 'SSRIs (Sertraline, Escitalopram) كخط أول لدى المسنين',
    severity: 'عالي',
  },
  {
    drug: 'Benzodiazepines (مثل Diazepam, Alprazolam)',
    category: 'نفسية وعصبية',
    reason: 'تراكم الجرعات بسبب نصف عمر طويل، تسبب تخدير مفرط، اضطراب إدراكي، وزيادة خطر السقوط والكسور بنسبة 50%.',
    alt: 'CBT للأرق، Melatonin للنوم، مراجعة الأسباب الكامنة',
    severity: 'عالي',
  },
  {
    drug: 'NSAIDs (Ibuprofen, Naproxen, Diclofenac)',
    category: 'مسكنات',
    reason: 'زيادة خطر نزيف الجهاز الهضمي (× 3–5)، فشل كلوي، احتباس سوائل، وتفاقم القصور القلبي.',
    alt: 'Paracetamol (أسيتامينوفين) كخط أول للألم الخفيف–المتوسط',
    severity: 'عالي',
  },
  {
    drug: 'Nitrofurantoin (استخدام طويل الأمد)',
    category: 'مضادات حيوية',
    reason: 'سمية رئوية وكبدية عند الاستخدام المطوّل. غير فعّال إذا كان GFR < 30 mL/min وهو شائع لدى المسنين.',
    alt: 'Fosfomycin أو Trimethoprim حسب حساسية الجرثومة',
    severity: 'متوسط',
  },
  {
    drug: 'Sulfonylureas طويلة المفعول (Glibenclamide, Chlorpropamide)',
    category: 'سكري',
    reason: 'خطر شديد لنقص سكر الدم المطوّل بسبب التراكم. الشيخوخة تزيد من حساسية البنكرياس والكلى لهذه المواد.',
    alt: 'Metformin، DPP-4 inhibitors، أو GLP-1 agonists',
    severity: 'عالي',
  },
  {
    drug: 'Antihistamines جيل أول (Diphenhydramine, Chlorpheniramine)',
    category: 'حساسية',
    reason: 'تأثيرات مضادة للكولين قوية: ارتباك، إمساك، احتباس بول، وتخدير مفرط قد يُحاكي الخرف.',
    alt: 'Cetirizine أو Loratadine (جيل ثاني — غير مخدر)',
    severity: 'متوسط',
  },
  {
    drug: 'Proton Pump Inhibitors (> 8 أسابيع بلا مراجعة)',
    category: 'هضمية',
    reason: 'الاستخدام المطوّل يزيد خطر كسور العظام، نقص المغنيسيوم والـ B12، والتهاب الكلية الخلالي.',
    alt: 'مراجعة الجرعة دورياً وتخفيضها لأدنى جرعة فعّالة',
    severity: 'منخفض',
  },
];

const severityConfig: Record<string, { color: string; bg: string; border: string }> = {
  عالي:    { color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200' },
  متوسط:   { color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  منخفض:   { color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
};

const categories = ['الكل', ...Array.from(new Set(criteria.map(c => c.category)))];

export default function BeersCriteriaList({ onBack }: Props) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('الكل');
  const [expanded, setExpanded] = useState<number | null>(null);

  const filtered = criteria.filter(c => {
    const matchSearch = c.drug.toLowerCase().includes(search.toLowerCase()) || c.category.includes(search);
    const matchCat = activeCategory === 'الكل' || c.category === activeCategory;
    return matchSearch && matchCat;
  });

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 pb-10">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-5">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border"><ArrowRight className="w-5 h-5 text-gray-600" /></button>}
        <div className="flex items-center gap-3">
          <BeersIcon />
          <div>
            <h2 className="text-xl font-black text-gray-800">معايير Beers للأدوية</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-bold bg-red-50 text-red-600 px-2 py-0.5 rounded border border-red-100">للصيادلة والأطباء ⚕️</span>
              <span className="text-xs text-gray-400 font-semibold">للمرضى 65+</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Info ── */}
      <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 mb-5 flex gap-3 text-amber-800">
        <Info className="w-5 h-5 shrink-0 mt-0.5 text-amber-500" />
        <div className="text-xs leading-relaxed">
          <p className="font-bold mb-1">عن معايير Beers</p>
          <p>قائمة معتمدة من American Geriatrics Society (AGS) تُحدَّث كل سنتين، تحدد الأدوية التي يجب تجنبها أو استخدامها بحذر شديد للمرضى فوق 65 عاماً نظراً لتغير الحركية الدوائية لديهم.</p>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="mb-3 relative">
        <Search className="absolute right-3.5 top-3.5 w-4 h-4 text-gray-400" />
        <input type="text" placeholder="ابحث بالاسم أو الفئة..."
          className="w-full pr-10 p-3.5 bg-white border border-gray-200 rounded-xl font-bold text-xs outline-none focus:border-red-400 transition-colors"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* ── Category Filter ── */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 no-scrollbar">
        {categories.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className={`shrink-0 text-[10px] font-black px-3 py-1.5 rounded-full border transition-all ${activeCategory === cat ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
            {cat}
          </button>
        ))}
      </div>

      {/* ── Count ── */}
      <p className="text-xs text-gray-400 font-bold mb-3">{filtered.length} دواء</p>

      {/* ── List ── */}
      <div className="space-y-3">
        {filtered.map((item, i) => {
          const sev = severityConfig[item.severity];
          const isOpen = expanded === i;
          return (
            <div key={i} className={`bg-white rounded-2xl border-2 shadow-sm overflow-hidden transition-all ${sev.border}`}>
              <button className="w-full p-4 text-right flex items-start gap-3" onClick={() => setExpanded(isOpen ? null : i)}>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-red-600 font-black text-sm">{item.drug}</h3>
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${sev.bg} ${sev.color}`}>
                      خطر {item.severity}
                    </span>
                  </div>
                  <span className="text-[9px] text-gray-400 font-bold bg-gray-50 px-2 py-0.5 rounded-full">{item.category}</span>
                </div>
                {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0 mt-1" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 mt-1" />}
              </button>

              {isOpen && (
                <div className="px-4 pb-4 space-y-2 animate-in slide-in-from-top-2">
                  <div className={`p-3 rounded-xl ${sev.bg} border ${sev.border}`}>
                    <p className="text-[10px] font-black text-gray-600 mb-1 flex items-center gap-1">
                      <AlertTriangle className={`w-3 h-3 ${sev.color}`} /> سبب التجنب
                    </p>
                    <p className={`text-xs font-semibold leading-relaxed ${sev.color}`}>{item.reason}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-green-50 border border-green-200">
                    <p className="text-[10px] font-black text-green-700 mb-1">✅ البديل الأفضل</p>
                    <p className="text-xs font-semibold text-green-800 leading-relaxed">{item.alt}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-10 text-gray-400">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-bold">لا توجد نتائج</p>
          </div>
        )}
      </div>

      {/* ── Sources ── */}
      <div className="mt-6 p-4 bg-gray-50 rounded-2xl border border-gray-100">
        <p className="flex items-center gap-1.5 text-xs font-black text-gray-600 mb-3"><BookOpen className="w-3.5 h-3.5"/> المصادر العلمية</p>
        <div className="space-y-2">
          {[
            { title: 'AGS Beers Criteria® Update 2023 — Journal of AGS', url: 'https://agsjournals.onlinelibrary.wiley.com/doi/10.1111/jgs.18372' },
            { title: 'American Geriatrics Society — Beers Criteria Resource', url: 'https://www.americangeriatrics.org/media-center/news/ags-releases-updated-beers-criteriar-inappropriate-medication-use-older-adults' },
            { title: 'Fick DM et al. — History and Evolution of Beers Criteria', url: 'https://pubmed.ncbi.nlm.nih.gov/35834967/' },
          ].map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-[10px] text-blue-600 font-semibold hover:underline">
              <ExternalLink className="w-3 h-3 shrink-0" />{s.title}
            </a>
          ))}
        </div>
        <p className="text-[9px] text-gray-400 font-semibold mt-3 leading-relaxed">⚠️ هذه القائمة للتوجيه فقط. القرار السريري النهائي يعود للطبيب المعالج مع مراعاة الحالة الفردية لكل مريض.</p>
      </div>

    </div>
  );
}
