import React, { useState } from 'react';
import { Baby, ArrowRight, Brain, Smile, Activity, BookOpen, ExternalLink, Info, AlertCircle } from 'lucide-react';

interface Props { onBack?: () => void; }

// ─── SVG Icon ─────────────────────────────────────────────────────────────────
const MilestonesIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
    <rect width="48" height="48" rx="14" fill="#EEF2FF"/>
    {/* Baby face */}
    <circle cx="24" cy="20" r="10" fill="#C7D2FE" stroke="#6366F1" strokeWidth="1.5"/>
    <circle cx="20.5" cy="19" r="1.5" fill="#4338CA"/>
    <circle cx="27.5" cy="19" r="1.5" fill="#4338CA"/>
    <path d="M21 23.5C21 23.5 22 25 24 25C26 25 27 23.5 27 23.5" stroke="#4338CA" strokeWidth="1.3" strokeLinecap="round"/>
    {/* Growth line */}
    <path d="M10 36L17 31L24 33L31 28L38 30" stroke="#818CF8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="17" cy="31" r="1.5" fill="#6366F1"/>
    <circle cx="24" cy="33" r="1.5" fill="#6366F1"/>
    <circle cx="31" cy="28" r="1.5" fill="#6366F1"/>
  </svg>
);

// ─── Milestones data ──────────────────────────────────────────────────────────
const milestones = [
  {
    id: '2m', label: 'شهران', labelEn: '2 months',
    social: 'يبتسم استجابةً للوجوه (Responsive smile). يهدأ عند الحمل والحديث إليه. يتعرف على وجه الأم.',
    lang: 'يُصدر أصوات هديل (Cooing). يلتفت نحو مصدر الصوت. يعبّر عن الجوع والانزعاج ببكاء مختلف.',
    motor: 'يرفع رأسه عند الاستلقاء على البطن لثوانٍ. يحرك يديه وقدميه بشكل منعكس. يتتبع الأشياء بعينيه.',
    redFlags: 'لا يتفاعل مع الأصوات أو لا يبتسم — استشر الطبيب.'
  },
  {
    id: '4m', label: '4 أشهر', labelEn: '4 months',
    social: 'يضحك بصوت عالٍ. يُعبّر عن الفرح والانزعاج بوضوح. يتفاعل مع الوجوه المألوفة بشكل واضح.',
    lang: 'يُصدر أصوات متعددة (babbling أولي). يستجيب عند سماع اسمه. يقلد بعض الأصوات.',
    motor: 'يرفع رأسه 90 درجة ويثبته. يمسك الأشياء ويضعها في فمه. يتقلب من البطن إلى الظهر.',
    redFlags: 'لا يمسك الأشياء أو لا يتتبع الحركة — يستحق تقييماً.'
  },
  {
    id: '6m', label: '6 أشهر', labelEn: '6 months',
    social: 'يعرف الوجوه المألوفة ويُظهر قلقاً من الغرباء. يُحب اللعب. يستجيب بالفرح للتفاعل.',
    lang: 'ينطق مقاطع مثل (با، ما). يُصدر أصواتاً للتعبير عن الفرح والاستياء. يفهم بعض التعبيرات الوجهية.',
    motor: 'يجلس بدعم أو بدونه لفترة قصيرة. يتقلب في الاتجاهين. يحمل الأشياء بكلتا يديه.',
    redFlags: 'لا يُصدر أي أصوات أو لا يمسك الأشياء — يستوجب تقييماً فورياً.'
  },
  {
    id: '12m', label: 'سنة (12 شهراً)', labelEn: '12 months',
    social: 'يخشى الغرباء (Stranger anxiety). يُكرر الأصوات لاستقطاب الانتباه. يُلوّح بيده "مع السلامة".',
    lang: 'يقول "ماما" و"بابا" بقصد. يفهم كلمة "لا". يُشير بالإصبع إلى الأشياء.',
    motor: 'يقف ممسكاً بالأثاث. يمشي بمساعدة أو بضع خطوات مستقلة. يُلقي الأشياء عن قصد.',
    redFlags: 'لا يقف أو لا يقول أي كلمة مفردة أو لا يُشير — مؤشر هام للتقييم.'
  },
  {
    id: '18m', label: 'سنة ونصف', labelEn: '18 months',
    social: 'يُظهر نوبات غضب (Temper tantrums). يُقلّد الكبار في الأنشطة اليومية. يلعب بالتخيل بشكل بسيط.',
    lang: 'يقول 10–25 كلمة مفردة. يُشير إلى أجزاء الجسم عند السؤال. يفهم جملاً بسيطة.',
    motor: 'يمشي بمفرده بثبات. يصعد السلم ممسكاً. يأكل بالملعقة مع تسكّب.',
    redFlags: 'مخزون لغوي أقل من 6 كلمات أو لا يمشي بمفرده — يستلزم تقييماً.'
  },
  {
    id: '24m', label: 'سنتان', labelEn: '24 months',
    social: 'يلعب بجوار الأطفال (Parallel play). يُقلّد سلوكيات الكبار. يُظهر عواطف متنوعة.',
    lang: 'يبني جملاً من كلمتين (مثل: "عايز حليب"). يُسمّي الأشياء الشائعة. مخزون 50+ كلمة.',
    motor: 'يركل الكرة. يصعد ويهبط السلم بمساعدة. يرسم خطوطاً بالقلم.',
    redFlags: 'لا يبني أي جملة من كلمتين أو مخزون أقل من 50 كلمة — يستحق تقييم نمائياً.'
  },
  {
    id: '36m', label: '3 سنوات', labelEn: '36 months',
    social: 'يلعب مع الأطفال (Cooperative play). يُظهر التعاطف. يُميّز الأدوار في اللعب.',
    lang: 'يتحدث بجمل من 3–4 كلمات. يسأل "ليش؟". يفهم 2–3 تعليمات متتالية.',
    motor: 'يركب دراجة ثلاثية العجلات. يقفز بكلتا القدمين. يرسم دائرة.',
    redFlags: 'كلام غير مفهوم للغريب أو لا يلعب مع الأطفال — يستدعي تقييم نطق ونمو.'
  },
];

const tabConfig = [
  { key: 'social', label: 'الاجتماعي والعاطفي', Icon: Smile, color: 'orange' },
  { key: 'lang',   label: 'اللغة والتواصل',     Icon: Brain, color: 'blue' },
  { key: 'motor',  label: 'الحركة والجسدي',      Icon: Activity, color: 'green' },
];

const colorMap: Record<string, string> = {
  orange: 'bg-orange-50 border-orange-100 text-orange-800',
  blue:   'bg-blue-50 border-blue-100 text-blue-800',
  green:  'bg-green-50 border-green-100 text-green-800',
};
const iconColorMap: Record<string, string> = {
  orange: 'text-orange-500', blue: 'text-blue-500', green: 'text-green-500',
};

export default function ChildMilestones({ onBack }: Props) {
  const [selectedAge, setSelectedAge] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('social');

  const current = milestones.find(m => m.id === selectedAge);
  const activeTabConfig = tabConfig.find(t => t.key === activeTab)!;

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 duration-300 pb-10">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-5">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50"><ArrowRight className="w-5 h-5 text-gray-600" /></button>}
        <div className="flex items-center gap-3">
          <MilestonesIcon />
          <div>
            <h2 className="text-xl font-black text-gray-800">دليل تطور الطفل</h2>
            <p className="text-xs text-gray-400 font-semibold">Developmental Milestones</p>
          </div>
        </div>
      </div>

      {/* ── Info ── */}
      <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 mb-5 flex gap-3 text-indigo-800">
        <Info className="w-5 h-5 shrink-0 mt-0.5 text-indigo-400" />
        <div className="text-xs leading-relaxed">
          <p className="font-bold mb-1">عن هذا الدليل</p>
          <p>يستعرض التطورات المتوقعة في المجالات الاجتماعية واللغوية والحركية وفق إرشادات CDC وAAP. التطور يتفاوت بين الأطفال — الأرقام مرجعية وليست تشخيصية.</p>
        </div>
      </div>

      {/* ── Age Selector ── */}
      <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-gray-100 mb-4">
        <p className="text-xs font-black text-gray-500 mb-3">اختر عمر الطفل</p>
        <div className="flex flex-wrap gap-2">
          {milestones.map(m => (
            <button key={m.id} onClick={() => setSelectedAge(m.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border-2 ${selectedAge === m.id ? 'bg-indigo-50 border-indigo-400 text-indigo-700 shadow-sm' : 'bg-gray-50 border-transparent text-gray-500 hover:bg-gray-100'}`}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Milestone Content ── */}
      {current ? (
        <div className="animate-in slide-in-from-bottom-2 space-y-3">

          {/* Tab switcher */}
          <div className="flex bg-gray-100 p-1 rounded-xl">
            {tabConfig.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-2 text-[10px] font-bold rounded-lg flex items-center justify-center gap-1 transition-all ${activeTab === tab.key ? 'bg-white shadow text-gray-800' : 'text-gray-400'}`}>
                <tab.Icon className={`w-3 h-3 ${activeTab === tab.key ? iconColorMap[tab.color] : ''}`} />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
              </button>
            ))}
          </div>

          {/* Content card */}
          <div className={`p-5 rounded-2xl border ${colorMap[activeTabConfig.color]}`}>
            <h3 className={`font-black mb-2 flex items-center gap-2 text-sm ${iconColorMap[activeTabConfig.color]}`}>
              <activeTabConfig.Icon className="w-4 h-4" /> {activeTabConfig.label}
            </h3>
            <p className="text-xs leading-relaxed font-medium">{(current as any)[activeTab]}</p>
          </div>

          {/* Red flags */}
          <div className="p-4 rounded-2xl bg-red-50 border border-red-100 flex gap-3">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-black text-red-600 mb-1">🚩 علامات التحذير (Red Flags)</p>
              <p className="text-[11px] text-red-700 font-semibold leading-relaxed">{current.redFlags}</p>
            </div>
          </div>

          {/* All domains quick view */}
          <details className="bg-white rounded-2xl border border-gray-100">
            <summary className="p-4 text-xs font-black text-gray-600 cursor-pointer select-none">عرض جميع المجالات دفعة واحدة</summary>
            <div className="px-4 pb-4 space-y-3">
              {tabConfig.map(tab => (
                <div key={tab.key} className={`p-3 rounded-xl border ${colorMap[tab.color]}`}>
                  <p className={`font-black text-xs mb-1 flex items-center gap-1.5 ${iconColorMap[tab.color]}`}><tab.Icon className="w-3.5 h-3.5" />{tab.label}</p>
                  <p className="text-[11px] font-medium leading-relaxed">{(current as any)[tab.key]}</p>
                </div>
              ))}
            </div>
          </details>
        </div>
      ) : (
        <div className="text-center py-14 bg-white rounded-[2rem] border border-dashed border-gray-200">
          <Baby className="w-14 h-14 text-indigo-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500 font-bold">اختر عمر الطفل لعرض التطورات</p>
          <p className="text-xs text-gray-400 mt-1">من شهرين حتى 3 سنوات</p>
        </div>
      )}

      {/* ── Sources ── */}
      <div className="mt-6 p-4 bg-gray-50 rounded-2xl border border-gray-100">
        <p className="flex items-center gap-1.5 text-xs font-black text-gray-600 mb-3"><BookOpen className="w-3.5 h-3.5"/> المصادر العلمية</p>
        <div className="space-y-2">
          {[
            { title: 'CDC — Developmental Milestones (Updated 2022)', url: 'https://www.cdc.gov/ncbddd/actearly/milestones/index.html' },
            { title: 'AAP — What to Expect at Each Age', url: 'https://www.aap.org/en/patient-care/developmental-surveillance-and-screening/' },
            { title: 'WHO Child Growth Standards & Development', url: 'https://www.who.int/tools/child-growth-standards' },
          ].map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-[10px] text-indigo-600 font-semibold hover:underline">
              <ExternalLink className="w-3 h-3 shrink-0" />{s.title}
            </a>
          ))}
        </div>
        <p className="text-[9px] text-gray-400 font-semibold mt-3 leading-relaxed">⚠️ هذا الدليل للتوجيه والتثقيف فقط. إذا كان لديك قلق على تطور طفلك استشر طبيب الأطفال.</p>
      </div>

    </div>
  );
}
