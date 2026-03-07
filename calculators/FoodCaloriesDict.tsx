import React, { useState } from 'react';
import { Utensils, ArrowRight, Search } from 'lucide-react';

interface Props { onBack?: () => void; }

export default function FoodCaloriesDict({ onBack }: Props) {
  const [search, setSearch] = useState('');

  const foods = [
    { name: 'رغيف عيش بلدي (كامل)', cal: 300, unit: 'رغيف' },
    { name: 'رغيف عيش فينو', cal: 160, unit: 'رغيف متوسط' },
    { name: 'طعمية (فلافل)', cal: 60, unit: 'قرص متوسط' },
    { name: 'فول مدمس (بدون زيت)', cal: 220, unit: 'طبق متوسط (200جم)' },
    { name: 'كشري مصري', cal: 550, unit: 'طبق متوسط' },
    { name: 'مكرونة بشاميل', cal: 400, unit: 'قطعة متوسطة' },
    { name: 'محشي كرنب/ورق عنب', cal: 35, unit: 'صابع واحد' },
    { name: 'ملوخية', cal: 120, unit: 'طبق متوسط' },
    { name: 'أرز أبيض مطبوخ', cal: 200, unit: 'كوب مطبوخ' },
    { name: 'بامية باللحم', cal: 250, unit: 'طبق متوسط' },
    { name: 'حلاوة طحينية', cal: 100, unit: 'ملعقة كبيرة' },
    { name: 'قطايف (بالمكسرات)', cal: 340, unit: 'قطعتين' },
    { name: 'كنافة', cal: 400, unit: 'قطعة (100جم)' },
    { name: 'بيض مسلوق', cal: 75, unit: 'بيضة واحدة' },
    { name: 'بيض مقلي (زيت قليل)', cal: 100, unit: 'بيضة واحدة' },
  ];

  const filteredFoods = foods.filter(f => f.name.includes(search));

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center gap-3 mb-6">
        {onBack && (
          <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50 transition-colors">
            <ArrowRight className="w-5 h-5 text-gray-600" />
          </button>
        )}
        <div className="flex items-center gap-2">
          <div className="p-2 bg-yellow-100 text-yellow-600 rounded-xl"><Utensils className="w-5 h-5" /></div>
          <h2 className="text-xl font-black text-gray-800">دليل السعرات للأكل المصري</h2>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
        <div className="relative mb-6">
          <Search className="absolute right-4 top-3.5 text-gray-400 w-5 h-5"/>
          <input 
            type="text" 
            placeholder="ابحث عن أكلة (مثال: طعمية، محشي...)" 
            value={search}
            onChange={e=>setSearch(e.target.value)}
            className="w-full pr-11 pl-4 py-3.5 border border-gray-200 bg-gray-50 rounded-xl outline-none focus:bg-white focus:border-yellow-500 transition-all font-bold text-gray-700"
          />
        </div>

        <div className="space-y-2 max-h-[50vh] overflow-y-auto custom-scrollbar pr-1">
          {filteredFoods.length > 0 ? (
            filteredFoods.map((f, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-gray-50 hover:bg-yellow-50 rounded-2xl border border-transparent hover:border-yellow-200 transition-colors group">
                <div>
                  <p className="font-bold text-gray-800 text-sm">{f.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{f.unit}</p>
                </div>
                <div className="text-left bg-white px-3 py-1.5 rounded-xl shadow-sm border border-gray-100 group-hover:border-yellow-100">
                  <span className="font-black text-yellow-600 text-lg">{f.cal}</span>
                  <span className="text-[10px] text-gray-400 mr-1 font-bold">سُعر</span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-10 text-gray-400 font-bold text-sm">لا توجد نتائج مطابقة</div>
          )}
        </div>
      </div>
    </div>
  );
}
