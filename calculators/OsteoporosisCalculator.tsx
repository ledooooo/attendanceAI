import React, { useState } from 'react';
import { ArrowRight, AlertTriangle, Save, Loader2, BookOpen, ExternalLink, Info, CheckCircle2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

interface Props { onBack?: () => void; }

// ─── SVG Icon ─────────────────────────────────────────────────────────────────
const OsteoIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
    <rect width="48" height="48" rx="14" fill="#EFF6FF"/>
    {/* Femur bone */}
    <path d="M14 36C12 34 12 31 14 29L28 15C30 13 33 13 35 15C37 17 37 20 35 22L21 36C19 38 16 38 14 36Z" fill="#BFDBFE" stroke="#3B82F6" strokeWidth="1.5"/>
    {/* Cracks indicating porosity */}
    <path d="M20 30L23 27M25 25L28 22" stroke="#93C5FD" strokeWidth="1" strokeLinecap="round" opacity="0.8"/>
    <path d="M18 28L20 25" stroke="#93C5FD" strokeWidth="1" strokeLinecap="round" opacity="0.6"/>
    {/* Bone head circle */}
    <circle cx="34" cy="16" r="5" fill="#DBEAFE" stroke="#3B82F6" strokeWidth="1.3"/>
    {/* Warning triangle */}
    <path d="M7 40L12 31L17 40H7Z" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="1"/>
    <path d="M12 34V37" stroke="#D97706" strokeWidth="1.2" strokeLinecap="round"/>
    <circle cx="12" cy="39" r="0.6" fill="#D97706"/>
  </svg>
);

// ─── IOF Risk factors ─────────────────────────────────────────────────────────
const factors = [
  { id: 1,  text: 'أحد والديك أُصيب بكسر في عظمة الفخذ',                         weight: 2, category: 'عوامل وراثية' },
  { id: 2,  text: 'تعرضت لكسر بعد سقوط بسيط أو عفوي بعد سن 50',                weight: 3, category: 'تاريخ الكسور' },
  { id: 3,  text: 'تتناول الكورتيزون (Prednisone >5mg/day) لأكثر من 3 أشهر',    weight: 3, category: 'أدوية' },
  { id: 4,  text: 'تدخن حالياً',                                                   weight: 1, category: 'أسلوب حياة' },
  { id: 5,  text: 'تعاني من التهاب المفاصل الروماتويدي',                           weight: 2, category: 'أمراض مزمنة' },
  { id: 6,  text: 'تتناول الكحوليات بانتظام (3 وحدات فأكثر يومياً)',               weight: 1, category: 'أسلوب حياة' },
  { id: 7,  text: '(نساء) انقطع الطمث قبل سن 45 أو استئصال المبيضين',            weight: 2, category: 'هرمونات' },
  { id: 8,  text: '(رجال) نقص هرمون التستوستيرون',                                weight: 2, category: 'هرمونات' },
  { id: 9,  text: 'مؤشر كتلة الجسم أقل من 19 (نحافة شديدة)',                     weight: 2, category: 'جسم' },
  { id: 10, text: 'قلة الحركة وعدم ممارسة الرياضة بشكل منتظم',                   weight: 1, category: 'أسلوب حياة' },
  { id: 11, text: 'نقص واضح في الكالسيوم أو فيتامين D',                          weight: 1, category: 'تغذية' },
  { id: 12, text: 'تعاني من السيلياك أو أمراض سوء الامتصاص',                     weight: 2, category: 'أمراض مزمنة' },
];

const categoryColor: Record<string, string> = {
  'عوامل وراثية': 'bg-purple-100 text-purple-700',
  'تاريخ الكسور': 'bg-red-100 text-red-700',
  'أدوية': 'bg-orange-100 text-orange-700',
  'أسلوب حياة': 'bg-yellow-100 text-yellow-700',
  'أمراض مزمنة': 'bg-blue-100 text-blue-700',
  'هرمونات': 'bg-pink-100 text-pink-700',
  'جسم': 'bg-green-100 text-green-700',
  'تغذية': 'bg-teal-100 text-teal-700',
};

export default function OsteoporosisCalculator({ onBack }: Props) {
  const [checks, setChecks] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const toggle = (id: number) => {
    setChecks(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
    setIsSaved(false);
  };

  const weightedScore = checks.reduce((sum, id) => {
    const f = factors.find(f => f.id === id);
    return sum + (f?.weight ?? 0);
  }, 0);

  const getRisk = () => {
    if (checks.length === 0)    return { level: 'لا توجد عوامل خطر', color: 'text-green-700', bg: 'bg-green-50 border-green-200', tip: 'واصل نمط حياتك الصحي، وتناول الكالسيوم وفيتامين D بشكل كافٍ.' };
    if (weightedScore <= 2)     return { level: 'خطر منخفض',         color: 'text-blue-700',  bg: 'bg-blue-50 border-blue-200',   tip: 'يُنصح بمتابعة سنوية وتحسين نمط الحياة. فحص كثافة العظام اختياري.' };
    if (weightedScore <= 5)     return { level: 'خطر متوسط',          color: 'text-orange-600',bg: 'bg-orange-50 border-orange-200',tip: 'يُنصح بفحص كثافة العظام (DEXA) ومراجعة الطبيب لتقييم الحاجة للعلاج الوقائي.' };
    return                             { level: 'خطر مرتفع',           color: 'text-red-700',   bg: 'bg-red-50 border-red-200',     tip: 'يستوجب فحص DEXA وإحالة لمتخصص. قد يحتاج علاجاً دوائياً (Bisphosphonates، كالسيوم+D3).' };
  };

  const risk = getRisk();

  const saveResult = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول أولاً');
      await supabase.from('saved_calculations').insert({
        user_id: user.id, title: 'مخاطر هشاشة العظام (IOF)',
        result: `${checks.length} عوامل خطر — ${risk.level}`,
        input_data: { riskFactorsCount: checks.length, weightedScore }
      });
      toast.success('تم الحفظ ✅');
      setIsSaved(true);
    } catch (err: any) { toast.error(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 duration-300 pb-10">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-5">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50"><ArrowRight className="w-5 h-5 text-gray-600" /></button>}
        <div className="flex items-center gap-3">
          <OsteoIcon />
          <div>
            <h2 className="text-xl font-black text-gray-800">مخاطر هشاشة العظام</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100">للأطباء فقط ⚕️</span>
              <span className="text-xs text-gray-400 font-semibold">IOF Risk Factors</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Info ── */}
      <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 mb-5 flex gap-3 text-blue-800">
        <Info className="w-5 h-5 shrink-0 mt-0.5 text-blue-400" />
        <div className="text-xs leading-relaxed">
          <p className="font-bold mb-1">اختبار IOF لعوامل خطر الهشاشة</p>
          <p>وضعته International Osteoporosis Foundation كأداة أولية للكشف المبكر. وجود عامل واحد أو أكثر يستدعي تقييماً أعمق بفحص كثافة العظام (DEXA).</p>
        </div>
      </div>

      {/* ── Factors ── */}
      <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-gray-100">
        <p className="text-xs font-black text-gray-500 mb-4">حدد كل عامل ينطبق عليك:</p>

        <div className="space-y-2 mb-5">
          {factors.map(f => (
            <label key={f.id} onClick={() => toggle(f.id)}
              className={`flex items-start gap-3 p-3.5 border-2 rounded-xl cursor-pointer transition-all ${checks.includes(f.id) ? 'border-blue-400 bg-blue-50' : 'border-gray-100 hover:bg-gray-50'}`}>
              <input type="checkbox" checked={checks.includes(f.id)} onChange={() => {}} className="w-5 h-5 accent-blue-500 shrink-0 mt-0.5 pointer-events-none" />
              <div className="flex-1">
                <p className={`font-bold text-xs leading-relaxed ${checks.includes(f.id) ? 'text-blue-800' : 'text-gray-700'}`}>{f.text}</p>
              </div>
              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full shrink-0 mt-0.5 ${categoryColor[f.category]}`}>{f.category}</span>
            </label>
          ))}
        </div>

        {/* Result */}
        <div className={`p-5 rounded-2xl border-2 transition-all ${risk.bg}`}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] text-gray-400 font-bold mb-0.5">التقييم</p>
              <p className={`font-black text-sm ${risk.color}`}>{risk.level}</p>
            </div>
            <div className="text-left">
              <p className="text-[9px] text-gray-400 font-bold">عوامل الخطر</p>
              <p className={`text-3xl font-black ${risk.color}`}>{checks.length}</p>
            </div>
          </div>

          {checks.length > 0 && (
            <p className="text-xs text-gray-600 bg-white/60 p-3 rounded-xl font-semibold leading-relaxed">{risk.tip}</p>
          )}

          {checks.length === 0 && (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <p className="text-green-700 font-bold text-xs">{risk.tip}</p>
            </div>
          )}
        </div>

        {/* Prevention tips */}
        <div className="mt-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
          <p className="text-xs font-black text-gray-600 mb-2">🛡️ الوقاية من هشاشة العظام</p>
          {[
            'كالسيوم: 1000–1200 مجم/يوم من الطعام أو المكملات',
            'فيتامين D3: 800–2000 وحدة يومياً (حسب مستوى الدم)',
            'تمارين تحمّل الثقل (مشي، وزن): 30 دقيقة 3 مرات/أسبوع',
            'الإقلاع عن التدخين وتجنب الكحول',
          ].map((t, i) => (
            <p key={i} className="text-[10px] text-gray-600 font-semibold mb-1.5">✓ {t}</p>
          ))}
        </div>

        <button onClick={saveResult} disabled={loading || isSaved}
          className={`mt-4 w-full flex items-center justify-center gap-2 text-sm px-5 py-3.5 rounded-xl font-bold transition-all active:scale-95 ${isSaved ? 'bg-green-100 text-green-700 cursor-not-allowed' : 'bg-gray-800 text-white hover:bg-gray-900'}`}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isSaved ? 'تم الحفظ ✅' : 'حفظ النتيجة'}
        </button>
      </div>

      {/* ── Sources ── */}
      <div className="mt-6 p-4 bg-gray-50 rounded-2xl border border-gray-100">
        <p className="flex items-center gap-1.5 text-xs font-black text-gray-600 mb-3"><BookOpen className="w-3.5 h-3.5"/> المصادر العلمية</p>
        <div className="space-y-2">
          {[
            { title: 'IOF — One-Minute Osteoporosis Risk Test', url: 'https://www.osteoporosis.foundation/patients/risk-factors' },
            { title: 'AACE/ACE — Osteoporosis Clinical Practice Guidelines 2020', url: 'https://www.aace.com/disease-state-resources/bone-and-parathyroid/clinical-practice-guidelines/osteoporosis' },
            { title: 'NOF — Clinician\'s Guide to Prevention & Treatment', url: 'https://www.nof.org/patients/treatment/clinicians-guide-to-prevention-and-treatment-of-osteoporosis/' },
          ].map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-[10px] text-blue-600 font-semibold hover:underline">
              <ExternalLink className="w-3 h-3 shrink-0" />{s.title}
            </a>
          ))}
        </div>
      </div>

    </div>
  );
}
