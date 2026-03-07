import React, { useState } from 'react';
import { Smile, ArrowRight, RefreshCw, AlertCircle, Save, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

interface Props { onBack?: () => void; }

export default function PHQ9Calculator({ onBack }: Props) {
  const questions = [
    "قلة الرغبة أو المتعة في القيام بالأشياء",
    "الشعور باليأس أو الإحباط أو الاكتئاب",
    "صعوبة في النوم أو البقاء نائماً، أو النوم كثيراً",
    "الشعور بالتعب أو قلة الطاقة",
    "ضعف الشهية أو الإفراط في الأكل",
    "الشعور بالسوء تجاه نفسك أو أنك فاشل",
    "صعوبة في التركيز (مثل قراءة الجريدة أو مشاهدة التلفاز)",
    "الحركة أو الكلام ببطء شديد، أو العكس (التململ وكثرة الحركة)",
    "أفكار بأنك ستكون أفضل حالاً لو مت أو إيذاء نفسك"
  ];

  const [answers, setAnswers] = useState<number[]>(new Array(9).fill(-1));
  const [showResult, setShowResult] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAnswer = (index: number, value: number) => {
    const newAnswers = [...answers];
    newAnswers[index] = value;
    setAnswers(newAnswers);
  };

  const calculateScore = () => {
    if (answers.includes(-1)) {
      toast.error('يرجى الإجابة على جميع الأسئلة للحصول على النتيجة');
      return;
    }
    setShowResult(true);
  };

  const reset = () => {
    setAnswers(new Array(9).fill(-1));
    setShowResult(false);
  };

  const totalScore = answers.reduce((a, b) => (b === -1 ? a : a + b), 0);

  const getInterpretation = () => {
    if (totalScore <= 4) return { text: "لا يوجد اكتئاب", color: "text-green-600", bg: "bg-green-50 border-green-200", advice: "الحالة المزاجية طبيعية." };
    if (totalScore <= 9) return { text: "اكتئاب خفيف", color: "text-blue-600", bg: "bg-blue-50 border-blue-200", advice: "ينصح بالمراقبة، وقد لا يحتاج لعلاج دوائي." };
    if (totalScore <= 14) return { text: "اكتئاب متوسط", color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200", advice: "يستحق خطة علاجية (علاج نفسي أو دوائي)." };
    if (totalScore <= 19) return { text: "اكتئاب متوسط الشدة", color: "text-orange-600", bg: "bg-orange-50 border-orange-200", advice: "يتطلب علاجاً فعالاً (دوائي و/أو نفسي)." };
    return { text: "اكتئاب شديد", color: "text-red-600", bg: "bg-red-50 border-red-200", advice: "يجب التدخل العلاجي الفوري." };
  };

  const resultData = getInterpretation();

  const saveResult = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول أولاً');
      await supabase.from('saved_calculations').insert({
        user_id: user.id,
        title: 'استبيان الاكتئاب (PHQ-9)',
        result: `النقاط: ${totalScore}/27 - ${resultData.text}`,
        input_data: { totalScore }
      });
      toast.success('تم الحفظ بنجاح ✅');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center gap-3 mb-6">
        {onBack && (
          <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50 transition-colors">
            <ArrowRight className="w-5 h-5 text-gray-600" />
          </button>
        )}
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl"><Smile className="w-5 h-5" /></div>
          <h2 className="text-xl font-black text-gray-800">استبيان الاكتئاب (PHQ-9)</h2>
        </div>
      </div>

      {!showResult ? (
        <div className="space-y-4">
          <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl text-xs font-bold text-indigo-800 flex gap-3">
            <AlertCircle className="w-5 h-5 shrink-0"/>
            <p>على مدار <strong>الأسبوعين الماضيين</strong>، كم مرة عانيت من المشاكل التالية؟</p>
          </div>

          <div className="max-h-[55vh] overflow-y-auto custom-scrollbar pr-1 space-y-3">
            {questions.map((q, i) => (
              <div key={i} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <p className="font-bold text-sm text-gray-800 mb-3">{i + 1}. {q}</p>
                <div className="grid grid-cols-2 gap-2">
                  {['أبداً', 'عدة أيام', 'نصف الأيام', 'يومياً'].map((opt, val) => (
                    <button
                      key={val}
                      onClick={() => handleAnswer(i, val)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border-2 transition-all ${answers[i] === val ? 'bg-indigo-50 text-indigo-600 border-indigo-500' : 'bg-gray-50 text-gray-500 border-transparent hover:bg-gray-100'}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button onClick={calculateScore} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl transition-all shadow-md active:scale-95 mt-2">عرض النتيجة</button>
        </div>
      ) : (
        <div className={`p-8 rounded-[2rem] border-2 shadow-sm text-center animate-in slide-in-from-bottom-4 ${resultData.bg}`}>
          <h3 className="text-gray-500 font-bold mb-1">نتيجة التقييم</h3>
          <p className="text-5xl font-black text-gray-800 mb-2">{totalScore} <span className="text-xl text-gray-400">/ 27</span></p>
          <h2 className={`text-2xl font-black mb-4 ${resultData.color}`}>{resultData.text}</h2>
          
          <div className="bg-white/60 p-4 rounded-xl mb-4 text-sm font-bold text-gray-700 shadow-sm leading-relaxed">
            {resultData.advice}
          </div>

          {answers[8] > 0 && (
            <div className="bg-red-50 border border-red-200 p-4 rounded-xl mb-6 text-red-800 text-xs font-bold flex items-start gap-2 text-right text-balance">
              <AlertCircle className="w-5 h-5 shrink-0"/>
              <p>تنبيه: أشرت إلى وجود أفكار حول إيذاء النفس. يرجى التوجيه للتدخل الطبي الفوري.</p>
            </div>
          )}

          <div className="space-y-3 mt-6">
             <button onClick={saveResult} disabled={loading} className="w-full flex items-center justify-center gap-2 text-sm bg-white px-5 py-3.5 rounded-xl font-bold text-gray-800 hover:bg-gray-50 shadow-sm border transition-colors">
               {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ النتيجة
             </button>
             <button onClick={reset} className="w-full flex items-center justify-center gap-2 text-sm text-indigo-600 font-bold py-2 hover:underline">
               <RefreshCw className="w-4 h-4" /> إعادة الاختبار
             </button>
           </div>
        </div>
      )}
    </div>
  );
}
