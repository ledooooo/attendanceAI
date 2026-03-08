import React, { useState } from 'react';
import { ArrowRight, RefreshCw, AlertCircle, Save, Loader2, BookOpen, ExternalLink, Info, ChevronRight } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

interface Props { onBack?: () => void; }

// ─── SVG Icon ─────────────────────────────────────────────────────────────────
const PHQ9Icon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
    <rect width="48" height="48" rx="14" fill="#EEF2FF"/>
    {/* Brain outline */}
    <path d="M24 10C18 10 13 14.5 13 20C13 23 14.5 25.5 17 27L17 35H31V27C33.5 25.5 35 23 35 20C35 14.5 30 10 24 10Z" fill="#C7D2FE" stroke="#6366F1" strokeWidth="1.3"/>
    {/* Brain fold lines */}
    <path d="M20 16C20 16 18 18 19 21" stroke="#818CF8" strokeWidth="1" strokeLinecap="round"/>
    <path d="M28 16C28 16 30 18 29 21" stroke="#818CF8" strokeWidth="1" strokeLinecap="round"/>
    <path d="M22 22C22 22 24 24 26 22" stroke="#818CF8" strokeWidth="1" strokeLinecap="round"/>
    {/* Downward arrow on face — mood */}
    <path d="M24 28V33M22 31L24 33L26 31" stroke="#6366F1" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    {/* 9 dots (questions) */}
    <circle cx="20" cy="38" r="1" fill="#A5B4FC"/>
    <circle cx="24" cy="38" r="1" fill="#A5B4FC"/>
    <circle cx="28" cy="38" r="1" fill="#A5B4FC"/>
  </svg>
);

const questions = [
  { q: 'قلة الرغبة أو المتعة في القيام بالأشياء', key: 'anhedonia' },
  { q: 'الشعور باليأس أو الإحباط أو الاكتئاب', key: 'depression' },
  { q: 'صعوبة في النوم أو البقاء نائماً، أو النوم المفرط', key: 'sleep' },
  { q: 'الشعور بالتعب أو فقدان الطاقة', key: 'fatigue' },
  { q: 'ضعف الشهية أو الإفراط في الأكل', key: 'appetite' },
  { q: 'الشعور بالسوء تجاه نفسك أو الشعور بالفشل', key: 'worthlessness' },
  { q: 'صعوبة في التركيز (قراءة، مشاهدة تلفاز، عمل)', key: 'concentration' },
  { q: 'ملاحظة بطء في الحركة أو الكلام — أو العكس (قلق وتوتر زائد)', key: 'psychomotor' },
  { q: 'أفكار بأنك ستكون أفضل حالاً لو مت، أو أفكار إيذاء نفسك', key: 'si', isSensitive: true },
];

const options = ['أبداً', 'عدة أيام', 'نصف الأيام تقريباً', 'يومياً تقريباً'];

const interpretations = [
  { min: 0,  max: 4,  label: 'لا يوجد اكتئاب',        color: 'text-green-700',  bg: 'bg-green-50 border-green-200',  bar: 'bg-green-400',   advice: 'الحالة المزاجية طبيعية. يُنصح بالمتابعة السريرية الدورية إذا كانت هناك عوامل خطر.' },
  { min: 5,  max: 9,  label: 'اكتئاب خفيف',            color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',    bar: 'bg-blue-400',    advice: 'يُنصح بالمتابعة والدعم النفسي. قد لا يحتاج علاجاً دوائياً. أعد التقييم بعد 2–4 أسابيع.' },
  { min: 10, max: 14, label: 'اكتئاب متوسط',            color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200',bar: 'bg-yellow-400',  advice: 'يستحق خطة علاجية: علاج نفسي (CBT) و/أو دوائي (SSRI). مراجعة متخصص نفسي مستحسنة.' },
  { min: 15, max: 19, label: 'اكتئاب متوسط إلى شديد',  color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200',bar: 'bg-orange-400',  advice: 'يتطلب علاجاً دوائياً فعالاً (SSRI أو SNRI) ومتابعة نفسية منتظمة. أحِل إلى طبيب نفسي.' },
  { min: 20, max: 27, label: 'اكتئاب شديد',             color: 'text-red-700',    bg: 'bg-red-50 border-red-200',      bar: 'bg-red-500',     advice: 'يجب التدخل الفوري. تقييم خطر الانتحار، علاج دوائي، ومتابعة مكثفة. فكر في الإحالة للمستشفى إذا لزم.' },
];

export default function PHQ9Calculator({ onBack }: Props) {
  const [mode, setMode] = useState<'stepwise' | 'all'>('stepwise');
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<number[]>(new Array(9).fill(-1));
  const [showResult, setShowResult] = useState(false);
  const [loading, setLoading] = useState(false);

  const totalScore = answers.reduce((sum, a) => (a === -1 ? sum : sum + a), 0);
  const answered = answers.filter(a => a !== -1).length;
  const interp = interpretations.find(i => totalScore >= i.min && totalScore <= i.max) ?? interpretations[0];

  const handleAnswer = (idx: number, val: number) => {
    const updated = [...answers];
    updated[idx] = val;
    setAnswers(updated);
    if (mode === 'stepwise' && idx < 8) {
      setTimeout(() => setCurrentQ(idx + 1), 350);
    }
  };

  const submit = () => {
    if (answers.includes(-1)) { toast.error('يرجى الإجابة على جميع الأسئلة'); return; }
    setShowResult(true);
  };

  const reset = () => {
    setAnswers(new Array(9).fill(-1));
    setShowResult(false);
    setCurrentQ(0);
  };

  const saveResult = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول أولاً');
      await supabase.from('saved_calculations').insert({
        user_id: user.id, title: 'استبيان الاكتئاب (PHQ-9)',
        result: `${totalScore}/27 — ${interp.label}`,
        input_data: { totalScore, answers }
      });
      toast.success('تم الحفظ ✅');
    } catch (err: any) { toast.error(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 duration-300 pb-10">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-5">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50"><ArrowRight className="w-5 h-5 text-gray-600" /></button>}
        <div className="flex items-center gap-3">
          <PHQ9Icon />
          <div>
            <h2 className="text-xl font-black text-gray-800">استبيان الاكتئاب (PHQ-9)</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded border border-indigo-100">للأطباء فقط ⚕️</span>
              <span className="text-xs text-gray-400 font-semibold">Patient Health Questionnaire</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Info ── */}
      <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 mb-5 flex gap-3 text-indigo-800">
        <Info className="w-5 h-5 shrink-0 mt-0.5 text-indigo-400" />
        <div className="text-xs leading-relaxed">
          <p className="font-bold mb-1">خلال الأسبوعين الماضيين...</p>
          <p>كم مرة عانيت من كل مشكلة من المشاكل التالية؟ الاستبيان يُستخدم لتشخيص الاكتئاب وتحديد شدته.</p>
        </div>
      </div>

      {!showResult ? (
        <>
          {/* Mode toggle */}
          <div className="flex bg-gray-100 p-1.5 rounded-xl mb-4">
            <button onClick={() => setMode('stepwise')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${mode === 'stepwise' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}>
              سؤال بسؤال
            </button>
            <button onClick={() => setMode('all')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${mode === 'all' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}>
              كل الأسئلة
            </button>
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex justify-between text-[10px] text-gray-400 font-bold mb-1.5">
              <span>{answered} / 9 أسئلة</span>
              <span>{Math.round((answered / 9) * 100)}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-400 rounded-full transition-all duration-500" style={{ width: `${(answered / 9) * 100}%` }} />
            </div>
          </div>

          {/* Questions */}
          {mode === 'stepwise' ? (
            <div className="bg-white p-5 rounded-[2rem] shadow-sm border">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-indigo-400">السؤال {currentQ + 1} من 9</span>
                {questions[currentQ].isSensitive && (
                  <span className="text-[9px] font-bold bg-red-50 text-red-500 px-1.5 py-0.5 rounded">حساس</span>
                )}
              </div>
              <p className="font-black text-sm text-gray-800 mb-5 leading-relaxed">{questions[currentQ].q}</p>

              <div className="space-y-2">
                {options.map((opt, val) => (
                  <button key={val} onClick={() => handleAnswer(currentQ, val)}
                    className={`w-full py-3 px-4 rounded-xl border-2 text-xs font-bold text-right transition-all flex items-center justify-between ${answers[currentQ] === val ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-gray-100 text-gray-600 hover:bg-gray-50'}`}>
                    <span>{opt}</span>
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${answers[currentQ] === val ? 'bg-indigo-200 text-indigo-700' : 'bg-gray-100 text-gray-400'}`}>{val}</span>
                  </button>
                ))}
              </div>

              {/* Prev / Next */}
              <div className="flex items-center justify-between mt-4">
                <button onClick={() => setCurrentQ(Math.max(0, currentQ - 1))} disabled={currentQ === 0}
                  className="text-xs font-bold text-gray-400 disabled:opacity-30 hover:text-gray-600">← السابق</button>
                <div className="flex gap-1">
                  {questions.map((_, i) => (
                    <button key={i} onClick={() => setCurrentQ(i)}
                      className={`w-2 h-2 rounded-full transition-all ${i === currentQ ? 'bg-indigo-500 w-4' : answers[i] !== -1 ? 'bg-indigo-200' : 'bg-gray-200'}`} />
                  ))}
                </div>
                {currentQ < 8
                  ? <button onClick={() => setCurrentQ(Math.min(8, currentQ + 1))} className="text-xs font-bold text-indigo-500 hover:text-indigo-700">التالي →</button>
                  : <button onClick={submit} className="text-xs font-bold bg-indigo-500 text-white px-3 py-1 rounded-lg hover:bg-indigo-600">النتيجة</button>
                }
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {questions.map((q, i) => (
                <div key={i} className={`bg-white p-4 rounded-2xl border shadow-sm ${q.isSensitive ? 'border-red-100' : 'border-gray-100'}`}>
                  <div className="flex items-start gap-2 mb-3">
                    <span className="text-[10px] font-black text-indigo-400 shrink-0 mt-0.5">{i + 1}.</span>
                    <p className="font-bold text-xs text-gray-800 leading-relaxed">{q.q}</p>
                    {q.isSensitive && <span className="text-[8px] font-bold bg-red-50 text-red-500 px-1 py-0.5 rounded shrink-0">حساس</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {options.map((opt, val) => (
                      <button key={val} onClick={() => handleAnswer(i, val)}
                        className={`py-2 px-2 rounded-xl text-[10px] font-bold border-2 transition-all flex items-center justify-between gap-1 ${answers[i] === val ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-gray-100 text-gray-500 hover:bg-gray-50'}`}>
                        <span className="truncate">{opt}</span>
                        <span className={`text-[9px] font-black shrink-0 ${answers[i] === val ? 'text-indigo-500' : 'text-gray-300'}`}>{val}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <button onClick={submit} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl shadow-md active:scale-95 transition-all">
                عرض النتيجة
              </button>
            </div>
          )}
        </>
      ) : (
        /* ── Results ── */
        <div className="space-y-4 animate-in slide-in-from-bottom-4">

          {/* Q9 Self-harm alert — show immediately and prominently */}
          {answers[8] > 0 && (
            <div className="bg-red-50 border-2 border-red-400 p-5 rounded-2xl flex gap-3">
              <AlertCircle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-black text-red-700 mb-1">تنبيه عاجل — أفكار إيذاء النفس</p>
                <p className="text-xs text-red-600 font-semibold leading-relaxed">أشار المريض إلى أفكار إيذاء النفس أو الموت. يستلزم تقييماً لخطر الانتحار فوراً وتدخلاً طبياً عاجلاً.</p>
              </div>
            </div>
          )}

          {/* Score card */}
          <div className={`p-6 rounded-[2rem] border-2 text-center ${interp.bg}`}>
            <p className="text-[10px] font-bold text-gray-400 mb-1">النتيجة الإجمالية</p>
            <p className="text-6xl font-black text-gray-800 mb-1">{totalScore} <span className="text-xl text-gray-400">/ 27</span></p>
            <p className={`text-xl font-black mb-4 ${interp.color}`}>{interp.label}</p>

            {/* Score bar */}
            <div className="h-3 bg-white/60 rounded-full overflow-hidden mb-4">
              <div className={`h-full rounded-full transition-all duration-700 ${interp.bar}`} style={{ width: `${(totalScore / 27) * 100}%` }} />
            </div>

            <div className="bg-white/60 p-4 rounded-xl text-xs font-semibold text-gray-700 text-right leading-relaxed">
              {interp.advice}
            </div>
          </div>

          {/* Score breakdown table */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100">
            <p className="text-xs font-black text-gray-600 mb-3">📊 جدول تفسير النتائج</p>
            {interpretations.map((item, i) => (
              <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-xl mb-1 transition-all ${totalScore >= item.min && totalScore <= item.max ? item.bg + ' border' : ''}`}>
                <span className={`text-[10px] font-black ${totalScore >= item.min && totalScore <= item.max ? item.color : 'text-gray-400'}`}>{item.min}–{item.max === 27 ? '27' : item.max}</span>
                <span className={`text-[10px] font-semibold ${totalScore >= item.min && totalScore <= item.max ? item.color : 'text-gray-400'}`}>{item.label}</span>
                {totalScore >= item.min && totalScore <= item.max && <span className="text-[9px]">◀</span>}
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button onClick={saveResult} disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 text-sm bg-indigo-600 text-white px-5 py-3.5 rounded-xl font-bold shadow-md hover:bg-indigo-700 transition-colors">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ
            </button>
            <button onClick={reset}
              className="flex items-center justify-center gap-1.5 text-sm bg-white border px-5 py-3.5 rounded-xl font-bold text-gray-600 hover:bg-gray-50">
              <RefreshCw className="w-4 h-4" /> إعادة
            </button>
          </div>

          {/* Sources */}
          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
            <p className="flex items-center gap-1.5 text-xs font-black text-gray-600 mb-3"><BookOpen className="w-3.5 h-3.5"/> المصادر العلمية</p>
            <div className="space-y-2">
              {[
                { title: 'Kroenke K et al. — The PHQ-9 Validity Study (J Gen Intern Med, 2001)', url: 'https://pubmed.ncbi.nlm.nih.gov/11556941/' },
                { title: 'APA — DSM-5 Diagnostic Criteria for MDD', url: 'https://www.psychiatry.org/psychiatrists/practice/dsm' },
                { title: 'NICE — Depression: Recognition & Management (CG90)', url: 'https://www.nice.org.uk/guidance/cg90' },
              ].map((s, i) => (
                <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-[10px] text-indigo-600 font-semibold hover:underline">
                  <ExternalLink className="w-3 h-3 shrink-0" />{s.title}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
