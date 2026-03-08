import React, { useState } from 'react';
import { ArrowRight, RefreshCw, Save, Loader2, BookOpen, ExternalLink, Info, ChevronRight } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

interface Props { onBack?: () => void; }

// ─── SVG Icon ─────────────────────────────────────────────────────────────────
const AnxietyIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
    <rect width="48" height="48" rx="14" fill="#F0FDFA"/>
    {/* Brain */}
    <path d="M24 10C18 10 13 14.5 13 20C13 23 14.5 25.5 17 27L16 38H32L31 27C33.5 25.5 35 23 35 20C35 14.5 30 10 24 10Z" fill="#CCFBF1" stroke="#0D9488" strokeWidth="1.5" strokeLinejoin="round"/>
    {/* Brain grooves */}
    <path d="M20 17C20 17 22 19 24 17C26 15 28 17 28 17" stroke="#14B8A6" strokeWidth="1.2" strokeLinecap="round"/>
    <path d="M18 22C18 22 20 24 22 22" stroke="#14B8A6" strokeWidth="1.2" strokeLinecap="round"/>
    <path d="M26 22C26 22 28 24 30 22" stroke="#14B8A6" strokeWidth="1.2" strokeLinecap="round"/>
    {/* Worry waves on sides */}
    <path d="M10 20C10 20 12 18 11 16" stroke="#0D9488" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
    <path d="M38 20C38 20 36 18 37 16" stroke="#0D9488" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
  </svg>
);

const questions = [
  { text: 'الشعور بالعصبية أو القلق أو التوتر الشديد',               sub: 'Feeling nervous, anxious or on edge' },
  { text: 'عدم القدرة على إيقاف القلق أو السيطرة عليه',               sub: 'Not being able to stop or control worrying' },
  { text: 'القلق المفرط حول أشياء مختلفة',                           sub: 'Worrying too much about different things' },
  { text: 'صعوبة في الاسترخاء',                                      sub: 'Trouble relaxing' },
  { text: 'عدم الاستقرار لدرجة صعوبة الجلوس ساكناً',                  sub: 'Being so restless it is hard to sit still' },
  { text: 'سرعة الانفعال أو حدة الطبع',                               sub: 'Becoming easily annoyed or irritable' },
  { text: 'الشعور بالخوف وكأن شيئاً فظيعاً سيحدث',                    sub: 'Feeling afraid as if something awful might happen' },
];

const opts = ['أبداً', 'عدة أيام', 'أكثر من نصف الأيام', 'يومياً تقريباً'];

export default function GAD7Calculator({ onBack }: Props) {
  const [answers, setAnswers] = useState<number[]>(new Array(7).fill(-1));
  const [currentQ, setCurrentQ] = useState(0);
  const [mode, setMode] = useState<'step' | 'all'>('step');
  const [showResult, setShowResult] = useState(false);
  const [loading, setLoading] = useState(false);

  const totalScore = answers.reduce((a, b) => (b === -1 ? a : a + b), 0);
  const allAnswered = !answers.includes(-1);
  const progress = (answers.filter(a => a !== -1).length / 7) * 100;

  const getResult = () => {
    if (totalScore <= 4)  return { text: 'قلق بسيط جداً',  color: 'text-green-700',  bg: 'bg-green-50 border-green-200',  action: 'لا توجد أعراض قلق مقلقة. ممارسة تقنيات الاسترخاء مفيدة.' };
    if (totalScore <= 9)  return { text: 'قلق خفيف',        color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',    action: 'يُنصح بمتابعة الأعراض وممارسة التنفس العميق واليقظة الذهنية.' };
    if (totalScore <= 14) return { text: 'قلق متوسط',       color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', action: 'يُنصح باستشارة مختص نفسي. العلاج المعرفي السلوكي فعّال جداً.' };
    return                       { text: 'قلق شديد',         color: 'text-red-700',    bg: 'bg-red-50 border-red-200',       action: 'يُنصح بشدة بزيارة طبيب نفسي للتقييم والعلاج الدوائي إذا لزم.' };
  };

  const handleAnswer = (qIdx: number, val: number) => {
    const updated = [...answers];
    updated[qIdx] = val;
    setAnswers(updated);
    if (mode === 'step' && qIdx < 6) setTimeout(() => setCurrentQ(qIdx + 1), 200);
  };

  const saveResult = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول أولاً');
      const res = getResult();
      await supabase.from('saved_calculations').insert({
        user_id: user.id, title: 'مقياس القلق (GAD-7)',
        result: `${totalScore}/21 — ${res.text}`,
        input_data: { totalScore }
      });
      toast.success('تم الحفظ ✅');
    } catch (err: any) { toast.error(err.message); } finally { setLoading(false); }
  };

  const reset = () => { setAnswers(new Array(7).fill(-1)); setCurrentQ(0); setShowResult(false); };
  const res = getResult();

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 duration-300 pb-10">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-5">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50"><ArrowRight className="w-5 h-5 text-gray-600" /></button>}
        <div className="flex items-center gap-3">
          <AnxietyIcon />
          <div>
            <h2 className="text-xl font-black text-gray-800">مقياس القلق العام</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-bold bg-teal-50 text-teal-600 px-2 py-0.5 rounded border border-teal-100">للصحة النفسية</span>
              <span className="text-xs text-gray-400 font-semibold">GAD-7</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Info ── */}
      <div className="bg-teal-50 p-4 rounded-2xl border border-teal-100 mb-5 flex gap-3 text-teal-800">
        <Info className="w-5 h-5 shrink-0 mt-0.5 text-teal-400" />
        <div className="text-xs leading-relaxed">
          <p className="font-bold mb-1">Generalized Anxiety Disorder Scale</p>
          <p>مقياس معتمد عالمياً من DSM-5 يُقيّم أعراض القلق العام خلال الأسبوعين الماضيين. يُستخدم في الرعاية الأولية وعيادات الصحة النفسية.</p>
        </div>
      </div>

      {/* ── Instruction banner ── */}
      {!showResult && (
        <div className="bg-white p-3 rounded-xl border border-gray-100 mb-4 flex items-center justify-between">
          <p className="text-xs font-bold text-gray-600">خلال <span className="text-teal-600 font-black">الأسبوعين الماضيين</span>، كم مرة شعرتَ بـ...</p>
          <button onClick={() => setMode(mode === 'step' ? 'all' : 'step')}
            className="text-[10px] font-bold text-teal-600 bg-teal-50 px-2 py-1 rounded-lg border border-teal-100 shrink-0">
            {mode === 'step' ? 'عرض الكل' : 'سؤال بسؤال'}
          </button>
        </div>
      )}

      {!showResult ? (
        <>
          {mode === 'step' ? (
            /* Step-by-step mode */
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
              {/* Progress */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black text-teal-600 bg-teal-50 px-2.5 py-1 rounded-full">سؤال {currentQ + 1} من 7</span>
                  <span className="text-[10px] text-gray-400 font-bold">{Math.round(progress)}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div className="bg-teal-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
              </div>

              <p className="text-sm font-black text-gray-800 mb-1 leading-relaxed">{questions[currentQ].text}</p>
              <p className="text-[10px] text-gray-400 font-semibold italic mb-5">{questions[currentQ].sub}</p>

              <div className="space-y-2.5">
                {opts.map((opt, val) => (
                  <button key={val} onClick={() => handleAnswer(currentQ, val)}
                    className={`w-full p-4 rounded-2xl border-2 font-bold text-xs text-right flex items-center justify-between transition-all active:scale-98 ${answers[currentQ] === val ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-100 hover:border-teal-200 hover:bg-teal-50/50 text-gray-700'}`}>
                    <span>{opt}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${answers[currentQ] === val ? 'bg-teal-200 text-teal-800' : 'bg-gray-100 text-gray-400'}`}>{val}</span>
                      <ChevronRight className={`w-4 h-4 ${answers[currentQ] === val ? 'text-teal-500' : 'text-gray-300'}`} />
                    </div>
                  </button>
                ))}
              </div>

              {currentQ > 0 && (
                <button onClick={() => setCurrentQ(currentQ - 1)}
                  className="mt-4 w-full text-center text-xs text-gray-400 font-bold hover:text-gray-600">
                  ← السؤال السابق
                </button>
              )}
            </div>
          ) : (
            /* All at once mode */
            <div className="space-y-3">
              {questions.map((q, i) => (
                <div key={i} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                  <p className="font-bold text-xs text-gray-800 mb-3">{i + 1}. {q.text}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {opts.map((opt, val) => (
                      <button key={val} onClick={() => handleAnswer(i, val)}
                        className={`py-2 px-2 rounded-xl text-[10px] font-bold border-2 transition-all ${answers[i] === val ? 'bg-teal-50 text-teal-600 border-teal-400' : 'bg-gray-50 text-gray-500 border-transparent hover:bg-gray-100'}`}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Submit */}
          {(allAnswered || (mode === 'step' && currentQ === 6 && answers[6] !== -1)) && (
            <button onClick={() => setShowResult(true)}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-black py-4 rounded-2xl transition-all shadow-md active:scale-95 mt-4">
              عرض النتيجة النهائية
            </button>
          )}
        </>
      ) : (
        /* Result */
        <div className="space-y-4 animate-in slide-in-from-bottom-4">
          <div className={`p-8 rounded-[2rem] border-2 shadow-sm text-center ${res.bg}`}>
            <p className="text-xs text-gray-400 font-bold mb-1">إجمالي النقاط</p>
            <p className="text-6xl font-black text-gray-800 mb-1">{totalScore}</p>
            <p className="text-xs text-gray-400 font-bold mb-3">من أصل 21</p>

            {/* Score bar */}
            <div className="flex rounded-full overflow-hidden h-2.5 mb-4 bg-gray-100">
              {[{ w: '24%', c: '#22C55E' }, { w: '24%', c: '#3B82F6' }, { w: '24%', c: '#F97316' }, { w: '28%', c: '#EF4444' }].map((s, i) => (
                <div key={i} style={{ width: s.w, backgroundColor: s.c }} />
              ))}
            </div>

            <p className={`text-lg font-black mb-3 ${res.color}`}>{res.text}</p>
            <p className="text-xs text-gray-600 bg-white/60 p-3 rounded-xl font-semibold leading-relaxed">{res.action}</p>
          </div>

          {/* Interpretation guide */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100">
            <p className="text-xs font-black text-gray-600 mb-3">دليل تفسير النتائج</p>
            {[
              { r: '0 – 4',   l: 'بسيط جداً',  c: 'text-green-600',  bg: 'bg-green-50' },
              { r: '5 – 9',   l: 'خفيف',        c: 'text-blue-600',   bg: 'bg-blue-50' },
              { r: '10 – 14', l: 'متوسط',       c: 'text-orange-600', bg: 'bg-orange-50' },
              { r: '15 – 21', l: 'شديد',         c: 'text-red-600',    bg: 'bg-red-50' },
            ].map((t, i) => (
              <div key={i} className={`flex items-center justify-between p-2.5 rounded-xl mb-1.5 ${t.bg}`}>
                <span className={`text-xs font-bold ${t.c}`}>{t.l}</span>
                <span className="text-[10px] text-gray-400 font-bold">{t.r} نقطة</span>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button onClick={saveResult} disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 text-sm bg-white px-5 py-3.5 rounded-xl font-bold text-gray-800 shadow-sm border hover:bg-gray-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ
            </button>
            <button onClick={reset}
              className="flex-1 flex items-center justify-center gap-2 text-sm text-teal-600 font-bold py-3.5 bg-teal-50 rounded-xl border border-teal-100 hover:bg-teal-100">
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
            { title: 'Spitzer RL et al. — GAD-7 Validation Study (JAMA, 2006)', url: 'https://pubmed.ncbi.nlm.nih.gov/16717171/' },
            { title: 'DSM-5 — Generalized Anxiety Disorder Criteria', url: 'https://www.psychiatry.org/psychiatrists/practice/dsm' },
            { title: 'NICE Guidelines — GAD Assessment and Management', url: 'https://www.nice.org.uk/guidance/cg113' },
          ].map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-[10px] text-teal-600 font-semibold hover:underline">
              <ExternalLink className="w-3 h-3 shrink-0" />{s.title}
            </a>
          ))}
        </div>
        <p className="text-[9px] text-gray-400 font-semibold mt-3 leading-relaxed">⚠️ هذا المقياس أداة فحص وليس تشخيصاً. النتائج تستدعي تقييماً من متخصص للتأكيد والعلاج.</p>
      </div>

    </div>
  );
}
