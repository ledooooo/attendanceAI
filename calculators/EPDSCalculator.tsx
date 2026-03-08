import React, { useState } from 'react';
import { ArrowRight, BookOpen, ExternalLink, Info, AlertTriangle, ChevronRight } from 'lucide-react';

interface Props { onBack?: () => void; }

// ─── SVG Icon ─────────────────────────────────────────────────────────────────
const EPDSIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
    <rect width="48" height="48" rx="14" fill="#FAF5FF"/>
    {/* Mother silhouette simplified */}
    <circle cx="24" cy="16" r="6" fill="#DDD6FE" stroke="#7C3AED" strokeWidth="1.5"/>
    <path d="M14 36C14 30.477 18.477 26 24 26C29.523 26 34 30.477 34 36" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round"/>
    {/* Baby */}
    <circle cx="32" cy="28" r="3.5" fill="#EDE9FE" stroke="#8B5CF6" strokeWidth="1.2"/>
    {/* Heart */}
    <path d="M21 19C21 19 19 17 17.5 18.5C16 20 18 22 21 24C24 22 26 20 24.5 18.5C23 17 21 19 21 19Z" fill="#C4B5FD" stroke="#7C3AED" strokeWidth="0.8"/>
  </svg>
);

// ─── Questions data ───────────────────────────────────────────────────────────
const questions = [
  {
    text: 'لقد كنتُ قادرة على الضحك ورؤية الجانب المُبهج في الأشياء',
    options: ['كما كنت دائماً', 'أقل مما اعتدت', 'أقل بكثير مما اعتدت', 'لم أستطع إطلاقاً'],
    reverse: false,
  },
  {
    text: 'تطلعتُ إلى المستقبل باستمتاع للأشياء القادمة',
    options: ['كما كنت دائماً', 'أقل قليلاً مما اعتدت', 'أقل بكثير مما اعتدت', 'بالكاد أبداً'],
    reverse: false,
  },
  {
    text: 'لمتُ نفسي بلا مبرر عندما تسوء الأمور',
    options: ['لا، أبداً', 'نادراً ما حدث ذلك', 'نعم، أحياناً', 'نعم، في أغلب الأحيان'],
    reverse: true,
  },
  {
    text: 'شعرتُ بالقلق أو الانزعاج بدون سبب واضح',
    options: ['لا، إطلاقاً', 'نادراً جداً', 'نعم، أحياناً', 'نعم، كثيراً جداً'],
    reverse: true,
  },
  {
    text: 'شعرتُ بالخوف أو الذعر بدون سبب وجيه',
    options: ['لا، إطلاقاً', 'نادراً جداً', 'نعم، أحياناً', 'نعم، كثيراً جداً'],
    reverse: true,
  },
  {
    text: 'شعرتُ أن الأمور تتراكم وتثقل كاهلي',
    options: ['لا، تعاملتُ معها جيداً', 'لا، نجحتُ في معظم الأوقات', 'نعم، أحياناً لم أتعامل معها كالمعتاد', 'نعم، لم أستطع التعامل معها إطلاقاً'],
    reverse: true,
  },
  {
    text: 'كنتُ غير سعيدة لدرجة صعوبة النوم',
    options: ['لا، إطلاقاً', 'نادراً جداً', 'نعم، أحياناً', 'نعم، معظم الوقت'],
    reverse: true,
  },
  {
    text: 'شعرتُ بالحزن أو البؤس',
    options: ['لا، إطلاقاً', 'نادراً جداً', 'نعم، كثيراً', 'نعم، معظم الوقت'],
    reverse: true,
  },
  {
    text: 'كنتُ غير سعيدة لدرجة جعلتني أبكي',
    options: ['لا، إطلاقاً', 'نادراً جداً', 'نعم، كثيراً', 'نعم، معظم الوقت'],
    reverse: true,
  },
  {
    text: 'طرأتْ عليَّ فكرة إيذاء نفسي',
    options: ['لا، أبداً', 'نادراً ما حدث ذلك', 'أحياناً', 'نعم، كثيراً'],
    reverse: true,
    isCritical: true,
  },
];

export default function EPDSCalculator({ onBack }: Props) {
  const [answers, setAnswers] = useState<(number | null)[]>(new Array(10).fill(null));
  const [currentQ, setCurrentQ] = useState(0);
  const [showResult, setShowResult] = useState(false);

  const setAnswer = (qIdx: number, val: number) => {
    const updated = [...answers];
    updated[qIdx] = val;
    setAnswers(updated);
  };

  const totalScore = answers.reduce<number>((sum, a) => sum + (a ?? 0), 0);
  const allAnswered = answers.every(a => a !== null);
  const selfHarmAnswer = answers[9];
  const hasSelfHarmConcern = selfHarmAnswer !== null && selfHarmAnswer > 0;

  const getResult = () => {
    if (totalScore >= 13) return { label: 'احتمالية مرتفعة لاكتئاب ما بعد الولادة', color: 'text-red-700', bg: 'bg-red-50 border-red-200', action: 'يستوجب تقييماً نفسياً متخصصاً في أقرب وقت.' };
    if (totalScore >= 10) return { label: 'خطر متوسط — يتطلب متابعة', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', action: 'يُنصح بمتابعة مع الطبيب المشرف خلال أسبوع.' };
    return { label: 'حالة مستقرة (خطر منخفض)', color: 'text-green-700', bg: 'bg-green-50 border-green-200', action: 'استمري بالمتابعة المنتظمة مع فريق رعاية الأمومة.' };
  };

  const q = questions[currentQ];
  const progress = ((currentQ) / questions.length) * 100;

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 pb-10 text-right" dir="rtl">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-5">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border"><ArrowRight className="w-5 h-5" /></button>}
        <div className="flex items-center gap-3">
          <EPDSIcon />
          <div>
            <h2 className="text-xl font-black text-gray-800">مقياس إدنبرة (EPDS)</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-bold bg-purple-50 text-purple-600 px-2 py-0.5 rounded border border-purple-100">للصحة النفسية ⚕️</span>
              <span className="text-xs text-gray-400 font-semibold">اكتئاب ما بعد الولادة</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Info ── */}
      <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100 mb-5 flex gap-3 text-purple-800">
        <Info className="w-5 h-5 shrink-0 mt-0.5 text-purple-400" />
        <div className="text-xs leading-relaxed">
          <p className="font-bold mb-1">ما هو مقياس EPDS؟</p>
          <p>Edinburgh Postnatal Depression Scale — أداة فحص معتمدة عالمياً من WHO وAAP للكشف المبكر عن اكتئاب ما بعد الولادة. تُجيب عنها الأم بناءً على مشاعرها خلال الأسبوع الماضي.</p>
        </div>
      </div>

      {!showResult ? (
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border">
          {/* Progress */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black text-purple-500 bg-purple-50 px-2.5 py-1 rounded-full">سؤال {currentQ + 1} من {questions.length}</span>
              <span className="text-[10px] text-gray-400 font-bold">{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div className="bg-purple-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>

          {/* Question */}
          <p className="text-sm font-black text-gray-800 mb-5 leading-relaxed min-h-12">{q.text}</p>

          {/* Options */}
          <div className="space-y-2.5">
            {q.options.map((opt, i) => {
              const scoreVal = q.reverse ? i : (3 - i);
              const isSelected = answers[currentQ] === scoreVal;
              return (
                <button key={i} onClick={() => {
                  setAnswer(currentQ, scoreVal);
                  setTimeout(() => {
                    if (currentQ < questions.length - 1) setCurrentQ(currentQ + 1);
                    else setShowResult(true);
                  }, 200);
                }}
                  className={`w-full p-4 rounded-2xl border-2 font-bold text-xs text-right flex items-center justify-between transition-all active:scale-98 ${isSelected ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-100 hover:border-purple-200 hover:bg-purple-50/50 text-gray-700'}`}>
                  <span>{opt}</span>
                  <ChevronRight className={`w-4 h-4 ${isSelected ? 'text-purple-500' : 'text-gray-300'}`} />
                </button>
              );
            })}
          </div>

          {/* Back nav */}
          {currentQ > 0 && (
            <button onClick={() => setCurrentQ(currentQ - 1)}
              className="mt-4 w-full text-center text-xs text-gray-400 font-bold hover:text-gray-600 transition-colors">
              ← العودة للسؤال السابق
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4 animate-in slide-in-from-bottom-4">

          {/* Self-harm alert — always first if triggered */}
          {hasSelfHarmConcern && (
            <div className="p-4 rounded-2xl bg-red-50 border-2 border-red-300 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-black text-red-700 mb-1">⚠️ تنبيه مهم — أفكار إيذاء النفس</p>
                <p className="text-[11px] text-red-700 font-semibold leading-relaxed">أشارتِ إلى وجود أفكار قد تكون مؤلمة. يُرجى التحدث مع طبيبك أو أحد أفراد العائلة الموثوقين فوراً. أنتِ لستِ وحدكِ.</p>
              </div>
            </div>
          )}

          {/* Score result */}
          <div className={`p-6 rounded-[2rem] border-2 text-center ${getResult().bg}`}>
            <p className="text-xs font-black text-gray-400 mb-1">إجمالي النقاط</p>
            <div className={`text-5xl font-black mb-1 ${getResult().color}`}>{totalScore}</div>
            <p className="text-[10px] text-gray-400 font-bold mb-3">من أصل 30 نقطة</p>

            {/* Score bar */}
            <div className="flex rounded-full overflow-hidden h-2 mb-4 bg-gray-100">
              <div style={{ width: `${(totalScore / 30) * 100}%` }}
                className={`rounded-full transition-all ${totalScore >= 13 ? 'bg-red-500' : totalScore >= 10 ? 'bg-orange-500' : 'bg-green-500'}`} />
            </div>

            <p className={`text-sm font-black inline-block px-4 py-1.5 rounded-lg bg-white/60 mb-3 ${getResult().color}`}>{getResult().label}</p>
            <p className="text-xs text-gray-600 bg-white/50 p-3 rounded-xl font-semibold leading-relaxed">{getResult().action}</p>
          </div>

          {/* Score thresholds guide */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100">
            <p className="text-xs font-black text-gray-600 mb-3">دليل تفسير النتائج</p>
            {[
              { range: '0 – 9', label: 'خطر منخفض', color: 'text-green-600', bg: 'bg-green-50' },
              { range: '10 – 12', label: 'يتطلب متابعة', color: 'text-orange-600', bg: 'bg-orange-50' },
              { range: '13 فأكثر', label: 'يستوجب تقييماً نفسياً', color: 'text-red-600', bg: 'bg-red-50' },
            ].map((t, i) => (
              <div key={i} className={`flex items-center justify-between p-2.5 rounded-xl mb-1.5 ${t.bg}`}>
                <span className="text-xs font-bold text-gray-700">{t.label}</span>
                <span className={`text-xs font-black ${t.color}`}>{t.range}</span>
              </div>
            ))}
          </div>

          <button onClick={() => { setAnswers(new Array(10).fill(null)); setCurrentQ(0); setShowResult(false); }}
            className="w-full py-3 text-sm font-bold text-purple-600 bg-purple-50 rounded-xl border border-purple-100 hover:bg-purple-100 transition-colors">
            إعادة التقييم
          </button>
        </div>
      )}

      {/* ── Sources ── */}
      <div className="mt-6 p-4 bg-gray-50 rounded-2xl border border-gray-100">
        <p className="flex items-center gap-1.5 text-xs font-black text-gray-600 mb-3"><BookOpen className="w-3.5 h-3.5"/> المصادر العلمية</p>
        <div className="space-y-2">
          {[
            { title: 'Cox JL et al. — Original EPDS validation study (BJOG, 1987)', url: 'https://pubmed.ncbi.nlm.nih.gov/3651732/' },
            { title: 'WHO — Maternal Mental Health & Postnatal Depression', url: 'https://www.who.int/teams/mental-health-and-substance-use/promotion-prevention/maternal-mental-health' },
            { title: 'AAP — Postpartum Depression Screening Guidelines (2019)', url: 'https://publications.aap.org/pediatrics/article/143/1/e20183260/37448' },
          ].map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-[10px] text-purple-600 font-semibold hover:underline">
              <ExternalLink className="w-3 h-3 shrink-0" />{s.title}
            </a>
          ))}
        </div>
        <p className="text-[9px] text-gray-400 font-semibold mt-3 leading-relaxed">⚠️ هذا المقياس أداة فحص وليس تشخيصاً. في حال وجود أي أفكار لإيذاء النفس يجب استشارة متخصص فوراً بغض النظر عن الدرجة الإجمالية.</p>
      </div>

    </div>
  );
}
