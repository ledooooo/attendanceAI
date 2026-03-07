import React, { useState } from 'react';
import { Activity, ArrowRight, Save, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';


interface Props { onBack?: () => void; }

export default function DiabetesRiskCalculator({ onBack }: Props) {
  const [score, setScore] = useState(0);
  const [step, setStep] = useState(0);
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(false);

  const questions = [
    { q: 'العمر', options: [{t:'أقل من 45', s:0}, {t:'45-54', s:2}, {t:'55-64', s:3}, {t:'أكثر من 64', s:4}] },
    { q: 'مؤشر كتلة الجسم (الوزن)', options: [{t:'أقل من 25 (وزن طبيعي)', s:0}, {t:'25-30 (وزن زائد)', s:1}, {t:'أكثر من 30 (سمنة)', s:3}] },
    { q: 'محيط الخصر (رجال / نساء)', options: [{t:'أقل من 94سم / 80سم', s:0}, {t:'94-102سم / 80-88سم', s:3}, {t:'أكثر من 102سم / 88سم', s:4}] },
    { q: 'هل تمارس الرياضة يومياً (30 دقيقة)؟', options: [{t:'نعم', s:0}, {t:'لا', s:2}] },
    { q: 'هل تتناول الخضروات والفاكهة يومياً؟', options: [{t:'يومياً', s:0}, {t:'ليس كل يوم', s:1}] },
    { q: 'هل سبق أن تناولت دواء للضغط؟', options: [{t:'لا', s:0}, {t:'نعم', s:2}] },
    { q: 'هل وجدت ارتفاعاً في السكر سابقاً (أثناء فحص أو حمل)؟', options: [{t:'لا', s:0}, {t:'نعم', s:5}] },
    { q: 'تاريخ عائلي للسكري (أقارب)؟', options: [{t:'لا', s:0}, {t:'نعم (جد/عم/خال)', s:3}, {t:'نعم (أب/أم/أخ/أخت)', s:5}] },
  ];

  const handleSelect = (s: number) => {
    setScore(prev => prev + s);
    if (step < questions.length - 1) {
      setStep(prev => prev + 1);
    } else {
      setFinished(true);
    }
  };

  const getResult = () => {
    if (score < 7) return { risk: 'منخفض جداً', msg: 'أنت في أمان حالياً (1%)', color: 'text-green-600', bg: 'bg-green-50 border-green-200' };
    if (score < 12) return { risk: 'منخفض', msg: 'احتمالية قليلة (4%)', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' };
    if (score < 15) return { risk: 'متوسط', msg: 'يجب الانتباه للوزن والرياضة (17%)', color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200' };
    if (score < 21) return { risk: 'مرتفع', msg: 'خطر! يجب استشارة طبيب (33%)', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' };
    return { risk: 'مرتفع جداً', msg: 'احتمالية كبيرة جداً (50%) - افحص فوراً', color: 'text-red-600', bg: 'bg-red-50 border-red-200' };
  };

  const saveResult = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول أولاً');
      const res = getResult();
      await supabase.from('saved_calculations').insert({
        user_id: user.id,
        title: 'مخاطر السكري (FINDRISC)',
        result: `النقاط: ${score} - ${res.risk}`,
        input_data: { score }
      });
      toast.success('تم حفظ النتيجة بنجاح ✅');
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
          <div className="p-2 bg-sky-100 text-sky-600 rounded-xl"><Activity className="w-5 h-5" /></div>
          <h2 className="text-xl font-black text-gray-800">حاسبة مخاطر السكري</h2>
        </div>
      </div>

      {!finished ? (
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 text-center">
          <p className="text-xs text-sky-500 font-bold mb-4 bg-sky-50 inline-block px-3 py-1 rounded-full">سؤال {step + 1} من {questions.length}</p>
          <h2 className="text-xl font-black text-gray-800 mb-8 h-12 flex items-center justify-center">{questions[step].q}</h2>
          <div className="space-y-3">
            {questions[step].options.map((opt, i) => (
              <button 
                key={i}
                onClick={() => handleSelect(opt.s)}
                className="w-full py-4 px-6 rounded-2xl border-2 border-gray-100 hover:border-sky-500 hover:bg-sky-50 text-gray-700 font-bold transition-all text-right flex justify-between items-center group active:scale-95"
              >
                <span>{opt.t}</span>
                <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-sky-500" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className={`p-8 rounded-[2rem] text-center border-2 shadow-sm animate-in slide-in-from-bottom-4 ${getResult().bg}`}>
           <h3 className="text-gray-500 font-bold mb-2">نتيجة التقييم (النقاط: {score})</h3>
           <h2 className={`text-4xl font-black mb-2 ${getResult().color}`}>{getResult().risk}</h2>
           <p className="text-sm font-bold text-gray-600 mb-8">{getResult().msg}</p>
           
           <div className="space-y-3">
             <button onClick={saveResult} disabled={loading} className="w-full flex items-center justify-center gap-2 text-sm bg-white px-5 py-3.5 rounded-xl font-bold text-gray-800 hover:bg-gray-50 shadow-sm border transition-colors">
               {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ النتيجة
             </button>
             <button onClick={() => { setScore(0); setStep(0); setFinished(false); }} className="w-full flex items-center justify-center gap-2 text-sm text-sky-600 font-bold py-2 hover:underline">
               <RefreshCw className="w-4 h-4" /> إعادة الاختبار
             </button>
           </div>
        </div>
      )}
    </div>
  );
}
