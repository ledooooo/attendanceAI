import React, { useState } from 'react';
import { 
  Scale, Baby, Calendar, Utensils, Brain, Heart, 
  Activity, Dna, Syringe, TrendingUp, AlertCircle, 
  Smile, Bone, Search, ArrowRight, Stethoscope, 
  Thermometer, FileText, Droplet
} from 'lucide-react';
import toast from 'react-hot-toast';

// --- استيراد جميع الحاسبات التي تم برمجتها ---
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

export default function CalculatorsMenu() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCalc, setActiveCalc] = useState<string | null>(null);

  // قائمة بجميع الحاسبات
  const calculators = [
    // --- عامة وصحة بدنية ---
    { id: 'bmi', title: 'مؤشر كتلة الجسم (BMI)', description: 'حساب الوزن المثالي وتقييم حالة السمنة أو النحافة.', icon: Scale, color: 'bg-blue-50 text-blue-600 border-blue-100' },
    { id: 'ivf', title: 'معدل المحاليل (IV Drip)', description: 'حساب سرعة تنقيط المحاليل الوريدية بدقة.', icon: Droplet, color: 'bg-cyan-50 text-cyan-600 border-cyan-100' },
    { id: 'gfr', title: 'وظائف الكلى (CrCl)', description: 'تقدير معدل تصفية الكرياتينين لتعديل الجرعات.', icon: Activity, color: 'bg-amber-50 text-amber-600 border-amber-100' },
    { id: 'heart-rate', title: 'نبضات القلب المستهدفة', description: 'نطاقات النبض المثالية لحرق الدهون واللياقة.', icon: Heart, color: 'bg-rose-50 text-rose-600 border-rose-100' },
    { id: 'lab-values', title: 'دليل التحاليل (Labs)', description: 'النسب الطبيعية لأشهر التحاليل الطبية.', icon: Dna, color: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
    { id: 'screening', title: 'الفحص الدوري الشامل', description: 'الفحوصات المطلوبة حسب السن والجنس.', icon: Stethoscope, color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },

    // --- نساء وتوليد ---
    { id: 'pregnancy', title: 'تتبع الحمل (EDD)', description: 'حساب تاريخ الولادة وعمر الحمل الحالي.', icon: Baby, color: 'bg-pink-50 text-pink-600 border-pink-100' },
    { id: 'ovulation', title: 'حاسبة التبويض والخصوبة', description: 'تحديد أيام التبويض وأفضل أوقات الخصوبة.', icon: Calendar, color: 'bg-purple-50 text-purple-600 border-purple-100' },

    // --- أطفال ---
    { id: 'pediatric-quick', title: 'جرعات الأطفال السريعة', description: 'حساب جرعات خافض الحرارة والمضادات الشائعة.', icon: Thermometer, color: 'bg-orange-50 text-orange-600 border-orange-100' },
    { id: 'pediatric-dose', title: 'حاسبة الجرعات المتقدمة', description: 'حساب دقيق لأي دواء أطفال حسب التركيز.', icon: Syringe, color: 'bg-violet-50 text-violet-600 border-violet-100' },
    { id: 'vaccines', title: 'جدول التطعيمات (مصر)', description: 'مواعيد التطعيمات الإجبارية للأطفال بوزارة الصحة.', icon: Syringe, color: 'bg-teal-50 text-teal-600 border-teal-100' },
    { id: 'growth-charts', title: 'منحنيات النمو (WHO)', description: 'مقارنة وزن طفلك بالمعدلات العالمية.', icon: TrendingUp, color: 'bg-lime-50 text-lime-600 border-lime-100' },

    // --- تغذية ---
    { id: 'food-calories', title: 'دليل السعرات المصرية', description: 'جدول سعرات لأشهر الأكلات المصرية.', icon: FileText, color: 'bg-yellow-50 text-yellow-600 border-yellow-100' },

    // --- صحة نفسية وتقييم ألم ---
    { id: 'gad7', title: 'مقياس القلق (GAD-7)', description: 'اختبار لتقييم حدة أعراض القلق والتوتر.', icon: Brain, color: 'bg-teal-50 text-teal-600 border-teal-100' },
    { id: 'phq9', title: 'استبيان الاكتئاب (PHQ-9)', description: 'أداة لتقييم الصحة النفسية وتشخيص الاكتئاب.', icon: Smile, color: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
    { id: 'pain-scale', title: 'مقياس الألم (VAS)', description: 'أداة بصرية لتقييم حدة الألم لتسهيل التشخيص.', icon: AlertCircle, color: 'bg-red-50 text-red-600 border-red-100' },

    // --- مخاطر وأمراض ---
    { id: 'diabetes-risk', title: 'مخاطر السكري (FindRisk)', description: 'تقييم احتمالية الإصابة بالسكري النوع الثاني.', icon: Activity, color: 'bg-sky-50 text-sky-600 border-sky-100' },
    { id: 'osteoporosis', title: 'مخاطر هشاشة العظام', description: 'فحص سريع لعوامل الخطر لضعف العظام.', icon: Bone, color: 'bg-blue-50 text-blue-800 border-blue-200' },
    
    // --- Coming Soon ---
    { id: 'bri', title: 'مؤشر استدارة الجسم (BRI)', description: 'المقياس الحديث الأدق لتحديد مخاطر دهون الخصر.', icon: Activity, color: 'bg-gray-100 text-gray-400 border-gray-200' },
    { id: 'child-development', title: 'تطورات الطفل', description: 'المهارات الحركية والعقلية المتوقعة حسب العمر.', icon: Baby, color: 'bg-gray-100 text-gray-400 border-gray-200' },
  ];

  const filteredCalculators = calculators.filter(calc => 
    calc.title.includes(searchTerm) || calc.description.includes(searchTerm)
  );

  const handleOpenCalculator = (id: string) => {
    // التحقق هل الحاسبة مبرمجة أم لا
    const implementedCalculators = ['bmi', 'ivf', 'pregnancy', 'pediatric-dose', 'gfr', 'diabetes-risk', 'food-calories', 'gad7', 'growth-charts', 'heart-rate', 'lab-values', 'osteoporosis', 'ovulation', 'pain-scale', 'pediatric-quick', 'phq9', 'screening', 'vaccines'];
    
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

  // === RENDER MENU ===
  return (
    <div className="font-sans animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-6 flex flex-col md:flex-row items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-50 rounded-full opacity-50 pointer-events-none"></div>
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-600"/>
            العيادة الذكية <span className="text-sm font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded-lg">الحاسبات</span>
          </h1>
          <p className="text-xs font-bold text-gray-500 mt-1">أدوات طبية سريعة للمساعدة في التشخيص والمتابعة</p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-80 z-10">
          <Search className="absolute right-4 top-3.5 text-gray-400 w-5 h-5"/>
          <input 
            type="text" 
            placeholder="ابحث عن حاسبة (مثال: حمل، سكر...)" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-11 pl-4 py-3 bg-gray-50 border border-gray-100 focus:bg-white focus:border-blue-500 rounded-2xl outline-none transition-all font-bold text-gray-700 text-sm"
          />
        </div>
      </div>

      {/* Main Grid */}
      {filteredCalculators.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredCalculators.map((calc, idx) => {
            const Icon = calc.icon;
            const isComingSoon = calc.id === 'bri' || calc.id === 'child-development' || calc.id === 'cvd-risk';
            
            return (
              <button 
                key={idx} 
                onClick={() => handleOpenCalculator(calc.id)} 
                className="group h-full text-right outline-none"
              >
                <div className={`bg-white p-5 rounded-[2rem] border-2 shadow-sm hover:shadow-md transition-all duration-300 h-full flex flex-col ${isComingSoon ? 'border-gray-100 opacity-60' : 'border-transparent hover:border-blue-100 hover:-translate-y-1'}`}>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 border ${calc.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  
                  <h3 className="text-sm font-black text-gray-800 mb-1.5 group-hover:text-blue-600 transition-colors line-clamp-1">
                    {calc.title}
                  </h3>
                  
                  <p className="text-[10px] font-bold text-gray-500 leading-relaxed mb-4 flex-1 line-clamp-2">
                    {calc.description}
                  </p>

                  <div className={`flex items-center text-[10px] font-black mt-auto pt-3 border-t border-gray-50 transition-colors ${isComingSoon ? 'text-gray-400' : 'text-gray-400 group-hover:text-blue-600'}`}>
                    <span>{isComingSoon ? 'قريباً' : 'افتح الأداة'}</span>
                    {!isComingSoon && <ArrowRight className="w-3 h-3 mr-auto group-hover:-translate-x-1 transition-transform"/>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-[2rem] border border-gray-100">
          <Search className="w-12 h-12 text-gray-200 mx-auto mb-3"/>
          <p className="text-gray-500 font-bold text-sm">لا توجد حاسبات مطابقة لبحثك</p>
          <button onClick={() => setSearchTerm('')} className="text-blue-600 font-bold text-xs mt-3 bg-blue-50 px-4 py-2 rounded-xl hover:bg-blue-100 transition-colors">عرض الكل</button>
        </div>
      )}

    </div>
  );
}
