import React, { useState } from 'react';
import { ArrowRight, Save, Loader2, BookOpen, ExternalLink, Info, RefreshCw, ChevronRight } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

interface Props { onBack?: () => void; }

// ─── SVG Icon ─────────────────────────────────────────────────────────────────
const DiabetesIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
    <rect width="48" height="48" rx="14" fill="#ECFEFF"/>
    {/* Drop shape */}
    <path d="M24 10C24 10 14 22 14 28C14 33.523 18.477 38 24 38C29.523 38 34 33.523 34 28C34 22 24 10 24 10Z" fill="#A5F3FC" stroke="#06B6D4" strokeWidth="1.5" strokeLinejoin="round"/>
    {/* Glucose molecule hint */}
    <path d="M20 28H28M24 24V32" stroke="#0891B2" strokeWidth="1.8" strokeLinecap="round"/>
    <circle cx="20" cy="28" r="2" fill="#CFFAFE" stroke="#06B6D4" strokeWidth="1"/>
    <circle cx="28" cy="28" r="2" fill="#CFFAFE" stroke="#06B6D4" strokeWidth="1"/>
    <circle cx="24" cy="24" r="2" fill="#CFFAFE" stroke="#06B6D4" strokeWidth="1"/>
    <circle cx="24" cy="32" r="2" fill="#CFFAFE" stroke="#06B6D4" strokeWidth="1"/>
  </svg>
);

// ─── Questions ────────────────────────────────────────────────────────────────
const questions = [
  {
    q: 'ما هو عمرك؟',
    sub: 'الخطر يرتفع مع التقدم في العمر',
    options: [
      { t: 'أقل من 45 سنة', s: 0 },
      { t: '45 – 54 سنة', s: 2 },
      { t: '55 – 64 سنة', s: 3 },
      { t: '65 سنة فأكثر', s: 4 },
    ],
  },
  {
    q: 'ما مؤشر كتلة الجسم (BMI) تقريباً؟',
    sub: 'الوزن الزائد من أهم عوامل الخطر',
    options: [
      { t: 'أقل من 25 (وزن طبيعي)', s: 0 },
      { t: '25 – 30 (وزن زائد)', s: 1 },
      { t: 'أكثر من 30 (سمنة)', s: 3 },
    ],
  },
  {
    q: 'ما هو محيط الخصر؟',
    sub: 'رجال: طبيعي <94 سم | نساء: طبيعي <80 سم',
    options: [
      { t: 'طبيعي (رجال <94 / نساء <80 سم)', s: 0 },
      { t: 'مرتفع قليلاً (رجال 94–102 / نساء 80–88)', s: 3 },
      { t: 'مرتفع جداً (رجال >102 / نساء >88)', s: 4 },
    ],
  },
  {
    q: 'هل تمارس النشاط البدني بانتظام؟',
    sub: '30 دقيقة أو أكثر يومياً أو معظم الأيام',
    options: [
      { t: 'نعم، بانتظام', s: 0 },
      { t: 'لا، أو نادراً', s: 2 },
    ],
  },
  {
    q: 'هل تتناول الخضروات والفاكهة؟',
    sub: 'النظام الغذائي الصحي يُقلل الخطر',
    options: [
      { t: 'يومياً', s: 0 },
      { t: 'ليس كل يوم', s: 1 },
    ],
  },
  {
    q: 'هل تتناول دواءً لضغط الدم؟',
    sub: 'ارتفاع الضغط وداء السكري غالباً مترابطان',
    options: [
      { t: 'لا', s: 0 },
      { t: 'نعم', s: 2 },
    ],
  },
  {
    q: 'هل وُجد ارتفاع في سكر الدم سابقاً؟',
    sub: 'يشمل الفحوصات الروتينية أو سكر الحمل',
    options: [
      { t: 'لا', s: 0 },
      { t: 'نعم (في فحص أو أثناء الحمل)', s: 5 },
    ],
  },
  {
    q: 'هل يوجد تاريخ عائلي للسكري؟',
    sub: 'الوراثة تزيد الخطر بشكل ملحوظ',
    options: [
      { t: 'لا', s: 0 },
      { t: 'نعم — أجداد أو أعمام أو أخوال', s: 3 },
      { t: 'نعم — أب، أم، أخ، أو أخت', s: 5 },
    ],
  },
];

export default function DiabetesRiskCalculator({ onBack }: Props) {
  const [step, setStep] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(false);

  const total = scores.reduce((a, b) => a + b, 0);

  const getResult = (s: number) => {
    if (s < 7)  return { risk: 'منخفض جداً', pct: '1%',  color: 'text-green-700',  bg: 'bg-green-50 border-green-200',  tips: ['الحفاظ على وزن صحي', 'ممارسة الرياضة بانتظام', 'تناول نظام غذائي متوازن'] };
    if (s < 12) return { risk: 'منخفض',      pct: '4%',  color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',    tips: ['مراقبة الوزن سنوياً', 'تجنب المشروبات السكرية', 'فحص سكر كل 3 سنوات'] };
    if (s < 15) return { risk: 'متوسط',       pct: '17%', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', tips: ['فحص سكر الدم سنوياً', 'تخفيض الوزن إن وُجد زيادة', 'استشارة الطبيب'] };
    if (s < 21) return { risk: 'مرتفع',       pct: '33%', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', tips: ['فحص HbA1c فوري', 'استشارة الطبيب في أقرب وقت', 'تغيير نمط الحياة الفوري'] };
    return              { risk: 'مرتفع جداً', pct: '50%', color: 'text-red-700',   bg: 'bg-red-50 border-red-200',      tips: ['فحص سكر الدم الصائم فوراً', 'مراجعة طبيب متخصص (Endocrinologist)', 'قد تحتاج لبدء تدخل دوائي'] };
  };

  const handleSelect = (score: number) => {
    const newScores = [...scores, score];
    setScores(newScores);
    if (step < questions.length - 1) setStep(step + 1);
    else setFinished(true);
  };

  const reset = () => { setStep(0); setScores([]); setFinished(false); };

  const saveResult = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول أولاً');
      const res = getResult(total);
      await supabase.from('saved_calculations').insert({
        user_id: user.id, title: 'مخاطر السكري (FINDRISC)',
        result: `${total} نقطة — ${res.risk} (${res.pct})`,
        input_data: { total }
      });
      toast.success('تم حفظ النتيجة ✅');
    } catch (err: any) { toast.error(err.message); } finally { setLoading(false); }
  };

  const progress = (step / questions.length) * 100;
  const q = questions[step];
  const res = getResult(total);

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 duration-300 pb-10">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-5">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50"><ArrowRight className="w-5 h-5 text-gray-600" /></button>}
        <div className="flex items-center gap-3">
          <DiabetesIcon />
          <div>
            <h2 className="text-xl font-black text-gray-800">حاسبة مخاطر السكري</h2>
            <p className="text-xs text-gray-400 font-semibold">FINDRISC Score</p>
          </div>
        </div>
      </div>

      {/* ── Info ── */}
      <div className="bg-cyan-50 p-4 rounded-2xl border border-cyan-100 mb-5 flex gap-3 text-cyan-800">
        <Info className="w-5 h-5 shrink-0 mt-0.5 text-cyan-400" />
        <div className="text-xs leading-relaxed">
          <p className="font-bold mb-1">ما هو مقياس FINDRISC؟</p>
          <p>Finnish Diabetes Risk Score — أداة فحص معتمدة من IDF وESC لتحديد احتمالية الإصابة بداء السكري من النوع الثاني خلال 10 سنوات، بدون أي فحوصات مخبرية.</p>
        </div>
      </div>

      {!finished ? (
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
          {/* Progress */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black text-cyan-600 bg-cyan-50 px-2.5 py-1 rounded-full">سؤال {step + 1} من {questions.length}</span>
              <span className="text-[10px] text-gray-400 font-bold">{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div className="bg-cyan-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <h2 className="text-lg font-black text-gray-800 mb-1 leading-snug">{q.q}</h2>
          <p className="text-[11px] text-gray-400 font-semibold mb-5">{q.sub}</p>

          <div className="space-y-2.5">
            {q.options.map((opt, i) => (
              <button key={i} onClick={() => handleSelect(opt.s)}
                className="w-full py-4 px-5 rounded-2xl border-2 border-gray-100 hover:border-cyan-400 hover:bg-cyan-50 text-gray-700 font-bold text-sm transition-all text-right flex items-center justify-between group active:scale-95">
                <span>{opt.t}</span>
                <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-cyan-500" />
              </button>
            ))}
          </div>

          {step > 0 && (
            <button onClick={() => { setStep(step - 1); setScores(scores.slice(0, -1)); }}
              className="mt-4 w-full text-center text-xs text-gray-400 font-bold hover:text-gray-600">
              ← العودة للسؤال السابق
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4 animate-in slide-in-from-bottom-4">
          {/* Result card */}
          <div className={`p-8 rounded-[2rem] text-center border-2 ${res.bg}`}>
            <p className="text-xs text-gray-400 font-bold mb-1">إجمالي النقاط</p>
            <div className={`text-6xl font-black mb-1 ${res.color}`}>{total}</div>
            <p className="text-xs text-gray-400 font-bold mb-3">من أصل 26 نقطة</p>

            {/* Risk bar */}
            <div className="flex rounded-full overflow-hidden h-2.5 mb-4 bg-gray-100">
              {[
                { w: '27%', c: '#22C55E' }, { w: '19%', c: '#3B82F6' },
                { w: '12%', c: '#EAB308' }, { w: '23%', c: '#F97316' }, { w: '19%', c: '#EF4444' }
              ].map((seg, i) => <div key={i} style={{ width: seg.w, backgroundColor: seg.c }} />)}
            </div>

            <span className={`text-base font-black px-5 py-2 rounded-xl bg-white/60 inline-block ${res.color}`}>{res.risk}</span>
            <p className="text-xs text-gray-500 font-bold mt-2">احتمالية الإصابة خلال 10 سنوات: <span className={`font-black ${res.color}`}>{res.pct}</span></p>
          </div>

          {/* Tips */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100">
            <p className="text-xs font-black text-gray-600 mb-3">💡 التوصيات الوقائية:</p>
            {res.tips.map((tip, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-gray-700 font-semibold mb-2">
                <span className="text-cyan-400 font-black mt-0.5">✓</span><span>{tip}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button onClick={saveResult} disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 text-sm bg-white px-5 py-3.5 rounded-xl font-bold text-gray-800 shadow-sm border hover:bg-gray-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ
            </button>
            <button onClick={reset}
              className="flex-1 flex items-center justify-center gap-2 text-sm text-cyan-600 font-bold py-3.5 bg-cyan-50 rounded-xl border border-cyan-100 hover:bg-cyan-100">
              <RefreshCw className="w-4 h-4" /> إعادة
            </button>
          </div>
        </div>
      )}

      {/* ── Sources ── */}
      <div className="mt-6 p-4 bg-gray-50 rounded-2xl border border-gray-100">
        <p className="flex items-center gap-1.5 text-xs font-black text-gray-600 mb-3"><BookOpen className="w-3.5 h-3.5"/> المصادر العلمية</p>
        <div className="space-y-2">
          {[
            { title: 'Lindström J & Tuomilehto J — FINDRISC Validation (Diabetes Care, 2003)', url: 'https://pubmed.ncbi.nlm.nih.gov/14578226/' },
            { title: 'IDF — Diabetes Risk Screening Recommendations', url: 'https://www.idf.org/our-activities/advocacy-awareness/resources-and-tools/60:diabetes-risk-test.html' },
            { title: 'WHO — Global Report on Diabetes 2016', url: 'https://www.who.int/publications/i/item/9789241565257' },
          ].map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-[10px] text-cyan-600 font-semibold hover:underline">
              <ExternalLink className="w-3 h-3 shrink-0" />{s.title}
            </a>
          ))}
        </div>
      </div>

    </div>
  );
}
