import React, { useState } from 'react';
import { 
  Scale, Baby, Calendar, Utensils, Brain, Heart, 
  Activity, Dna, Syringe, TrendingUp, AlertCircle, 
  Smile, Bone, Search, ArrowRight, Stethoscope, 
  Thermometer, FileText, Droplet
} from 'lucide-react';
import toast from 'react-hot-toast';

// --- استيراد جميع الحاسبات ---
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
// الحاسبات الجديدة التي تم تفعيلها
import BRICalculator from './BRICalculator';
import ChildMilestones from './ChildMilestones';

export default function CalculatorsMenu() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCalc, setActiveCalc] = useState<string | null>(null);

  // قائمة الحاسبات مقسمة حسب الفئة
  const calculators = [
    // === عامة وصحة بدنية ===
    { id: 'bmi', category: 'general', title: 'مؤشر كتلة الجسم', description: 'تقييم حالة السمنة أو النحافة.', icon: Scale, color: 'bg-blue-50 text-blue-600 border-blue-100' },
    { id: 'bri', category: 'general', title: 'مؤشر استدارة الجسم', description: 'مقياس حديث دقيق لمخاطر دهون الخصر.', icon: Activity, color: 'bg-cyan-50 text-cyan-600 border-cyan-100' },
    { id: 'ivf', category: 'general', title: 'معدل المحاليل', description: 'حساب سرعة التنقيط الوريدي بدقة.', icon: Droplet, color: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
    { id: 'gfr', category: 'general', title: 'وظائف الكلى (CrCl)', description: 'تقدير معدل التصفية لتعديل الجرعات.', icon: Activity, color: 'bg-amber-50 text-amber-600 border-amber-100' },
    { id: 'heart-rate', category: 'general', title: 'نبضات القلب', description: 'نطاقات النبض المثالية لحرق الدهون.', icon: Heart, color: 'bg-rose-50 text-rose-600 border-rose-100' },
    { id: 'lab-values', category: 'general', title: 'دليل التحاليل', description: 'النسب الطبيعية لأشهر التحاليل.', icon: Dna, color: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
    { id: 'screening', category: 'general', title: 'الفحص الشامل', description: 'الفحوصات المطلوبة حسب السن.', icon: Stethoscope, color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },

    // === نساء وتوليد ===
    { id: 'pregnancy', category: 'obgyn', title: 'تتبع الحمل (EDD)', description: 'حساب موعد الولادة وعمر الحمل.', icon: Baby, color: 'bg-pink-50 text-pink-600 border-pink-100' },
    { id: 'ovulation', category: 'obgyn', title: 'حاسبة التبويض', description: 'تحديد أفضل أوقات الخصوبة.', icon: Calendar, color: 'bg-purple-50 text-purple-600 border-purple-100' },

    // === أطفال ===
    { id: 'pediatric-quick', category: 'peds', title: 'جرعات سريعة', description: 'حساب خافض الحرارة والمضادات.', icon: Thermometer, color: 'bg-orange-50 text-orange-600 border-orange-100' },
    { id: 'pediatric-dose', category: 'peds', title: 'الجرعات المتقدمة', description: 'حساب دقيق حسب تركيز الدواء.', icon: Syringe, color: 'bg-violet-50 text-violet-600 border-violet-100' },
    { id: 'vaccines', category: 'peds', title: 'جدول التطعيمات', description: 'مواعيد التطعيمات الإجبارية (مصر).', icon: Syringe, color: 'bg-teal-50 text-teal-600 border-teal-100' },
    { id: 'growth-charts', category: 'peds', title: 'منحنيات النمو', description: 'مقارنة وزن الطفل بالمعدلات (WHO).', icon: TrendingUp, color: 'bg-lime-50 text-lime-600 border-lime-100' },
    { id: 'child-development', category: 'peds', title: 'تطورات الطفل', description: 'المهارات الحركية والعقلية المتوقعة.', icon: Baby, color: 'bg-sky-50 text-sky-600 border-sky-100' },

    // === تغذية ===
    { id: 'food-calories', category: 'nutrition', title: 'دليل السعرات', description: 'جدول سعرات الأكلات المصرية.', icon: FileText, color: 'bg-yellow-50 text-yellow-600 border-yellow-100' },

    // === صحة نفسية وتقييم ألم ===
    { id: 'gad7', category: 'mental', title: 'مقياس القلق', description: 'تقييم حدة أعراض القلق (GAD-7).', icon: Brain, color: 'bg-teal-50 text-teal-600 border-teal-100' },
    { id: 'phq9', category: 'mental', title: 'استبيان الاكتئاب', description: 'تقييم الصحة النفسية (PHQ-9).', icon: Smile, color: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
    { id: 'pain-scale', category: 'mental', title: 'مقياس الألم', description: 'أداة بصرية لتقييم حدة الألم (VAS).', icon: AlertCircle, color: 'bg-red-50 text-red-600 border-red-100' },

    // === مخاطر وأمراض ===
    { id: 'diabetes-risk', category: 'risks', title: 'مخاطر السكري', description: 'احتمالية الإصابة بالنوع الثاني.', icon: Activity, color: 'bg-sky-50 text-sky-600 border-sky-100' },
    { id: 'osteoporosis', category: 'risks', title: 'هشاشة العظام', description: 'فحص سريع لعوامل الخطر لضعف العظام.', icon: Bone, color: 'bg-blue-50 text-blue-800 border-blue-200' },
    
    // --- Coming Soon ---
    { id: 'cvd-risk', category: 'risks', title: 'مخاطر القلب', description: 'احتمالية الجلطات والأزمات القلبية.', icon: Heart, color: 'bg-gray-100 text-gray-400 border-gray-200' },
  ];

  const categoriesMap: any = {
    general: 'صحة بدنية وعامة',
    obgyn: 'نساء وتوليد',
    peds: 'طب الأطفال',
    mental: 'نفسية وألم',
    risks: 'مخاطر وأمراض',
    nutrition: 'تغذية',
  };

  const filteredCalculators = calculators.filter(calc => 
    calc.title.includes(searchTerm) || calc.description.includes(searchTerm)
  );

  const handleOpenCalculator = (id: string) => {
    const implementedCalculators = ['bmi', 'ivf', 'pregnancy', 'pediatric-dose', 'gfr', 'diabetes-risk', 'food-calories', 'gad7', 'growth-charts', 'heart-rate', 'lab-values', 'osteoporosis', 'ovulation', 'pain-scale', 'pediatric-quick', 'phq9', 'screening', 'vaccines', 'bri', 'child-development'];
    
    if (implementedCalculators.includes(id)) {
      setActiveCalc(id);
    } else {
      toast('سيتم إتاحة هذه الحاسبة قريباً ⏳', { icon: '🚧' });
    }
  };

  const handleBack = () => setActiveCalc(null);

  // === RENDER ACTIVE CALCULATOR ===
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

  // Group filtered calculators by category
  const groupedCalculators = filteredCalculators.reduce((acc, calc) => {
    if (!acc[calc.category]) acc[calc.category] = [];
    acc[calc.category].push(calc);
    return acc;
  }, {} as Record<string, typeof calculators>);

  return (
    <div className="font-sans animate-in fade-in duration-500 pb-10">
      
      {/* Header */}
      <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-gray-100 mb-6 flex flex-col md:flex-row items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-50 rounded-full opacity-50 pointer-events-none"></div>
        <div className="w-full text-right z-10">
          <h1 className="text-xl md:text-2xl font-black text-gray-800 flex items-center gap-2 mb-1.5">
            <Activity className="w-5 h-5 md:w-6 md:h-6 text-blue-600"/>
            العيادة الذكية <span className="text-[10px] md:text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded-lg">الحاسبات</span>
          </h1>
          <p className="text-[10px] md:text-xs font-bold text-gray-500">أدوات طبية سريعة للمساعدة في التشخيص</p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-80 z-10 shrink-0">
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

      {/* Main Sections */}
      {Object.keys(groupedCalculators).length > 0 ? (
        <div className="space-y-6">
          {Object.keys(groupedCalculators).map(categoryKey => (
            <div key={categoryKey}>
              {/* عنوان القسم */}
              <h2 className="text-sm md:text-base font-black text-gray-700 mb-3 border-b border-gray-200 pb-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                {categoriesMap[categoryKey] || 'أخرى'}
              </h2>

              {/* الكروت المعروضة كـ Grid */}
              {/* الموبايل: عمودين (grid-cols-2)، الكمبيوتر: 3 أو 4 أعمدة */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 md:gap-4">
                {groupedCalculators[categoryKey].map((calc, idx) => {
                  const Icon = calc.icon;
                  const isComingSoon = calc.id === 'cvd-risk';
                  
                  return (
                    <button 
                      key={idx} 
                      onClick={() => handleOpenCalculator(calc.id)} 
                      className="group h-full text-right outline-none w-full"
                    >
                      <div className={`bg-white p-3 md:p-5 rounded-2xl md:rounded-[2rem] border shadow-sm hover:shadow-md transition-all duration-300 h-full flex flex-col ${isComingSoon ? 'border-gray-100 opacity-60' : 'border-transparent hover:border-blue-100 hover:-translate-y-1'}`}>
                        
                        <div className="flex items-center gap-2.5 mb-2 md:mb-3">
                          <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center shrink-0 border ${calc.color}`}>
                            <Icon className="w-4 h-4 md:w-5 md:h-5" />
                          </div>
                          <h3 className="text-[11px] md:text-sm font-black text-gray-800 group-hover:text-blue-600 transition-colors line-clamp-2 leading-tight">
                            {calc.title}
                          </h3>
                        </div>
                        
                        <p className="text-[9px] md:text-xs font-bold text-gray-500 leading-relaxed mb-3 flex-1 line-clamp-2">
                          {calc.description}
                        </p>

                        <div className={`flex items-center justify-between text-[9px] md:text-[10px] font-black mt-auto pt-2.5 md:pt-3 border-t border-gray-50 transition-colors ${isComingSoon ? 'text-gray-400' : 'text-gray-400 group-hover:text-blue-600'}`}>
                          <span>{isComingSoon ? 'قريباً' : 'افتح'}</span>
                          {!isComingSoon && <ArrowRight className="w-3 h-3 mr-auto group-hover:-translate-x-1 transition-transform"/>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-[2rem] border border-gray-100">
          <Search className="w-10 h-10 text-gray-200 mx-auto mb-3"/>
          <p className="text-gray-500 font-bold text-xs md:text-sm">لا توجد حاسبات مطابقة لبحثك</p>
          <button onClick={() => setSearchTerm('')} className="text-blue-600 font-bold text-[10px] md:text-xs mt-3 bg-blue-50 px-4 py-2 rounded-xl hover:bg-blue-100 transition-colors">عرض الكل</button>
        </div>
      )}

    </div>
  );
}
