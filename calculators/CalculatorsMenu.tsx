'use client';

import { useState } from 'react';
import { 
  Scale, Baby, Calendar, Utensils, Brain, Heart, 
  Activity, Dna, Syringe, TrendingUp, AlertCircle, 
  Smile, Bone, Search, ArrowRight, Stethoscope, 
  Thermometer, Droplets, ShieldAlert, FileText
} from 'lucide-react';

// --- استيراد جميع الحاسبات من مجلدك ---
import BMICalculator from './BMICalculator';
import BRICalculator from './BRICalculator';
import CHADSVASCCalculator from './CHADSVASCCalculator';
import CURB65Calculator from './CURB65Calculator';
import CVDRiskCalculator from './CVDRiskCalculator';
import CentorScoreCalculator from './CentorScoreCalculator';
import ChildMilestones from './ChildMilestones';
import DiabetesRiskCalculator from './DiabetesRiskCalculator';
import FIB4Calculator from './FIB4Calculator';
import FoodCaloriesDict from './FoodCaloriesDict';
import GAD7Calculator from './GAD7Calculator';
import GFRCalculator from './GFRCalculator';
import GrowthChartsCalculator from './GrowthChartsCalculator';
import HeartRateCalculator from './HeartRateCalculator';
import IVFCalculator from './IVFCalculator';
import LabValuesDict from './LabValuesDict';
import OsteoporosisCalculator from './OsteoporosisCalculator';
import OvulationCalculator from './OvulationCalculator';
import PHQ9Calculator from './PHQ9Calculator';
import PainScaleCalculator from './PainScaleCalculator';
import PediatricDoseCalculator from './PediatricDoseCalculator';
import PregnancyCalculator from './PregnancyCalculator';
import PregnancyTracker from './PregnancyTracker';
import QuickPediatricDose from './QuickPediatricDose';
import ScreeningCalculator from './ScreeningCalculator';
import VaccinesSchedule from './VaccinesSchedule';

export default function CalculatorsMenu() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeCalc, setActiveCalc] = useState<string | null>(null);

  // الأقسام حسب الوظيفة الطبية
  const categories = [
    { id: 'all', label: 'الكل' },
    { id: 'general', label: 'باطنة وعامة' },
    { id: 'obgyn', label: 'نساء وتوليد' },
    { id: 'peds', label: 'طب الأطفال' },
    { id: 'risks', label: 'مخاطر وأمراض' },
    { id: 'mental', label: 'نفسية وألم' },
    { id: 'nutrition', label: 'تغذية' },
  ];

  const calculators = [
    // --- باطنة وعامة ---
    { id: 'centor', category: 'general', title: 'مقياس Centor', description: 'تقييم التهاب الحلق البكتيري.', icon: Stethoscope, color: 'bg-red-50 text-red-600', isDoctorOnly: true },
    { id: 'curb65', category: 'general', title: 'مقياس CURB-65', description: 'تقييم خطورة الالتهاب الرئوي.', icon: Activity, color: 'bg-red-50 text-red-600', isDoctorOnly: true },
    { id: 'fib4', category: 'general', title: 'مؤشر تليف الكبد', description: 'تقييم التليف لمرضى الكبد الدهني.', icon: Activity, color: 'bg-red-50 text-red-600', isDoctorOnly: true },
    { id: 'gfr', category: 'general', title: 'وظائف الكلى (CrCl)', description: 'تقدير معدل التصفية لتعديل الجرعات.', icon: Activity, color: 'bg-red-50 text-red-600', isDoctorOnly: true },
    { id: 'ivf', category: 'general', title: 'المحاليل الوريدية', description: 'حساب سرعة التنقيط واحتياجات السوائل.', icon: Droplets, color: 'bg-red-50 text-red-600', isDoctorOnly: true },
    { id: 'bmi', category: 'general', title: 'مؤشر كتلة الجسم', description: 'تقييم حالة السمنة أو النحافة.', icon: Scale, color: 'bg-blue-50 text-blue-600' },
    { id: 'bri', category: 'general', title: 'مؤشر استدارة الجسم', description: 'مقياس دقيق لمخاطر دهون الخصر.', icon: Activity, color: 'bg-cyan-50 text-cyan-600' },
    { id: 'heart-rate', category: 'general', title: 'نبضات القلب', description: 'النطاقات المثالية لحرق الدهون.', icon: Heart, color: 'bg-rose-50 text-rose-600' },
    { id: 'lab-values', category: 'general', title: 'دليل التحاليل', description: 'النسب الطبيعية لأشهر التحاليل.', icon: Dna, color: 'bg-indigo-50 text-indigo-600' },
    { id: 'screening', category: 'general', title: 'الفحص الشامل', description: 'الفحوصات المطلوبة حسب السن.', icon: Stethoscope, color: 'bg-emerald-50 text-emerald-600' },

    // --- نساء وتوليد ---
    { id: 'pregnancy-calc', category: 'obgyn', title: 'حاسبة الحمل', description: 'موعد الولادة وعمر الجنين بالأسابيع.', icon: Baby, color: 'bg-pink-50 text-pink-600' },
    { id: 'pregnancy-track', category: 'obgyn', title: 'تتبع الحمل (EDD)', description: 'متابعة مراحل تطور الجنين أسبوعياً.', icon: Calendar, color: 'bg-pink-50 text-pink-700' },
    { id: 'ovulation', category: 'obgyn', title: 'حاسبة التبويض', description: 'تحديد أيام التبويض والخصوبة.', icon: Calendar, color: 'bg-purple-50 text-purple-600' },
    { id: 'chadsvasc', category: 'obgyn', title: 'السكتة الدماغية', description: 'مقياس CHA2DS2-VASc للسيولة.', icon: Heart, color: 'bg-red-50 text-red-600', isDoctorOnly: true },

    // --- أطفال ---
    { id: 'pediatric-quick', category: 'peds', title: 'جرعات سريعة', description: 'حساب خافض الحرارة والمضادات.', icon: Thermometer, color: 'bg-orange-50 text-orange-600' },
    { id: 'pediatric-dose', category: 'peds', title: 'الجرعات المتقدمة', description: 'حساب دقيق حسب الوزن والتركيز.', icon: Syringe, color: 'bg-violet-50 text-violet-600' },
    { id: 'vaccines', category: 'peds', title: 'جدول التطعيمات', description: 'مواعيد التطعيمات الإجبارية بمصر.', icon: Syringe, color: 'bg-teal-50 text-teal-600' },
    { id: 'growth-charts', category: 'peds', title: 'منحنيات النمو', description: 'مقارنة نمو الطفل بمعدلات WHO.', icon: TrendingUp, color: 'bg-lime-50 text-lime-600' },
    { id: 'child-development', category: 'peds', title: 'تطورات الطفل', description: 'المهارات المتوقعة حسب العمر.', icon: Baby, color: 'bg-sky-50 text-sky-600' },

    // --- مخاطر وأمراض ---
    { id: 'cvd-risk', category: 'risks', title: 'مخاطر القلب', description: 'احتمالية الجلطات خلال 10 سنوات.', icon: Heart, color: 'bg-rose-50 text-rose-700' },
    { id: 'diabetes-risk', category: 'risks', title: 'مخاطر السكري', description: 'تقييم احتمالية الإصابة بالسكري.', icon: Activity, color: 'bg-sky-50 text-sky-600' },
    { id: 'osteoporosis', category: 'risks', title: 'هشاشة العظام', description: 'عوامل خطر الكسور وضعف العظام.', icon: Bone, color: 'bg-slate-100 text-slate-700' },

    // --- نفسية وألم ---
    { id: 'gad7', category: 'mental', title: 'مقياس القلق', description: 'تقييم أعراض القلق (GAD-7).', icon: Brain, color: 'bg-teal-50 text-teal-600' },
    { id: 'phq9', category: 'mental', title: 'استبيان الاكتئاب', description: 'تقييم الصحة النفسية (PHQ-9).', icon: Smile, color: 'bg-indigo-50 text-indigo-600' },
    { id: 'pain-scale', category: 'mental', title: 'مقياس الألم', description: 'تقييم حدة الألم السريري.', icon: AlertCircle, color: 'bg-red-50 text-red-600' },

    // --- تغذية ---
    { id: 'food-calories', category: 'nutrition', title: 'دليل السعرات', description: 'سعرات الأكلات المصرية المحلية.', icon: FileText, color: 'bg-yellow-50 text-yellow-600' },
  ];

  const filteredCalculators = calculators.filter(calc => {
    const matchesSearch = calc.title.includes(searchTerm) || calc.description.includes(searchTerm);
    const matchesCategory = activeCategory === 'all' || calc.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const handleBack = () => setActiveCalc(null);

  if (activeCalc === 'bmi') return <BMICalculator onBack={handleBack} />;
  if (activeCalc === 'bri') return <BRICalculator onBack={handleBack} />;
  if (activeCalc === 'ivf') return <IVFCalculator onBack={handleBack} />;
  if (activeCalc === 'pregnancy-calc') return <PregnancyCalculator onBack={handleBack} />;
  if (activeCalc === 'pregnancy-track') return <PregnancyTracker onBack={handleBack} />;
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
  if (activeCalc === 'child-development') return <ChildMilestones onBack={handleBack} />;
  if (activeCalc === 'cvd-risk') return <CVDRiskCalculator onBack={handleBack} />;
  if (activeCalc === 'centor') return <CentorScoreCalculator onBack={handleBack} />;
  if (activeCalc === 'curb65') return <CURB65Calculator onBack={handleBack} />;
  if (activeCalc === 'fib4') return <FIB4Calculator onBack={handleBack} />;
  if (activeCalc === 'chadsvasc') return <CHADSVASCCalculator onBack={handleBack} />;

  return (
    <div className="font-sans animate-in fade-in duration-500 pb-10 px-1 text-right" dir="rtl">
      {/* Header */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 mb-4 flex flex-col md:flex-row items-center justify-between gap-4 relative overflow-hidden">
        <div className="w-full text-right z-10">
          <h1 className="text-xl md:text-2xl font-black text-gray-800 flex items-center gap-2 mb-1">
            <Activity className="w-6 h-6 text-blue-600"/>
            العيادة الذكية <span className="text-[10px] md:text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded-lg">الحاسبات</span>
          </h1>
          <p className="text-[10px] md:text-xs font-bold text-gray-500">أدوات طبية منظمة حسب التخصص الوظيفي</p>
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
      <div className="flex overflow-x-auto gap-2 pb-3 mb-4 no-scrollbar">
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

      {/* Grid Display */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {filteredCalculators.map((calc, idx) => {
          const Icon = calc.icon;
          return (
            <button key={idx} onClick={() => setActiveCalc(calc.id)} className="group h-full text-right outline-none w-full relative">
              <div className={`bg-white p-3 md:p-5 rounded-2xl border-2 transition-all duration-300 h-full flex flex-col ${calc.isDoctorOnly ? 'border-red-100 bg-red-50/10' : 'border-transparent shadow-sm hover:border-blue-100 hover:shadow-md'}`}>
                <div className="mb-2">
                  <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center shrink-0 border mb-2 ${calc.color}`}>
                    <Icon className="w-4 h-4 md:w-5 md:h-5" />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 min-h-[2.5rem]">
                    <h3 className={`text-[11px] md:text-sm font-black leading-tight ${calc.isDoctorOnly ? 'text-red-900' : 'text-gray-800 group-hover:text-blue-600'}`}>
                      {calc.title}
                    </h3>
                    {calc.isDoctorOnly && (
                      <span className="bg-red-600 text-white text-[7px] md:text-[9px] px-1.5 py-0.5 rounded-md font-bold flex items-center gap-0.5">
                        <ShieldAlert size={8} /> طبي
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-[9px] md:text-xs font-bold text-gray-400 leading-relaxed mb-3 flex-1 line-clamp-2">
                  {calc.description}
                </p>
                <div className={`flex items-center justify-between text-[9px] md:text-[10px] font-black mt-auto pt-2.5 border-t border-gray-50 ${calc.isDoctorOnly ? 'text-red-600' : 'text-gray-400 group-hover:text-blue-600'}`}>
                  <span>{calc.isDoctorOnly ? 'للاستخدام الطبي' : 'افتح الأداة'}</span>
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
