import React, { useState } from 'react';
import { ArrowRight, Search, Info, BookOpen, ExternalLink, ChevronDown } from 'lucide-react';

interface Props { onBack?: () => void; }

// ─── SVG Icon ─────────────────────────────────────────────────────────────────
const LabIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
    <rect width="48" height="48" rx="14" fill="#EEF2FF"/>
    {/* Test tube */}
    <path d="M28 8L20 8L14 28C14 31.314 17.686 34 22 34C26.314 34 30 31.314 30 28L28 8H28Z" fill="#C7D2FE" stroke="#6366F1" strokeWidth="1.3" strokeLinejoin="round"/>
    <path d="M20 8H28" stroke="#6366F1" strokeWidth="1.5" strokeLinecap="round"/>
    {/* Liquid inside */}
    <path d="M15 26C15 26 17 24 19 26C21 28 23 26 25 26C27 26 28 28 29 28L30 28C30 31.314 26.314 34 22 34C17.686 34 14 31.314 14 28L15 26Z" fill="#818CF8" opacity="0.8"/>
    {/* Bubbles */}
    <circle cx="19" cy="22" r="1" fill="#A5B4FC"/>
    <circle cx="23" cy="19" r="0.8" fill="#A5B4FC"/>
    {/* Second tube */}
    <path d="M32 8V28" stroke="#C7D2FE" strokeWidth="3" strokeLinecap="round"/>
    <circle cx="32" cy="31" r="3" fill="#A5B4FC" stroke="#6366F1" strokeWidth="1"/>
  </svg>
);

// ─── Lab data ─────────────────────────────────────────────────────────────────
interface LabItem {
  name: string;
  nameAr: string;
  category: string;
  male: string;
  female: string;
  unit: string;
  note: string;
}

const labs: LabItem[] = [
  // صورة دم كاملة
  { name: 'Hemoglobin (Hb)', nameAr: 'هيموجلوبين', category: 'CBC صورة دم', male: '13.5 – 17.5', female: '12.0 – 15.5', unit: 'g/dL', note: 'انخفاضه = فقر دم. ارتفاعه = تعدد كرات دم حمراء' },
  { name: 'Hematocrit (HCT)', nameAr: 'هيماتوكريت', category: 'CBC صورة دم', male: '41 – 53', female: '36 – 46', unit: '%', note: 'نسبة حجم الكرات الحمراء للدم الكلي' },
  { name: 'RBCs', nameAr: 'كرات دم حمراء', category: 'CBC صورة دم', male: '4.7 – 6.1', female: '4.2 – 5.4', unit: 'mil/μL', note: 'انخفاض مع فقر الدم وارتفاع مع الجفاف' },
  { name: 'WBCs', nameAr: 'كرات دم بيضاء', category: 'CBC صورة دم', male: '4,500 – 11,000', female: '4,500 – 11,000', unit: 'cells/μL', note: 'ارتفاع = التهاب أو عدوى. انخفاض = قصور مناعي أو كيماوي' },
  { name: 'Neutrophils', nameAr: 'العدلات', category: 'CBC صورة دم', male: '55 – 70', female: '55 – 70', unit: '%', note: 'أول استجابة للعدوى البكتيرية' },
  { name: 'Platelets', nameAr: 'صفائح دموية', category: 'CBC صورة دم', male: '150,000 – 400,000', female: '150,000 – 400,000', unit: '/μL', note: 'انخفاض < 50,000 يزيد خطر النزيف' },
  { name: 'MCV', nameAr: 'حجم الكرية المتوسط', category: 'CBC صورة دم', male: '80 – 100', female: '80 – 100', unit: 'fL', note: 'صغير = نقص حديد | كبير = نقص B12/فولات' },

  // سكري
  { name: 'Fasting Glucose', nameAr: 'سكر صائم', category: 'السكري', male: '70 – 99', female: '70 – 99', unit: 'mg/dL', note: '100–125 = ما قبل السكري | ≥126 = سكري' },
  { name: 'HbA1c', nameAr: 'سكر تراكمي', category: 'السكري', male: '< 5.7%', female: '< 5.7%', unit: '%', note: '5.7–6.4% = ما قبل | ≥6.5% = سكري | هدف العلاج < 7%' },
  { name: '2hr Post-Prandial', nameAr: 'سكر بعد الأكل', category: 'السكري', male: '< 140', female: '< 140', unit: 'mg/dL', note: '140–199 = ضعف تحمّل | ≥200 = سكري' },
  { name: 'Insulin (Fasting)', nameAr: 'أنسولين صائم', category: 'السكري', male: '2 – 25', female: '2 – 25', unit: 'μIU/mL', note: 'ارتفاعه مع سكر طبيعي = مقاومة أنسولين' },

  // كلى
  { name: 'Creatinine', nameAr: 'كرياتينين', category: 'الكلى', male: '0.7 – 1.3', female: '0.6 – 1.1', unit: 'mg/dL', note: 'مؤشر كلوي رئيسي. يرتفع مع نقص التصفية' },
  { name: 'BUN (Urea)', nameAr: 'يوريا', category: 'الكلى', male: '7 – 20', female: '7 – 20', unit: 'mg/dL', note: 'ارتفاع مع فشل كلوي أو نزيف معدي' },
  { name: 'Uric Acid', nameAr: 'حمض يوريك', category: 'الكلى', male: '3.4 – 7.0', female: '2.4 – 6.0', unit: 'mg/dL', note: 'ارتفاعه = نقرس أو خطر الحصى الكلوي' },
  { name: 'eGFR', nameAr: 'معدل الترشيح الكبيبي', category: 'الكلى', male: '> 60', female: '> 60', unit: 'mL/min/1.73m²', note: '< 60 لأكثر من 3 شهور = CKD' },

  // كبد
  { name: 'ALT (SGPT)', nameAr: 'إنزيم الكبد ALT', category: 'الكبد', male: '7 – 56', female: '7 – 45', unit: 'U/L', note: 'أكثر خصوصية للكبد. ارتفاع > 3 أضعاف = التهاب كبد' },
  { name: 'AST (SGOT)', nameAr: 'إنزيم الكبد AST', category: 'الكبد', male: '8 – 48', female: '8 – 43', unit: 'U/L', note: 'يرتفع أيضاً مع احتشاء عضلة القلب والعضلات' },
  { name: 'Total Bilirubin', nameAr: 'بيليروبين كلي', category: 'الكبد', male: '0.1 – 1.2', female: '0.1 – 1.2', unit: 'mg/dL', note: '> 2.5 يسبب اصفرار. سواء تحليلي أو مباشر' },
  { name: 'ALP', nameAr: 'فوسفاتاز قلوي', category: 'الكبد', male: '44 – 147', female: '33 – 130', unit: 'U/L', note: 'ارتفاعه مع انسداد الصفراء أو أمراض العظام' },
  { name: 'GGT', nameAr: 'جاما جلوتامات', category: 'الكبد', male: '8 – 61', female: '5 – 36', unit: 'U/L', note: 'أكثر حساسية. يرتفع مع الكحول والأدوية' },
  { name: 'Albumin', nameAr: 'ألبومين', category: 'الكبد', male: '3.5 – 5.0', female: '3.5 – 5.0', unit: 'g/dL', note: 'انخفاضه = فشل كبدي مزمن أو سوء تغذية' },

  // دهون
  { name: 'Total Cholesterol', nameAr: 'كوليسترول كلي', category: 'الدهون', male: '< 200', female: '< 200', unit: 'mg/dL', note: '200–239 = حد | ≥240 = مرتفع' },
  { name: 'LDL Cholesterol', nameAr: 'كوليسترول ضار', category: 'الدهون', male: '< 100', female: '< 100', unit: 'mg/dL', note: 'الهدف < 70 للقلبيين | < 55 للخطر المرتفع جداً' },
  { name: 'HDL Cholesterol', nameAr: 'كوليسترول نافع', category: 'الدهون', male: '> 40', female: '> 50', unit: 'mg/dL', note: 'كلما ارتفع أفضل. < 40 يُعدّ عامل خطر' },
  { name: 'Triglycerides', nameAr: 'دهون ثلاثية', category: 'الدهون', male: '< 150', female: '< 150', unit: 'mg/dL', note: '150–199 = حد | ≥500 = خطر التهاب البنكرياس' },

  // هرمونات ودرقية
  { name: 'TSH', nameAr: 'هرمون الغدة الدرقية', category: 'الهرمونات', male: '0.4 – 4.0', female: '0.4 – 4.0', unit: 'mIU/L', note: 'انخفاض = فرط نشاط | ارتفاع = قصور درقي' },
  { name: 'Free T4 (FT4)', nameAr: 'ثيروكسين حر', category: 'الهرمونات', male: '0.8 – 1.8', female: '0.8 – 1.8', unit: 'ng/dL', note: 'يُطلب مع TSH لتأكيد التشخيص' },
  { name: 'Free T3 (FT3)', nameAr: 'تريود ثيرونين حر', category: 'الهرمونات', male: '2.3 – 4.1', female: '2.3 – 4.1', unit: 'pg/mL', note: 'الهرمون النشط. يُطلب عند الاشتباه بفرط النشاط' },

  // فيتامينات ومعادن
  { name: 'Vitamin D (25-OH)', nameAr: 'فيتامين د', category: 'فيتامينات ومعادن', male: '30 – 100', female: '30 – 100', unit: 'ng/mL', note: '< 20 = نقص | 20–30 = قصور | > 100 = تسمم' },
  { name: 'Vitamin B12', nameAr: 'فيتامين ب12', category: 'فيتامينات ومعادن', male: '200 – 900', female: '200 – 900', unit: 'pg/mL', note: 'نقصه = فقر دم ضخم الكرات وتلف أعصاب' },
  { name: 'Ferritin', nameAr: 'فيريتين (حديد مخزون)', category: 'فيتامينات ومعادن', male: '30 – 400', female: '15 – 150', unit: 'ng/mL', note: 'أفضل مؤشر لمخزون الحديد. يرتفع مع الالتهاب' },
  { name: 'Serum Iron', nameAr: 'حديد المصل', category: 'فيتامينات ومعادن', male: '65 – 175', female: '50 – 170', unit: 'μg/dL', note: 'يتذبذب مع الوجبات. الفيريتين أدق' },
  { name: 'Calcium (Total)', nameAr: 'كالسيوم', category: 'فيتامينات ومعادن', male: '8.5 – 10.5', female: '8.5 – 10.5', unit: 'mg/dL', note: 'ارتفاع = فرط جار درقي | انخفاض = نقص D أو مغنيسيوم' },

  // قلب وأوعية
  { name: 'CRP (High Sensitivity)', nameAr: 'بروتين التهابي CRP', category: 'القلب والالتهاب', male: '< 1.0', female: '< 1.0', unit: 'mg/L', note: '1–3 = خطر قلبي وسط | > 3 = خطر مرتفع' },
  { name: 'Troponin I/T', nameAr: 'تروبونين (القلب)', category: 'القلب والالتهاب', male: '< 0.04', female: '< 0.04', unit: 'ng/mL', note: 'ارتفاعه = احتشاء عضلة القلب أو تلف قلبي' },
];

const categories = ['الكل', ...Array.from(new Set(labs.map(l => l.category)))];

const catColor: Record<string, string> = {
  'CBC صورة دم': 'bg-red-100 text-red-700',
  'السكري': 'bg-amber-100 text-amber-700',
  'الكلى': 'bg-blue-100 text-blue-700',
  'الكبد': 'bg-orange-100 text-orange-700',
  'الدهون': 'bg-yellow-100 text-yellow-700',
  'الهرمونات': 'bg-purple-100 text-purple-700',
  'فيتامينات ومعادن': 'bg-green-100 text-green-700',
  'القلب والالتهاب': 'bg-pink-100 text-pink-700',
};

export default function LabValuesDict({ onBack }: Props) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('الكل');
  const [expanded, setExpanded] = useState<number | null>(null);

  const filtered = labs.filter(l => {
    const matchSearch = l.name.toLowerCase().includes(search.toLowerCase()) || l.nameAr.includes(search);
    const matchCat = activeCategory === 'الكل' || l.category === activeCategory;
    return matchSearch && matchCat;
  });

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 duration-300 pb-10">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-5">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50"><ArrowRight className="w-5 h-5 text-gray-600" /></button>}
        <div className="flex items-center gap-3">
          <LabIcon />
          <div>
            <h2 className="text-xl font-black text-gray-800">القيم الطبيعية للتحاليل</h2>
            <p className="text-xs text-gray-400 font-semibold">Lab Reference Values — {labs.length} تحليل</p>
          </div>
        </div>
      </div>

      {/* ── Info ── */}
      <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 mb-5 flex gap-3 text-indigo-800">
        <Info className="w-5 h-5 shrink-0 mt-0.5 text-indigo-400" />
        <p className="text-xs leading-relaxed font-semibold">القيم الطبيعية قد تختلف بين المعامل وآخر حسب الأجهزة. دائماً قارن بـ Reference Range المكتوب في ورقة التحليل.</p>
      </div>

      {/* ── Search ── */}
      <div className="relative mb-3">
        <Search className="absolute right-4 top-3.5 text-gray-400 w-4 h-4"/>
        <input type="text" placeholder="ابحث بالاسم (Hb, TSH, سكر...)"
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pr-10 pl-4 py-3.5 border border-gray-200 bg-white rounded-xl outline-none focus:border-indigo-400 transition-all font-bold text-gray-700 text-sm" />
      </div>

      {/* ── Category filter ── */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 no-scrollbar">
        {categories.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className={`shrink-0 text-[10px] font-black px-3 py-1.5 rounded-full border transition-all ${activeCategory === cat ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300'}`}>
            {cat}
          </button>
        ))}
      </div>

      {/* ── List ── */}
      <div className="space-y-2">
        {filtered.map((lab, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button onClick={() => setExpanded(expanded === i ? null : i)}
              className="w-full p-4 hover:bg-indigo-50/30 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="text-right flex-1">
                  <p className="font-black text-gray-800 text-sm">{lab.name}</p>
                  <p className="text-[10px] text-gray-400 font-semibold">{lab.nameAr}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${catColor[lab.category] ?? 'bg-gray-100 text-gray-500'}`}>{lab.category}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${expanded === i ? 'rotate-180' : ''}`} />
                </div>
              </div>

              {/* Quick reference (collapsed) */}
              {expanded !== i && (
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs font-black text-indigo-600">
                    {lab.male === lab.female ? lab.male : `ذ: ${lab.male} | ث: ${lab.female}`}
                  </span>
                  <span className="text-[9px] font-mono text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{lab.unit}</span>
                </div>
              )}
            </button>

            {expanded === i && (
              <div className="px-4 pb-4 border-t border-gray-50 pt-3 animate-in slide-in-from-top-2">
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-blue-50 p-3 rounded-xl">
                    <p className="text-[9px] text-blue-500 font-bold mb-1">👨 الذكور</p>
                    <p className="font-black text-blue-700 text-sm">{lab.male}</p>
                    <p className="text-[9px] text-blue-400 font-mono">{lab.unit}</p>
                  </div>
                  <div className="bg-pink-50 p-3 rounded-xl">
                    <p className="text-[9px] text-pink-500 font-bold mb-1">👩 الإناث</p>
                    <p className="font-black text-pink-700 text-sm">{lab.female}</p>
                    <p className="text-[9px] text-pink-400 font-mono">{lab.unit}</p>
                  </div>
                </div>
                <div className="bg-amber-50 p-3 rounded-xl border border-amber-100">
                  <p className="text-[10px] text-amber-700 font-semibold leading-relaxed">💡 {lab.note}</p>
                </div>
              </div>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">
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
            { title: 'MedlinePlus — Normal Lab Values (NIH)', url: 'https://medlineplus.gov/lab-tests/' },
            { title: 'Harrison\'s Principles — Laboratory Reference Ranges', url: 'https://accessmedicine.mhmedical.com/content.aspx?bookid=3095&sectionid=261286937' },
            { title: 'LabTestsOnline — Reference Ranges Explained', url: 'https://labtestsonline.org/articles/laboratory-test-reference-ranges' },
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
