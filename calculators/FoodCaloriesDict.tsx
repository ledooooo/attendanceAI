import React, { useState } from 'react';
import { ArrowRight, Search, Info, BookOpen, ExternalLink } from 'lucide-react';

interface Props { onBack?: () => void; }

// ─── SVG Icon ─────────────────────────────────────────────────────────────────
const FoodIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
    <rect width="48" height="48" rx="14" fill="#FEFCE8"/>
    {/* Plate */}
    <circle cx="24" cy="26" r="13" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="1.5"/>
    <circle cx="24" cy="26" r="9" fill="#FDE68A" stroke="#F59E0B" strokeWidth="1"/>
    {/* Fork */}
    <path d="M11 10V16C11 17.105 11.895 18 13 18V22" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M13 10V18M11 12H15M11 14H15" stroke="#D97706" strokeWidth="1.2" strokeLinecap="round"/>
    {/* Knife */}
    <path d="M37 10C37 10 38 13 38 16C38 17.657 36.657 19 35 19V22" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round"/>
    {/* Food on plate - stylized */}
    <circle cx="22" cy="25" r="2.5" fill="#F97316" opacity="0.8"/>
    <circle cx="27" cy="24" r="2" fill="#22C55E" opacity="0.8"/>
    <circle cx="25" cy="28" r="1.5" fill="#EF4444" opacity="0.7"/>
  </svg>
);

// ─── Food data ────────────────────────────────────────────────────────────────
interface FoodItem {
  name: string;
  cal: number;
  unit: string;
  protein: number;  // g
  carbs: number;    // g
  fat: number;      // g
  category: string;
}

const foods: FoodItem[] = [
  // خبز وحبوب
  { name: 'رغيف عيش بلدي كامل',    cal: 300, unit: 'رغيف (150جم)',     protein: 10, carbs: 60, fat: 2,  category: 'خبز وحبوب' },
  { name: 'رغيف عيش فينو',          cal: 160, unit: 'رغيف متوسط',       protein: 5,  carbs: 32, fat: 1,  category: 'خبز وحبوب' },
  { name: 'أرز أبيض مطبوخ',         cal: 200, unit: 'كوب مطبوخ (186جم)', protein: 4,  carbs: 44, fat: 0,  category: 'خبز وحبوب' },
  { name: 'خبز توست (شريحة)',        cal: 80,  unit: 'شريحة واحدة',       protein: 3,  carbs: 15, fat: 1,  category: 'خبز وحبوب' },
  { name: 'مكرونة مطبوخة',          cal: 220, unit: 'كوب مطبوخ',         protein: 8,  carbs: 43, fat: 1,  category: 'خبز وحبوب' },

  // أطباق مصرية رئيسية
  { name: 'كشري مصري',              cal: 550, unit: 'طبق متوسط',         protein: 18, carbs: 95, fat: 10, category: 'أطباق رئيسية' },
  { name: 'مكرونة بشاميل',          cal: 400, unit: 'قطعة متوسطة',       protein: 15, carbs: 40, fat: 18, category: 'أطباق رئيسية' },
  { name: 'فول مدمس (بدون زيت)',    cal: 220, unit: 'طبق متوسط (200جم)', protein: 13, carbs: 35, fat: 1,  category: 'أطباق رئيسية' },
  { name: 'طعمية / فلافل',          cal: 60,  unit: 'قرص واحد',          protein: 3,  carbs: 6,  fat: 3,  category: 'أطباق رئيسية' },
  { name: 'محشي ورق عنب',           cal: 35,  unit: 'ورقة واحدة',        protein: 1,  carbs: 5,  fat: 1,  category: 'أطباق رئيسية' },
  { name: 'ملوخية مطبوخة',          cal: 120, unit: 'طبق متوسط',         protein: 6,  carbs: 10, fat: 5,  category: 'أطباق رئيسية' },
  { name: 'بامية باللحم',           cal: 250, unit: 'طبق متوسط',         protein: 15, carbs: 20, fat: 12, category: 'أطباق رئيسية' },
  { name: 'مسقعة بالبيض',           cal: 180, unit: 'حصة متوسطة',        protein: 8,  carbs: 12, fat: 11, category: 'أطباق رئيسية' },
  { name: 'سمك بلطي مشوي',          cal: 180, unit: 'سمكة متوسطة',       protein: 28, carbs: 0,  fat: 7,  category: 'أطباق رئيسية' },
  { name: 'كبدة بالبصل',            cal: 200, unit: 'حصة متوسطة',        protein: 22, carbs: 8,  fat: 9,  category: 'أطباق رئيسية' },

  // بيض وألبان
  { name: 'بيض مسلوق',              cal: 75,  unit: 'بيضة واحدة',        protein: 6,  carbs: 0,  fat: 5,  category: 'بيض وألبان' },
  { name: 'بيض مقلي (زيت قليل)',    cal: 100, unit: 'بيضة واحدة',        protein: 7,  carbs: 0,  fat: 7,  category: 'بيض وألبان' },
  { name: 'جبنة بيضاء قريش',        cal: 50,  unit: '100جم',             protein: 10, carbs: 2,  fat: 0,  category: 'بيض وألبان' },
  { name: 'جبنة رومي',              cal: 110, unit: '30جم (شريحة)',       protein: 8,  carbs: 0,  fat: 8,  category: 'بيض وألبان' },
  { name: 'لبن كامل الدسم',         cal: 150, unit: 'كوب (240مل)',        protein: 8,  carbs: 12, fat: 8,  category: 'بيض وألبان' },
  { name: 'زبادي (لبن رايب)',        cal: 100, unit: 'كوب (245جم)',        protein: 9,  carbs: 11, fat: 4,  category: 'بيض وألبان' },

  // حلويات مصرية
  { name: 'حلاوة طحينية',           cal: 100, unit: 'ملعقة كبيرة (30جم)', protein: 2,  carbs: 12, fat: 5,  category: 'حلويات' },
  { name: 'قطايف بالمكسرات',        cal: 340, unit: 'قطعتان',             protein: 7,  carbs: 38, fat: 18, category: 'حلويات' },
  { name: 'كنافة بالجبن',           cal: 400, unit: 'قطعة (100جم)',        protein: 8,  carbs: 50, fat: 18, category: 'حلويات' },
  { name: 'بسبوسة',                 cal: 200, unit: 'قطعة متوسطة',        protein: 3,  carbs: 32, fat: 8,  category: 'حلويات' },
  { name: 'عيش السرايا',            cal: 280, unit: 'قطعة متوسطة',        protein: 4,  carbs: 45, fat: 10, category: 'حلويات' },
  { name: 'أم علي',                 cal: 450, unit: 'طبق فردي',           protein: 10, carbs: 55, fat: 22, category: 'حلويات' },

  // مشروبات
  { name: 'شاي بالسكر',             cal: 35,  unit: 'كوب واحد',           protein: 0,  carbs: 9,  fat: 0,  category: 'مشروبات' },
  { name: 'عصير قصب طبيعي',         cal: 120, unit: 'كوب (250مل)',        protein: 0,  carbs: 30, fat: 0,  category: 'مشروبات' },
  { name: 'قهوة بالحليب والسكر',    cal: 80,  unit: 'فنجان',             protein: 2,  carbs: 13, fat: 2,  category: 'مشروبات' },
];

const categories = ['الكل', ...Array.from(new Set(foods.map(f => f.category)))];

const macroColor = (type: 'protein' | 'carbs' | 'fat') => {
  if (type === 'protein') return 'bg-blue-100 text-blue-700';
  if (type === 'carbs')   return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
};

export default function FoodCaloriesDict({ onBack }: Props) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('الكل');
  const [expanded, setExpanded] = useState<number | null>(null);

  const filtered = foods.filter(f => {
    const matchSearch = f.name.includes(search);
    const matchCat = activeCategory === 'الكل' || f.category === activeCategory;
    return matchSearch && matchCat;
  });

  const totalCal = filtered.reduce((s, f) => s + f.cal, 0);

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 duration-300 pb-10">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-5">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50"><ArrowRight className="w-5 h-5 text-gray-600" /></button>}
        <div className="flex items-center gap-3">
          <FoodIcon />
          <div>
            <h2 className="text-xl font-black text-gray-800">دليل السعرات الحرارية</h2>
            <p className="text-xs text-gray-400 font-semibold">الأكل المصري — {foods.length} صنف</p>
          </div>
        </div>
      </div>

      {/* ── Info ── */}
      <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-100 mb-5 flex gap-3 text-yellow-800">
        <Info className="w-5 h-5 shrink-0 mt-0.5 text-yellow-500" />
        <div className="text-xs leading-relaxed">
          <p className="font-bold mb-1">عن هذا الدليل</p>
          <p>قيم تقريبية للسعرات والعناصر الغذائية للأطعمة الشائعة في المطبخ المصري. الأرقام قد تختلف حسب طريقة الطهي والحجم الفعلي.</p>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="relative mb-3">
        <Search className="absolute right-4 top-3.5 text-gray-400 w-4 h-4" />
        <input type="text" placeholder="ابحث عن أكلة..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pr-10 pl-4 py-3.5 border border-gray-200 bg-white rounded-xl outline-none focus:bg-white focus:border-yellow-400 transition-all font-bold text-gray-700 text-sm" />
      </div>

      {/* ── Category filter ── */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 no-scrollbar">
        {categories.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className={`shrink-0 text-[10px] font-black px-3 py-1.5 rounded-full border transition-all ${activeCategory === cat ? 'bg-yellow-500 text-white border-yellow-500' : 'bg-white text-gray-500 border-gray-200 hover:border-yellow-300'}`}>
            {cat}
          </button>
        ))}
      </div>

      {/* ── Count & legend ── */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-400 font-bold">{filtered.length} صنف</p>
        <div className="flex gap-2">
          {[{ l: 'بروتين', t: 'protein' as const }, { l: 'كربوهيدرات', t: 'carbs' as const }, { l: 'دهون', t: 'fat' as const }].map(m => (
            <span key={m.t} className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${macroColor(m.t)}`}>{m.l}</span>
          ))}
        </div>
      </div>

      {/* ── Food list ── */}
      <div className="space-y-2">
        {filtered.map((f, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button onClick={() => setExpanded(expanded === i ? null : i)}
              className="w-full flex items-center justify-between p-4 hover:bg-yellow-50/50 transition-colors">
              <div className="text-right flex-1">
                <p className="font-bold text-gray-800 text-sm">{f.name}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{f.unit}</p>
              </div>
              <div className="text-left shrink-0 ml-3">
                <span className="font-black text-yellow-600 text-xl">{f.cal}</span>
                <span className="text-[9px] text-gray-400 mr-0.5 font-bold">سُعر</span>
              </div>
            </button>

            {expanded === i && (
              <div className="px-4 pb-4 animate-in slide-in-from-top-2">
                <div className="grid grid-cols-3 gap-2">
                  <div className={`p-2.5 rounded-xl text-center ${macroColor('protein')}`}>
                    <p className="text-[9px] font-bold opacity-70">بروتين</p>
                    <p className="font-black text-sm">{f.protein}جم</p>
                  </div>
                  <div className={`p-2.5 rounded-xl text-center ${macroColor('carbs')}`}>
                    <p className="text-[9px] font-bold opacity-70">كربوهيدرات</p>
                    <p className="font-black text-sm">{f.carbs}جم</p>
                  </div>
                  <div className={`p-2.5 rounded-xl text-center ${macroColor('fat')}`}>
                    <p className="text-[9px] font-bold opacity-70">دهون</p>
                    <p className="font-black text-sm">{f.fat}جم</p>
                  </div>
                </div>
                {/* Calorie bar visual */}
                <div className="mt-3">
                  <div className="flex rounded-full overflow-hidden h-2">
                    <div style={{ width: `${(f.protein * 4 / f.cal) * 100}%`, backgroundColor: '#93C5FD' }} />
                    <div style={{ width: `${(f.carbs * 4 / f.cal) * 100}%`, backgroundColor: '#FCD34D' }} />
                    <div style={{ width: `${(f.fat * 9 / f.cal) * 100}%`, backgroundColor: '#FCA5A5' }} />
                  </div>
                  <p className="text-[8px] text-gray-400 font-semibold mt-1 text-center">توزيع السعرات: بروتين / كربوهيدرات / دهون</p>
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
        <p className="flex items-center gap-1.5 text-xs font-black text-gray-600 mb-3"><BookOpen className="w-3.5 h-3.5"/> المصادر</p>
        <div className="space-y-2">
          {[
            { title: 'USDA FoodData Central — Nutritional Database', url: 'https://fdc.nal.usda.gov/' },
            { title: 'FAO — Food Composition Tables for Near East', url: 'https://www.fao.org/infoods/infoods/tables-and-databases/near-east/en/' },
            { title: 'Nutrition Data — Egyptian traditional foods', url: 'https://nutritiondata.self.com/' },
          ].map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-[10px] text-yellow-600 font-semibold hover:underline">
              <ExternalLink className="w-3 h-3 shrink-0" />{s.title}
            </a>
          ))}
        </div>
        <p className="text-[9px] text-gray-400 font-semibold mt-3 leading-relaxed">* القيم تقريبية وتعتمد على متوسط طرق الطهي الشائعة. للقيم الدقيقة راجع ملصق التغذية على المنتج.</p>
      </div>

    </div>
  );
}
