'use client';

import { useState } from 'react';
import { 
  Scale, Baby, Calendar, Utensils, Brain, Heart, 
  Activity, Dna, Syringe, TrendingUp, AlertCircle, 
  Smile, Bone, Search, ArrowRight, Stethoscope, 
  Thermometer, Droplets, ShieldAlert
} from 'lucide-react';

// استيراد الحاسبات (تأكد من صحة المسارات في مشروعك)
import BMICalculator from './BMICalculator';
import IVFCalculator from './IVFCalculator';
import PregnancyTracker from './PregnancyTracker';
import PediatricDoseCalculator from './PediatricDoseCalculator';
import GFRCalculator from './GFRCalculator';
import DiabetesRiskCalculator from './DiabetesRiskCalculator';
import FoodCaloriesDict from './FoodCaloriesDict';
import GAD7Calculator from './GAD7Calculator';
import GrowthChartsCalculator from './GrowthChartsCalculator';
import HeartRateCalculator from './HeartRateCalculator';
import LabValuesDict from './LabValuesDict';
import OsteoporosisCalculator from './OsteoporosisCalculator';
import OvulationCalculator from './OvulationCalculator';
import PainScaleCalculator from './PainScaleCalculator';
import QuickPediatricDose from './QuickPediatricDose';
import PHQ9Calculator from './PHQ9Calculator';
import ScreeningCalculator from './ScreeningCalculator';
import VaccinesSchedule from './VaccinesSchedule';
import BRICalculator from './BRICalculator';
import ChildMilestones from './ChildMilestones';
import CVDRiskCalculator from './CVDRiskCalculator';

export default function CalculatorsMenu() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeCalc, setActiveCalc] = useState<string | null>(null);

  const categories = [
    { id: 'all', label: 'الكل' },
    { id: 'general', label: 'عامة وباطنة' },
    { id: 'obgyn', label: 'نساء وتوليد' },
    { id: 'peds', label: 'أطفال' },
    { id: 'risks', label: 'مخاطر وأمراض' },
    { id: 'mental', label: 'نفسية وألم' },
    { id: 'nutrition', label: 'تغذية' },
  ];

  const calculators = [
    // --- حاسبات الأطباء (مع التمييز البصري) ---
    { id: 'gfr', category: 'general', title: 'وظائف الكلى (CrCl)', description: 'تقدير معدل التصفية لتعديل الجرعات.', icon: Activity, color: 'bg-purple-50 text-purple-600 border-purple-100', isDoctorOnly: true },
    { id: 'ivf', category: 'general', title: 'المحاليل الوريدية', description: 'حساب سرعة التنقيط واحتياجات السوائل.', icon: Droplets, color: 'bg-purple-50 text-purple-600 border-purple-100', isDoctorOnly: true },
    
    // --- باقي الحاسبات ---
    { id: 'bmi', category: 'general', title: 'مؤشر كتلة الجسم', description: 'تقييم حالة السمنة أو النحافة.', icon: Scale, color: 'bg-blue-50 text-blue-600 border-blue-100' },
    { id: 'bri', category: 'general', title: 'مؤشر استدارة الجسم', description: 'مقياس دقيق لمخاطر دهون الخصر.', icon: Activity, color: 'bg-cyan-50 text-cyan-600 border-cyan-100' },
    { id: 'heart-rate', category: 'general', title: 'نبضات القلب', description: 'النطاقات المثالية لحرق الدهون.', icon: Heart, color: 'bg-rose-50 text-rose-600 border-rose-100' },
    { id: 'lab-values', category: 'general', title: 'دليل التحاليل', description: 'النسب الطبيعية لأشهر التحاليل.', icon: Dna, color: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
    { id: 'screening', category: 'general', title: 'الفحص الشامل', description: 'الفحوصات المطلوبة حسب السن.', icon: Stethoscope, color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
    { id: 'pregnancy', category: 'obgyn', title: 'تتبع الحمل (EDD)', description: 'حساب موعد الولادة وعمر الحمل.', icon: Baby, color: 'bg-pink-50 text-pink-600 border-pink-100' },
    { id: 'ovulation', category: 'obgyn', title: 'حاسبة التبويض', description: 'تحديد أفضل أوقات الخصوبة.', icon: Calendar, color: 'bg-purple-50 text-purple-600 border-purple-100' },
    { id: 'pediatric-quick', category: 'peds', title: 'جرعات سريعة', description: 'حساب خافض الحرارة والمضادات.', icon: Thermometer, color: 'bg-orange-50 text-orange-600 border-orange-100' },
    { id: 'pediatric-dose', category: 'peds', title: 'الجرعات المتقدمة', description: 'حساب دقيق حسب تركيز الدواء.', icon: Syringe, color: 'bg-violet-50 text-violet-600 border-violet-100' },
    { id: 'vaccines', category: 'peds', title: 'جدول التطعيمات', description: 'مواعيد التطعيمات الإجبارية بمصر.', icon: Syringe, color: 'bg-teal-50 text-teal-600 border-teal-100' },
    { id: 'growth-charts', category: 'peds', title: 'منحنيات النمو', description: 'مقارنة نمو الطفل بمعدلات WHO.', icon: TrendingUp, color: 'bg-lime-50 text-lime-600 border-lime-100' },
    { id: 'child-development', category: 'peds', title: 'تطورات الطفل', description: 'المهارات المتوقعة حسب العمر.', icon: Baby, color: 'bg-sky-50 text-sky-600 border-sky-100' },
    { id: 'cvd-risk', category: 'risks', title: 'مخاطر القلب', description: 'احتمالية الجلطات والأزمات القلبية.', icon: Heart, color: 'bg-rose-50 text-rose-700 border-rose-200' },
    { id: 'diabetes-risk', category: 'risks', title: 'مخاطر السكري', description: 'احتمالية الإصابة بالنوع الثاني.', icon: Activity, color: 'bg-sky-50 text-sky-600 border-sky-100' },
    { id: 'osteoporosis', category: 'risks', title: 'هشاشة العظام', description: 'فحص سريع لعوامل الخطر للكسور.', icon: Bone, color: 'bg-slate-100 text-slate-700 border-slate-200' },
    { id: 'gad7', category: 'mental', title: 'مقياس القلق', description: 'تقييم حدة أعراض القلق GAD-7.', icon: Brain, color: 'bg-teal-50 text-teal-600 border-teal-100' },
    { id: 'phq9', category: 'mental', title: 'استبيان الاكتئاب', description: 'تقييم الصحة النفسية PHQ-9.', icon: Smile, color: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
    { id: 'pain-scale', category: 'mental', title: 'مقياس الألم', description: 'أداة بصرية لتقييم حدة الألم.', icon: AlertCircle, color: 'bg-red-50 text-red-600 border-red-100' },
    { id: 'food-calories', category: 'nutrition', title: 'دليل السعرات', description: 'جدول سعرات الأكلات المصرية.', icon: FileText, color: 'bg-yellow-50 text-yellow-600 border-yellow-100' },
  ];

  const filteredCalculators = calculators.filter(calc => {
    const matchesSearch = calc.title.includes(searchTerm) || calc.description.includes(searchTerm);
    const matchesCategory = activeCategory === 'all' || calc.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const handleBack = () => setActiveCalc(null);

  // منطق العرض (Render Logic)
  if (activeCalc === 'bmi') return <BMICalculator onBack={handleBack} />;
  if (activeCalc === 'ivf') return <IVFCalculator onBack={handleBack} />;
  if (activeCalc === 'pregnancy') return <PregnancyTracker onBack={handleBack} />;
  if (activeCalc === 'pediatric-dose') return <PediatricDoseCalculator onBack={handleBack} />;
  if (activeCalc === 'pediatric-quick') return <QuickPediatricDose onBack={handleBack} />;
  if (activeCalc === 'gfr') return <GFRCalculator onBack={handleBack} />;
  if (activeCalc === 'diabetes-risk') return <DiabetesRiskCalculator onBack={handleBack} />;
  if (activeCalc === 'food-calories') return <FoodCaloriesDict onBack={handleBack} />;
  if (activeCalc === 'gad7') return <GAD7Calculator onBack={handleBack} />;
  if (activeCalc === 'phq9') return <PHQ9Calculator onBack={handleBack} />;
  if (activeCalc === 'growth-charts') return <GrowthChartsCalculator onBack={handleBack} />;
  if (activeCalc === 'heart-rate') return <HeartRateCalculator onBack={handleBack} />;
  if (activeCalc === 'lab-values') return <LabValuesDict onBack={handleBack} />;
  if (activeCalc === 'osteoporosis') return <OsteoporosisCalculator onBack={handleBack} />;
  if (activeCalc === 'ovulation') return <OvulationCalculator onBack={handleBack} />;
  if (activeCalc === 'pain-scale') return <PainScaleCalculator onBack={handleBack} />;
  if (activeCalc === 'screening') return <ScreeningCalculator onBack={handleBack} />;
  if (activeCalc === 'vaccines') return <VaccinesSchedule onBack={handleBack} />;
  if (activeCalc === 'bri') return <BRICalculator onBack={handleBack} />;
  if (activeCalc === 'child-development') return <ChildMilestones onBack={handleBack} />;
  if (activeCalc === 'cvd-risk') return <CVDRiskCalculator onBack={handleBack} />;

  return (
    <div className="font-sans animate-in fade-in duration-500 pb-10 px-1">
      {/* Header */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 mb-4 flex flex-col md:flex-row items-center justify-between gap-4 relative overflow-hidden">
        <div className="w-full text-right z-10">
          <h1 className="text-xl md:text-2xl font-black text-gray-800 flex items-center gap-2 mb-1">
            <Activity className="w-6 h-6 text-blue-600"/>
            العيادة الذكية <span className="text-[10px] md:text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded-lg">الحاسبات</span>
          </h1>
          <p className="text-[10px] md:text-xs font-bold text-gray-500">أدوات طبية للمساعدة في التشخيص والمتابعة</p>
        </div>
        <div className="relative w-full md:w-80 z-10">
          <Search className="absolute right-3.5 top-3 text-gray-400 w-4 h-4"/>
          <input 
            type="text" 
            placeholder="ابحث عن حاسبة..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-10 pl-4 py-2.5 bg-gray-50 border border-gray-100 focus:bg-white focus:border-blue-500 rounded-xl outline-none transition-all font-bold text-gray-700 text-xs md:text-sm"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-2 pb-3 mb-4 custom-scrollbar no-scrollbar">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border-2 ${
              activeCategory === cat.id
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-white text-gray-600 border-gray-100 hover:border-gray-200'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {filteredCalculators.map((calc, idx) => {
          const Icon = calc.icon;
          return (
            <button 
              key={idx} 
              onClick={() => setActiveCalc(calc.id)} 
              className="group h-full text-right outline-none w-full relative"
            >
              {/* البطاقة الرئيسية */}
              <div className={`
                bg-white p-3 md:p-5 rounded-2xl border-2 transition-all duration-300 h-full flex flex-col overflow-hidden
                ${calc.isDoctorOnly 
                  ? 'border-purple-200 bg-purple-50/20 shadow-purple-50 hover:border-purple-400' 
                  : 'border-transparent shadow-sm hover:border-blue-100 hover:shadow-md'
                }
              `}>
                
                {/* علامة الشريط (Ribbon) للأطباء */}
                {calc.isDoctorOnly && (
                  <div className="absolute -left-7 top-3 -rotate-45 bg-red-600 text-white text-[8px] font-black py-0.5 px-8 shadow-sm z-20">
                    طبي ⚕️
                  </div>
                )}

                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${calc.color}`}>
                    <Icon className="w-4 h-4 md:w-5 md:h-5" />
                  </div>
                  <h3 className={`text-[11px] md:text-sm font-black transition-colors line-clamp-2 leading-tight ${calc.isDoctorOnly ? 'text-purple-800' : 'text-gray-800 group-hover:text-blue-600'}`}>
                    {calc.title}
                  </h3>
                </div>
                
                <p className="text-[9px] md:text-xs font-bold text-gray-500 leading-relaxed mb-3 flex-1 line-clamp-2">
                  {calc.description}
                </p>

                <div className={`flex items-center justify-between text-[9px] md:text-[10px] font-black mt-auto pt-2.5 border-t border-gray-50 ${calc.isDoctorOnly ? 'text-purple-600' : 'text-gray-400 group-hover:text-blue-600'}`}>
                  <span>{calc.isDoctorOnly ? 'للأطباء فقط' : 'افتح الأداة'}</span>
                  <ArrowRight className="w-3 h-3 mr-auto group-hover:-translate-x-1 transition-transform"/>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
