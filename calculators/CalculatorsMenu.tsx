'use client';

import { useState, useEffect } from 'react';
import { 
  Scale, Baby, Calendar, Utensils, Brain, Heart, 
  Activity, Dna, Syringe, TrendingUp, AlertCircle, 
  Smile, Bone, Search, ArrowRight, Stethoscope, 
  Thermometer, Droplets, ShieldAlert, FileText, Eye, Footprints,
  LayoutGrid, List, History, X, ChevronRight, ChevronLeft
} from 'lucide-react';

// --- استيراد الحاسبات الحالية ---
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
import QuickPediatricDose from './QuickPediatricDose';
import ScreeningCalculator from './ScreeningCalculator';
import VaccinesSchedule from './VaccinesSchedule';

// --- استيراد الحاسبات المعتمدة الجديدة ---
import FRAXCalculator from './FRAXCalculator';
import CAMBRACalculator from './CAMBRACalculator';
import PeriodontalStaging from './PeriodontalStaging';
import DentalAgeCalc from './DentalAgeCalc';
import BeersCriteriaList from './BeersCriteriaList';
import ChildPughCalculator from './ChildPughCalculator';
import OttawaRules from './OttawaRules';
import PECARNCalculator from './PECARNCalculator';
import VisualAcuityCalc from './VisualAcuityCalc';
import EPDSCalculator from './EPDSCalculator';

// تحديد عدد السجلات في كل صفحة
const HISTORY_ITEMS_PER_PAGE = 5;

export default function CalculatorsMenu() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeCalc, setActiveCalc] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list'); // ✅ الوضع الافتراضي 'list'
  
  // حالات السجل
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  
  // بيانات وهمية للسجل (يمكنك استبدالها ببيانات من Supabase)
  const [mockHistory] = useState([
    { id: 1, calcName: 'مؤشر كتلة الجسم', result: '24.5 (وزن طبيعي)', date: '2023-10-25' },
    { id: 2, calcName: 'حاسبة التبويض', result: 'يوم التبويض: 2023-11-10', date: '2023-10-20' },
    { id: 3, calcName: 'مخاطر السكري', result: 'مخاطر منخفضة (12%)', date: '2023-09-15' },
    { id: 4, calcName: 'نسبة الهيموجلوبين', result: '13.2 g/dL', date: '2023-08-01' },
    { id: 5, calcName: 'مؤشر كتلة الجسم', result: '25.1 (زيادة طفيفة)', date: '2023-05-12' },
    { id: 6, calcName: 'حاسبة الحمل', result: 'الولادة المتوقعة: 2024-03-15', date: '2023-04-05' },
  ]);

  const categories = [
    { id: 'all', label: 'الكل' },
    { id: 'patient', label: 'للمرضى' },
    { id: 'doctor', label: 'للممارسين' },
    { id: 'general', label: 'باطنة وعامة' },
    { id: 'obgyn', label: 'نساء وتوليد' },
    { id: 'peds', label: 'أطفال وطوارئ' },
    { id: 'dental', label: 'أسنان' },
    { id: 'pharmacy', label: 'صيدلة' },
    { id: 'mental', label: 'نفسية' },
    { id: 'nutrition', label: 'تغذية' },
  ];

  const calculators = [
    // --- باطنة وعامة ---
    { id: 'frax', category: 'general', type: 'doctor', title: 'مقياس FRAX للهشاشة', description: 'حساب احتمالية الكسور خلال 10 سنوات.', icon: Bone, color: 'bg-red-50 text-red-600', isDoctorOnly: true },
    { id: 'ottawa', category: 'general', type: 'doctor', title: 'قواعد Ottawa للأشعة', description: 'الحاجة لأشعة الكاحل والركبة.', icon: Footprints, color: 'bg-red-50 text-red-600', isDoctorOnly: true },
    { id: 'centor', category: 'general', type: 'doctor', title: 'مقياس Centor', description: 'تقييم التهاب الحلق البكتيري.', icon: Stethoscope, color: 'bg-red-50 text-red-600', isDoctorOnly: true },
    { id: 'curb65', category: 'general', type: 'doctor', title: 'مقياس CURB-65', description: 'خطورة الالتهاب الرئوي المكتسب.', icon: Activity, color: 'bg-red-50 text-red-600', isDoctorOnly: true },
    { id: 'gfr', category: 'general', type: 'doctor', title: 'وظائف الكلى (CrCl)', description: 'معدل التصفية لتعديل الجرعات.', icon: Activity, color: 'bg-red-50 text-red-600', isDoctorOnly: true },
    { id: 'bmi', category: 'general', type: 'patient', title: 'مؤشر كتلة الجسم', description: 'تقييم السمنة والوزن المثالي.', icon: Scale, color: 'bg-blue-50 text-blue-600' },
    { id: 'bri', category: 'general', type: 'patient', title: 'مؤشر استدارة الجسم', description: 'مخاطر دهون الخصر.', icon: Activity, color: 'bg-cyan-50 text-cyan-600' },
    { id: 'heart-rate', category: 'general', type: 'patient', title: 'نبضات القلب', description: 'النطاقات المثالية للنبض.', icon: Heart, color: 'bg-rose-50 text-rose-600' },
    { id: 'lab-values', category: 'general', type: 'patient', title: 'دليل التحاليل', description: 'النسب الطبيعية للتحاليل.', icon: Dna, color: 'bg-indigo-50 text-indigo-600' },
    { id: 'screening', category: 'general', type: 'patient', title: 'الفحص الشامل', description: 'الفحوصات المطلوبة حسب السن.', icon: Stethoscope, color: 'bg-emerald-50 text-emerald-600' },

    // --- نساء وتوليد ---
    { id: 'epds', category: 'obgyn', type: 'patient', title: 'اكتئاب ما بعد الولادة', description: 'استبيان EPDS للاكتئاب.', icon: Smile, color: 'bg-purple-50 text-purple-600' },
    { id: 'pregnancy-calc', category: 'obgyn', type: 'patient', title: 'حاسبة الحمل', description: 'موعد الولادة وعمر الجنين.', icon: Baby, color: 'bg-pink-50 text-pink-600' },
    { id: 'ovulation', category: 'obgyn', type: 'patient', title: 'حاسبة التبويض', description: 'أيام التبويض والخصوبة.', icon: Calendar, color: 'bg-purple-50 text-purple-600' },
    { id: 'chadsvasc', category: 'obgyn', type: 'doctor', title: 'السكتة الدماغية', description: 'مقياس CHA2DS2-VASc.', icon: Heart, color: 'bg-red-50 text-red-600', isDoctorOnly: true },

    // --- أطفال وطوارئ ---
    { id: 'pecarn', category: 'peds', type: 'doctor', title: 'قاعدة PECARN', description: 'إصابات الرأس للأطفال.', icon: AlertCircle, color: 'bg-red-50 text-red-600', isDoctorOnly: true },
    { id: 'pediatric-quick', category: 'peds', type: 'patient', title: 'جرعات سريعة', description: 'حساب خافض الحرارة.', icon: Thermometer, color: 'bg-orange-50 text-orange-600' },
    { id: 'pediatric-dose', category: 'peds', type: 'doctor', title: 'الجرعات المتقدمة', description: 'حسب الوزن والتركيز.', icon: Syringe, color: 'bg-violet-50 text-violet-600' },
    { id: 'vaccines', category: 'peds', type: 'patient', title: 'جدول التطعيمات', description: 'مواعيد التطعيمات بمصر.', icon: Syringe, color: 'bg-teal-50 text-teal-600' },
    { id: 'growth-charts', category: 'peds', type: 'patient', title: 'منحنيات النمو', description: 'مقارنة نمو الطفل.', icon: TrendingUp, color: 'bg-lime-50 text-lime-600' },
    { id: 'child-development', category: 'peds', type: 'patient', title: 'تطورات الطفل', description: 'المهارات المتوقعة.', icon: Baby, color: 'bg-sky-50 text-sky-600' },

    // --- عيادة الأسنان ---
    { id: 'cambra', category: 'dental', type: 'doctor', title: 'مخاطر التسوس', description: 'نظام CAMBRA (ADA).', icon: ShieldAlert, color: 'bg-red-50 text-red-600', isDoctorOnly: true },
    { id: 'periodontal', category: 'dental', type: 'doctor', title: 'أمراض اللثة', description: 'نظام AAP لتصنيف اللثة.', icon: Activity, color: 'bg-red-50 text-red-600', isDoctorOnly: true },
    { id: 'dental-age', category: 'dental', type: 'patient', title: 'العمر السني', description: 'بناءً على بزوغ الأسنان.', icon: Baby, color: 'bg-sky-50 text-sky-600' },

    // --- الصيدلية ---
    { id: 'beers', category: 'pharmacy', type: 'doctor', title: 'معايير Beers', description: 'الأدوية الممنوعة لكبار السن.', icon: AlertCircle, color: 'bg-red-50 text-red-600', isDoctorOnly: true },
    { id: 'child-pugh', category: 'pharmacy', type: 'doctor', title: 'مقياس Child-Pugh', description: 'شدة تليف الكبد.', icon: Activity, color: 'bg-red-50 text-red-600', isDoctorOnly: true },
    { id: 'ivf', category: 'pharmacy', type: 'doctor', title: 'المحاليل الوريدية', description: 'حساب سرعة التنقيط.', icon: Droplets, color: 'bg-red-50 text-red-600', isDoctorOnly: true },
    { id: 'fib4', category: 'pharmacy', type: 'doctor', title: 'مؤشر تليف الكبد', description: 'درجة التليف (FIB-4).', icon: Activity, color: 'bg-red-50 text-red-600', isDoctorOnly: true },

    // --- مخاطر وأمراض ---
    { id: 'cvd-risk', category: 'general', type: 'patient', title: 'مخاطر القلب', description: 'احتمالية الجلطات.', icon: Heart, color: 'bg-rose-50 text-rose-700' },
    { id: 'diabetes-risk', category: 'general', type: 'patient', title: 'مخاطر السكري', description: 'احتمالية الإصابة بالسكري.', icon: Activity, color: 'bg-sky-50 text-sky-600' },
    { id: 'osteoporosis', category: 'general', type: 'patient', title: 'هشاشة العظام', description: 'عوامل خطر الكسور.', icon: Bone, color: 'bg-slate-100 text-slate-700' },

    // --- نفسية وألم ---
    { id: 'gad7', category: 'mental', type: 'patient', title: 'مقياس القلق', description: 'تقييم القلق (GAD-7).', icon: Brain, color: 'bg-teal-50 text-teal-600' },
    { id: 'phq9', category: 'mental', type: 'patient', title: 'استبيان الاكتئاب', description: 'التقييم النفسي (PHQ-9).', icon: Smile, color: 'bg-indigo-50 text-indigo-600' },
    { id: 'pain-scale', category: 'mental', type: 'patient', title: 'مقياس الألم', description: 'حدة الألم السريري.', icon: AlertCircle, color: 'bg-red-50 text-red-600' },

    // --- تغذية وتخصصات أخرى ---
    { id: 'food-calories', category: 'nutrition', type: 'patient', title: 'دليل السعرات', description: 'سعرات الأكلات المصرية.', icon: FileText, color: 'bg-yellow-50 text-yellow-600' },
    { id: 'visual-conv', category: 'general', type: 'doctor', title: 'تحويل حدة الإبصار', description: 'مقاييس Snellen و LogMAR.', icon: Eye, color: 'bg-indigo-50 text-indigo-600', isDoctorOnly: true },
  ];

  const filteredCalculators = calculators.filter(calc => {
    const matchesSearch = calc.title.includes(searchTerm) || calc.description.includes(searchTerm);
    let matchesCategory = true;
    if (activeCategory === 'patient') matchesCategory = calc.type === 'patient';
    else if (activeCategory === 'doctor') matchesCategory = calc.type === 'doctor';
    else if (activeCategory !== 'all') matchesCategory = calc.category === activeCategory;
    
    return matchesSearch && matchesCategory;
  });

  const handleBack = () => setActiveCalc(null);

  // حسابات Pagination للسجل
  const totalHistoryPages = Math.ceil(mockHistory.length / HISTORY_ITEMS_PER_PAGE);
  const startHistoryIndex = (historyPage - 1) * HISTORY_ITEMS_PER_PAGE;
  const paginatedHistory = mockHistory.slice(startHistoryIndex, startHistoryIndex + HISTORY_ITEMS_PER_PAGE);

  // --- منطق عرض الحاسبات الفردية ---
  if (activeCalc === 'bmi') return <BMICalculator onBack={handleBack} />;
  if (activeCalc === 'bri') return <BRICalculator onBack={handleBack} />;
  if (activeCalc === 'ivf') return <IVFCalculator onBack={handleBack} />;
  if (activeCalc === 'pregnancy-calc') return <PregnancyCalculator onBack={handleBack} />;
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
  if (activeCalc === 'frax') return <FRAXCalculator onBack={handleBack} />;
  if (activeCalc === 'cambra') return <CAMBRACalculator onBack={handleBack} />;
  if (activeCalc === 'periodontal') return <PeriodontalStaging onBack={handleBack} />;
  if (activeCalc === 'dental-age') return <DentalAgeCalc onBack={handleBack} />;
  if (activeCalc === 'beers') return <BeersCriteriaList onBack={handleBack} />;
  if (activeCalc === 'child-pugh') return <ChildPughCalculator onBack={handleBack} />;
  if (activeCalc === 'ottawa') return <OttawaRules onBack={handleBack} />;
  if (activeCalc === 'pecarn') return <PECARNCalculator onBack={handleBack} />;
  if (activeCalc === 'visual-conv') return <VisualAcuityCalc onBack={handleBack} />;
  if (activeCalc === 'epds') return <EPDSCalculator onBack={handleBack} />;

  return (
    <div className="font-sans animate-in fade-in duration-500 pb-10 px-1 text-right relative" dir="rtl">
      
      {/* Header */}
      <div className="bg-white rounded-3xl p-4 md:p-5 shadow-sm border border-gray-100 mb-4 flex flex-col md:flex-row items-center justify-between gap-4 relative overflow-hidden">
        <div className="w-full flex justify-between items-center z-10 flex-shrink-0">
          <div>
            <h1 className="text-lg md:text-2xl font-black text-gray-800 flex items-center gap-2 mb-1">
              <Activity className="w-5 h-5 md:w-6 md:h-6 text-blue-600"/>
              العيادة الذكية <span className="text-[9px] md:text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded-lg">الحاسبات</span>
            </h1>
            <p className="text-[10px] md:text-xs font-bold text-gray-500">أدوات طبية منظمة حسب التخصص</p>
          </div>
          
          {/* ✅ زر سجل الحسابات */}
          <button 
            onClick={() => setShowHistoryModal(true)}
            className="flex items-center gap-1.5 text-xs font-bold bg-gray-100 text-gray-700 px-3 py-2 rounded-xl hover:bg-gray-200 transition-colors"
          >
            <History size={16} /> السجل
          </button>
        </div>
        
        {/* شريط البحث + أزرار التبديل */}
        <div className="flex items-center gap-2 relative w-full md:w-auto z-10 flex-1 md:flex-none">
          <div className="relative flex-1 md:w-64 lg:w-80">
            <Search className="absolute right-3.5 top-3 text-gray-400 w-4 h-4"/>
            <input 
              type="text" 
              placeholder="ابحث عن حاسبة..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 bg-gray-50 border border-gray-100 focus:bg-white focus:border-blue-500 rounded-xl outline-none transition-all font-bold text-gray-700 text-xs md:text-sm"
            />
          </div>
          <div className="flex bg-gray-100 p-1 rounded-xl shrink-0">
            <button 
              onClick={() => setViewMode('grid')} 
              className={`p-1.5 md:p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
              title="عرض شبكي"
            >
              <LayoutGrid size={16} />
            </button>
            <button 
              onClick={() => setViewMode('list')} 
              className={`p-1.5 md:p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
              title="عرض قائمة مضغوطة"
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-2 pb-3 mb-4 no-scrollbar scroll-smooth">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border-2 flex-shrink-0 ${
              activeCategory === cat.id
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-white text-gray-600 border-gray-100 hover:border-gray-200'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Grid / List Display */}
      <div className={viewMode === 'grid' ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3" : "flex flex-col gap-2"}>
        {filteredCalculators.map((calc, idx) => {
          const Icon = calc.icon;
          return (
            <button 
              key={idx} 
              onClick={() => setActiveCalc(calc.id)} 
              className="group text-right outline-none w-full relative"
            >
              <div className={`
                bg-white rounded-2xl border-2 transition-all duration-300 w-full overflow-hidden
                ${calc.isDoctorOnly ? 'border-red-100 bg-red-50/20 hover:border-red-300' : 'border-transparent shadow-sm hover:border-blue-100 hover:shadow-md'}
                ${viewMode === 'grid' ? 'flex flex-col p-3 md:p-5 h-full' : 'flex flex-row items-center p-2.5 md:p-3 gap-3 h-auto'}
              `}>
                
                {/* Icon */}
                <div className={`
                  shrink-0 flex items-center justify-center rounded-xl border ${calc.color}
                  ${viewMode === 'grid' ? 'w-8 h-8 md:w-10 md:h-10 mb-2' : 'w-10 h-10 shadow-sm'}
                `}>
                  <Icon className={viewMode === 'grid' ? 'w-4 h-4 md:w-5 md:h-5' : 'w-5 h-5'} />
                </div>
                
                {/* Content */}
                <div className={`flex flex-1 min-w-0 ${viewMode === 'grid' ? 'flex-col h-full' : 'items-center justify-between gap-2'}`}>
                  
                  <div className={`flex flex-col min-w-0 ${viewMode === 'grid' ? '' : 'flex-1'}`}>
                    <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                      <h3 className={`text-[11px] md:text-sm font-black truncate leading-tight ${calc.isDoctorOnly ? 'text-red-900' : 'text-gray-800 group-hover:text-blue-600'}`}>
                        {calc.title}
                      </h3>
                      {calc.isDoctorOnly && (
                        <span className="bg-red-600 text-white text-[7px] md:text-[8px] px-1.5 py-0.5 rounded-md font-bold flex items-center gap-0.5 shrink-0">
                          <ShieldAlert size={8} /> {viewMode === 'grid' ? 'طبي ⚕️' : 'طبي'}
                        </span>
                      )}
                    </div>
                    <p className={`text-[9px] md:text-xs font-bold text-gray-400 ${viewMode === 'grid' ? 'leading-relaxed mb-3 flex-1 line-clamp-2' : 'truncate'}`}>
                      {calc.description}
                    </p>
                  </div>

                  {/* Action Area / Arrow */}
                  <div className={`flex items-center font-black ${calc.isDoctorOnly ? 'text-red-600' : 'text-gray-400 group-hover:text-blue-600'}
                    ${viewMode === 'grid' ? 'text-[9px] md:text-[10px] mt-auto pt-2.5 border-t border-gray-50 justify-between w-full' : 'shrink-0 pl-1'}
                  `}>
                    {viewMode === 'grid' && <span>{calc.isDoctorOnly ? 'للممارس الصحي' : 'افتح الأداة'}</span>}
                    <ArrowRight className={`w-4 h-4 transition-transform ${viewMode === 'grid' ? 'group-hover:-translate-x-1' : 'group-hover:-translate-x-1 opacity-50 group-hover:opacity-100'}`} />
                  </div>

                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ✅ Modal السجل */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95">
            {/* رأس النافذة */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50/50">
              <h3 className="font-black text-gray-800 flex items-center gap-2 text-lg">
                <History className="text-blue-500" /> سجل القياسات
              </h3>
              <button onClick={() => setShowHistoryModal(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>
            
            {/* المحتوى */}
            <div className="p-5 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
               {paginatedHistory.map((item) => (
                 <div key={item.id} className="p-4 border border-gray-100 rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-center mb-2 border-b border-gray-50 pb-2">
                        <span className="text-xs font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">{item.calcName}</span>
                        <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-md" dir="ltr">{item.date}</span>
                    </div>
                    <p className="text-sm font-bold text-gray-700 leading-relaxed">{item.result}</p>
                 </div>
               ))}
            </div>

            {/* Pagination داخل السجل */}
            {totalHistoryPages > 1 && (
                <div className="flex items-center justify-between border-t border-gray-100 p-4 bg-gray-50/50">
                    <p className="text-xs font-bold text-gray-500">
                        صفحة {historyPage} من {totalHistoryPages}
                    </p>
                    <div className="flex gap-2">
                        <button onClick={() => setHistoryPage(p => Math.max(1, p - 1))} disabled={historyPage === 1} className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed">
                            <ChevronRight size={16} />
                        </button>
                        <button onClick={() => setHistoryPage(p => Math.min(totalHistoryPages, p + 1))} disabled={historyPage === totalHistoryPages} className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed">
                            <ChevronLeft size={16} />
                        </button>
                    </div>
                </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
