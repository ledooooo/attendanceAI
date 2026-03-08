import React, { useState } from 'react';
import { ArrowRight, CheckSquare, Save, Loader2, BookOpen, ExternalLink, Info, AlertCircle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

interface Props { onBack?: () => void; }

// ─── SVG Icon ─────────────────────────────────────────────────────────────────
const ScreenIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
    <rect width="48" height="48" rx="14" fill="#ECFDF5"/>
    {/* Clipboard */}
    <rect x="10" y="10" width="28" height="32" rx="4" fill="#D1FAE5" stroke="#10B981" strokeWidth="1.3"/>
    <rect x="17" y="7" width="14" height="6" rx="3" fill="#A7F3D0" stroke="#10B981" strokeWidth="1.2"/>
    {/* Checklist lines */}
    <path d="M16 20L19 23L24 18" stroke="#10B981" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M27 21H33" stroke="#10B981" strokeWidth="1.2" strokeLinecap="round"/>
    <path d="M16 28L19 31L24 26" stroke="#10B981" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M27 29H33" stroke="#10B981" strokeWidth="1.2" strokeLinecap="round"/>
    <path d="M16 36H33" stroke="#A7F3D0" strokeWidth="1" strokeLinecap="round"/>
  </svg>
);

interface ScreenTest { test: string; freq: string; note: string; priority: 'high' | 'medium' | 'low'; }

const getTests = (age: number, gender: string, smoker: boolean, diabetes: boolean, familyHx: boolean): ScreenTest[] => {
  const tests: ScreenTest[] = [];

  // Universal
  tests.push({ test: 'قياس ضغط الدم', freq: 'كل 1–2 سنة', note: 'الهدف أقل من 130/80 عند أغلب البالغين', priority: 'high' });
  tests.push({ test: 'فحص الأسنان والتنظيف', freq: 'كل 6 شهور', note: 'الكشف المبكر عن تسوس ومشاكل اللثة', priority: 'medium' });
  tests.push({ test: 'فحص بصري (عين)', freq: 'كل 1–2 سنة', note: 'خاصةً عند وجود مشاكل رؤية أو مرض سكري', priority: 'medium' });

  // Lipids
  if (age >= 35 || (age >= 20 && gender === 'male') || familyHx) {
    tests.push({ test: 'صورة دهون كاملة (Lipid Profile)', freq: 'كل 5 سنوات (أو سنوياً إذا كانت مرتفعة)', note: 'LDL، HDL، Triglycerides، Cholesterol', priority: 'high' });
  }

  // Diabetes
  if (age >= 35 || diabetes || familyHx) {
    tests.push({ test: 'فحص سكر الصيام + HbA1c', freq: 'كل 3 سنوات (سنوياً لمرضى السكري)', note: 'السكر الصائم < 100، HbA1c < 5.7% طبيعي', priority: age >= 40 || diabetes ? 'high' : 'medium' });
  }

  // Colorectal
  if (age >= 45) {
    tests.push({ test: 'فحص سرطان القولون والمستقيم', freq: 'تحليل براز سنوي (FIT) أو منظار كل 10 سنوات', note: 'يبدأ عند 40–45 عند وجود تاريخ عائلي', priority: 'high' });
  }

  // Thyroid
  if (age >= 35 && gender === 'female') {
    tests.push({ test: 'فحص الغدة الدرقية (TSH)', freq: 'كل 5 سنوات', note: 'أكثر شيوعاً في النساء — اضطراب قصور شائع', priority: 'medium' });
  }

  // BMI / obesity
  tests.push({ test: 'قياس الوزن ومؤشر كتلة الجسم (BMI)', freq: 'سنوياً', note: 'الهدف 18.5–24.9 kg/m²', priority: 'medium' });

  // Mental health
  if (age >= 18 && age <= 65) {
    tests.push({ test: 'تقييم الصحة النفسية (PHQ-2/PHQ-9)', freq: 'سنوياً عند وجود أعراض', note: 'الاكتئاب شائع وقابل للعلاج', priority: 'medium' });
  }

  // Female-specific
  if (gender === 'female') {
    if (age >= 21) tests.push({ test: 'مسحة عنق الرحم (Pap Smear)', freq: 'كل 3 سنوات (مع HPV كل 5 سنوات بعد 30)', note: 'الكشف المبكر عن سرطان عنق الرحم', priority: 'high' });
    if (age >= 40) tests.push({ test: 'تصوير الثدي بالأشعة (Mammogram)', freq: 'كل 1–2 سنة بعد 40', note: 'سنوياً إذا كان هناك تاريخ عائلي', priority: 'high' });
    if (age >= 65) tests.push({ test: 'فحص كثافة العظام (DEXA Scan)', freq: 'كل 2–5 سنوات', note: 'الكشف المبكر عن هشاشة العظام', priority: 'high' });
    if (age >= 65) tests.push({ test: 'فحص بول (UTI / بروتين)', freq: 'سنوياً', note: 'الكشف عن التهابات المسالك والكلى', priority: 'medium' });
  }

  // Male-specific
  if (gender === 'male') {
    if (age >= 50 || (age >= 40 && familyHx)) {
      tests.push({ test: 'PSA لفحص البروستاتا', freq: 'سنوياً بعد مناقشة مع الطبيب', note: 'القرار يعتمد على عوامل الخطر والأعراض', priority: age >= 50 ? 'high' : 'medium' });
    }
    if (age >= 65 && smoker) {
      tests.push({ test: 'فحص تمدد الشريان الأورطي البطني (AAA Ultrasound)', freq: 'مرة واحدة', note: 'للمدخنين أو السابقين من 65–75 سنة', priority: 'high' });
    }
  }

  // Smoking-related
  if (smoker && age >= 50) {
    tests.push({ test: 'CT الصدر منخفض الجرعة للكشف عن سرطان الرئة', freq: 'سنوياً × 3 سنوات', note: 'للمدخنين 20+ pack-year من 50–80 سنة', priority: 'high' });
  }

  // Kidney
  if (age >= 40 || diabetes || familyHx) {
    tests.push({ test: 'وظائف الكلى (Creatinine + eGFR)', freq: 'كل 1–3 سنوات', note: 'مهم خاصةً عند مرضى ضغط الدم أو السكري', priority: diabetes ? 'high' : 'medium' });
  }

  // Vitamin D
  tests.push({ test: 'فيتامين D وفيتامين B12', freq: 'كل 1–2 سنة', note: 'نقصهما شائع خاصةً في منطقتنا', priority: 'low' });

  return tests;
};

export default function ScreeningCalculator({ onBack }: Props) {
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('male');
  const [smoker, setSmoker] = useState(false);
  const [diabetes, setDiabetes] = useState(false);
  const [familyHx, setFamilyHx] = useState(false);
  const [result, setResult] = useState<ScreenTest[] | null>(null);
  const [loading, setLoading] = useState(false);

  const calculate = () => {
    const a = parseInt(age);
    if (!a || a < 1 || a > 120) { toast.error('يرجى إدخال عمر صحيح'); return; }
    setResult(getTests(a, gender, smoker, diabetes, familyHx));
  };

  const saveResult = async () => {
    if (!result) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول');
      await supabase.from('saved_calculations').insert({
        user_id: user.id, title: 'الفحص الدوري الشامل',
        result: `${result.length} فحص موصى به (العمر: ${age}, ${gender === 'male' ? 'ذكر' : 'أنثى'})`,
        input_data: { age, gender, smoker, diabetes, familyHx }
      });
      toast.success('تم الحفظ ✅');
    } catch (err: any) { toast.error(err.message); } finally { setLoading(false); }
  };

  const high = result?.filter(t => t.priority === 'high') ?? [];
  const medium = result?.filter(t => t.priority === 'medium') ?? [];
  const low = result?.filter(t => t.priority === 'low') ?? [];

  const PriorityGroup = ({ tests, label, color, bg, border }: any) => tests.length > 0 && (
    <div>
      <p className={`text-[10px] font-black mb-2 px-3 py-1 rounded-lg ${bg} ${color}`}>{label}</p>
      <div className="space-y-2">
        {tests.map((t: ScreenTest, i: number) => (
          <div key={i} className={`p-3.5 rounded-xl border ${border} bg-white`}>
            <div className="flex items-start gap-2">
              <CheckSquare className="w-4 h-4 mt-0.5 shrink-0 text-emerald-500" />
              <div>
                <p className="font-bold text-xs text-gray-800">{t.test}</p>
                <p className="text-[10px] text-emerald-600 font-bold mt-0.5">🔄 {t.freq}</p>
                <p className="text-[9px] text-gray-400 font-semibold mt-0.5">{t.note}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 duration-300 pb-10">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-5">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50"><ArrowRight className="w-5 h-5 text-gray-600" /></button>}
        <div className="flex items-center gap-3">
          <ScreenIcon />
          <div>
            <h2 className="text-xl font-black text-gray-800">الفحص الدوري الشامل</h2>
            <p className="text-xs text-gray-400 font-semibold">Preventive Screening Recommendations</p>
          </div>
        </div>
      </div>

      {/* ── Info ── */}
      <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 mb-5 flex gap-3 text-emerald-800">
        <Info className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
        <p className="text-xs leading-relaxed">أدخل بياناتك للحصول على قائمة فحوصات وقائية موصى بها حسب عمرك وعوامل الخطر، استناداً لإرشادات USPSTF و AHA.</p>
      </div>

      {/* ── Form ── */}
      <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-gray-100 space-y-4">
        <div className="flex bg-gray-100 p-1.5 rounded-xl">
          <button onClick={() => setGender('male')} className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition ${gender === 'male' ? 'bg-white shadow text-emerald-600' : 'text-gray-500'}`}>👨 رجل</button>
          <button onClick={() => setGender('female')} className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition ${gender === 'female' ? 'bg-white shadow text-emerald-600' : 'text-gray-500'}`}>👩 امرأة</button>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-600 mb-1.5 block">العمر (سنة)</label>
          <input type="number" value={age} onChange={e => setAge(e.target.value)}
            className="w-full p-3.5 border bg-gray-50 focus:bg-white rounded-xl outline-none focus:border-emerald-400 font-bold"
            placeholder="مثال: 45" />
        </div>

        {/* Risk factors */}
        <div>
          <p className="text-xs font-bold text-gray-600 mb-2">عوامل الخطر (اختياري)</p>
          <div className="space-y-2">
            {[
              { state: smoker, set: setSmoker, label: '🚬 مدخن حالي أو سابق' },
              { state: diabetes, set: setDiabetes, label: '🩸 مريض سكري أو ما قبل سكري' },
              { state: familyHx, set: setFamilyHx, label: '👨‍👩‍👧 تاريخ عائلي لأمراض القلب / السرطان' },
            ].map((r, i) => (
              <label key={i} onClick={() => r.set(!r.state)}
                className={`flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition-all ${r.state ? 'border-emerald-400 bg-emerald-50' : 'border-gray-100 hover:bg-gray-50'}`}>
                <input type="checkbox" checked={r.state} onChange={() => {}} className="w-4 h-4 accent-emerald-500 pointer-events-none" />
                <span className="text-xs font-bold text-gray-700">{r.label}</span>
              </label>
            ))}
          </div>
        </div>

        <button onClick={calculate}
          className="w-full bg-emerald-600 text-white font-black py-3.5 rounded-xl hover:bg-emerald-700 shadow-md active:scale-95 transition-all">
          اعرض الفحوصات الموصى بها
        </button>
      </div>

      {/* ── Results ── */}
      {result && (
        <div className="mt-5 space-y-4 animate-in slide-in-from-bottom-4">
          <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between">
            <p className="text-sm font-black text-gray-700">إجمالي الفحوصات الموصى بها</p>
            <span className="text-2xl font-black text-emerald-600">{result.length}</span>
          </div>

          <PriorityGroup tests={high} label="🔴 أولوية عالية — مهم جداً" color="text-red-700" bg="bg-red-50" border="border-red-100" />
          <PriorityGroup tests={medium} label="🟡 أولوية متوسطة — موصى به" color="text-yellow-700" bg="bg-yellow-50" border="border-yellow-100" />
          <PriorityGroup tests={low} label="🟢 اختياري — مفيد" color="text-green-700" bg="bg-green-50" border="border-green-100" />

          <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex gap-3">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-700 font-semibold leading-relaxed">هذه القائمة استرشادية. استشر طبيبك لتحديد الأولويات حسب حالتك الصحية الفردية.</p>
          </div>

          <button onClick={saveResult} disabled={loading}
            className="w-full flex items-center justify-center gap-2 text-sm bg-gray-800 text-white px-5 py-3.5 rounded-xl font-bold hover:bg-gray-900 shadow-md">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ القائمة
          </button>
        </div>
      )}

      {/* ── Sources ── */}
      <div className="mt-5 p-4 bg-gray-50 rounded-2xl border border-gray-100">
        <p className="flex items-center gap-1.5 text-xs font-black text-gray-600 mb-3"><BookOpen className="w-3.5 h-3.5"/> المصادر العلمية</p>
        <div className="space-y-2">
          {[
            { title: 'USPSTF — Preventive Services Recommendations (2024)', url: 'https://www.uspreventiveservicestaskforce.org/uspstf/recommendation-topics/uspstf-and-b-recommendations' },
            { title: 'AHA/ACC — Cardiovascular Risk Screening Guidelines', url: 'https://www.heart.org/en/health-topics/consumer-healthcare/what-is-cardiovascular-disease/prevention' },
            { title: 'WHO — Noncommunicable Diseases Screening', url: 'https://www.who.int/news-room/fact-sheets/detail/noncommunicable-diseases' },
          ].map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-[10px] text-emerald-600 font-semibold hover:underline">
              <ExternalLink className="w-3 h-3 shrink-0" />{s.title}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
