import React, { useState } from 'react';
import { Brain, ArrowRight, RefreshCw, AlertCircle, Save, Loader2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';

interface Props { onBack?: () => void; }

export default function GAD7Calculator({ onBack }: Props) {
  const questions = [
    "الشعور بالعصبية أو القلق أو التوتر",
    "عدم القدرة على وقف القلق أو السيطرة عليه",
    "القلق المفرط بشأن أشياء مختلفة",
    "صعوبة في الاسترخاء",
    "الشعور بعدم الاستقرار لدرجة صعوبة الجلوس",
    "سرعة الانفعال أو حدة الطبع",
    "الشعور بالخوف وكأن شيئاً فظيعاً سيحدث"
  ];

  const [answers, setAnswers] = useState<number[]>(new Array(7).fill(-1));
  const [showResult, setShowResult] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAnswer = (index: number, value: number) => {
    const newAnswers = [...answers];
    newAnswers[index] = value;
    setAnswers(newAnswers);
  };

  const calculateScore = () => {
    if (answers.includes(-1)) {
      toast.error('يرجى الإجابة على جميع الأسئلة');
      return;
    }
    setShowResult(true);
  };

  const totalScore = answers.reduce((a, b) => (b === -1 ? a : a + b), 0);

  const getInterpretation = () => {
    if (totalScore <= 4) return { text: "قلق بسيط جداً", color: "text-green-600", bg: "bg-green-50 border-green-200", advice: "لا توجد أعراض قلق ملحوظة." };
    if (totalScore <= 9) return { text: "قلق خفيف", color: "text-blue-600", bg: "bg-blue-50 border-blue-200", advice: "ينصح بمتابعة الأعراض وممارسة الاسترخاء." };
    if (totalScore <= 14) return { text: "قلق متوسط", color: "text-orange-600", bg: "bg-orange-50 border-orange-200", advice: "قد تحتاج لاستشارة مختص نفسي." };
    return { text: "قلق شديد", color: "text-red-600", bg: "bg-red-50 border-red-200", advice: "ينصح بشدة بزيارة طبيب نفسي للتقييم." };
  };

  const saveResult = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول أولاً');
      const res = getInterpretation();
      await supabase.from('saved_calculations').insert({
        user_id: user.id,
        title: 'مقياس القلق (GAD-7)',
        result: `النقاط: ${totalScore}/21 - ${res.text}`,
        input_data: { totalScore }
      });
      toast.success('تم الحفظ بنجاح ✅');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resultData = getInterpretation();

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center gap-3 mb-6">
        {onBack && (
          <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50 transition-colors">
            <ArrowRight className="w-5 h-5 text-gray-600" />
          </button>
        )}
        <div className="flex items-center gap-2">
          <div className="p-2 bg-teal-100 text-teal-600 rounded-xl"><Brain className="w-5 h-5" /></div>
          <h2 className="text-xl font-black text-gray-800">مقياس القلق (GAD-7)</h2>
        </div>
      </div>

      {!showResult ? (
        <div className="space-y-4">
          <div className="bg-teal-50 border border-teal-100 p-4 rounded-2xl text-xs font-bold text-teal-800 flex gap-3">
            <AlertCircle className="w-5 h-5 shrink-0"/>
            <p>على مدار <strong>الأسبوعين الماضيين</strong>، كم مرة عانيت من المشاكل التالية؟</p>
          </div>

          <div className="max-h-[50vh] overflow-y-auto custom-scrollbar pr-1 space-y-3">
            {questions.map((q, i) => (
              <div key={i} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <p className="font-bold text-sm text-gray-800 mb-3">{i + 1}. {q}</p>
                <div className="grid grid-cols-2 gap-2">
                  {['أبداً', 'عدة أيام', 'أكثر من النصف', 'يومياً'].map((opt, val) => (
                    <button
                      key={val}
                      onClick={() => handleAnswer(i, val)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border-2 transition-all ${answers[i] === val ? 'bg-teal-50 text-teal-600 border-teal-500' : 'bg-gray-50 text-gray-500 border-transparent hover:bg-gray-100'}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button onClick={calculateScore} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-black py-4 rounded-2xl transition-all shadow-md active:scale-95 mt-2">عرض النتيجة</button>
        </div>
      ) : (
        <div className={`p-8 rounded-[2rem] border-2 shadow-sm text-center animate-in slide-in-from-bottom-4 ${resultData.bg}`}>
          <h3 className="text-gray-500 font-bold mb-1">نتيجة التقييم</h3>
          <p className="text-5xl font-black text-gray-800 mb-2">{totalScore} <span className="text-xl text-gray-400">/ 21</span></p>
          <h2 className={`text-2xl font-black mb-4 ${resultData.color}`}>{resultData.text}</h2>
          
          <div className="bg-white/60 p-4 rounded-xl mb-6 text-sm font-bold text-gray-700 shadow-sm">
            {resultData.advice}
          </div>

          <div className="space-y-3">
             <button onClick={saveResult} disabled={loading} className="w-full flex items-center justify-center gap-2 text-sm bg-white px-5 py-3.5 rounded-xl font-bold text-gray-800 hover:bg-gray-50 shadow-sm border transition-colors">
               {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ النتيجة
             </button>
             <button onClick={() => { setAnswers(new Array(7).fill(-1)); setShowResult(false); }} className="w-full flex items-center justify-center gap-2 text-sm text-teal-600 font-bold py-2 hover:underline">
               <RefreshCw className="w-4 h-4" /> إعادة الاختبار
             </button>
           </div>
        </div>
      )}
    </div>
  );
}
