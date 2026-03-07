import React, { useState } from 'react';
import { Smile, ArrowRight, BookOpen, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface Props { onBack?: () => void; }

export default function EPDSCalculator({ onBack }: Props) {
  const [answers, setAnswers] = useState<number[]>(new Array(10).fill(0));
  const [showResult, setShowResult] = useState(false);

  const questions = [
    "لقد كنت قادرة على الضحك ورؤية الجانب الممتع من الأشياء:",
    "لقد تطلعت إلى الأمام باستمتاع للأشياء:",
    "لقد لمت نفسي بلا مبرر عندما تسوء الأمور:",
    "لقد شعرت بالقلق أو الانزعاج بدون سبب جيد:",
    "لقد شعرت بالخوف أو الذعر بدون سبب جيد جداً:",
    "لقد شعرت أن الأشياء بدأت تتراكم فوق رأسي:",
    "لقد كنت غير سعيدة لدرجة أنني واجهت صعوبة في النوم:",
    "لقد شعرت بالحزن أو البؤس:",
    "لقد كنت غير سعيدة لدرجة أنني كنت أبكي:",
    "لقد طرأت عليّ فكرة إيذاء نفسي:"
  ];

  const totalScore = answers.reduce((a, b) => a + b, 0);

  const getResult = () => {
    if (totalScore >= 13) return { label: 'احتمالية عالية للاكتئاب', color: 'text-red-600', bg: 'bg-red-50 border-red-200' };
    if (totalScore >= 10) return { label: 'خطر متوسط (يحتاج متابعة)', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' };
    return { label: 'حالة مستقرة (خطر منخفض)', color: 'text-green-600', bg: 'bg-green-50 border-green-200' };
  };

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 pb-10 px-1 text-right" dir="rtl">
      <div className="flex items-center gap-3 mb-4">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border"><ArrowRight className="w-5 h-5" /></button>}
        <div className="flex items-center gap-2">
          <div className="p-2 bg-purple-100 text-purple-700 rounded-xl"><Smile className="w-5 h-5" /></div>
          <h2 className="text-lg font-black text-gray-800">مقياس إدنبرة للاكتئاب (EPDS)</h2>
        </div>
      </div>

      <div className="bg-white p-5 rounded-[2rem] shadow-sm border space-y-6">
        {questions.map((q, i) => (
          <div key={i} className="border-b border-gray-50 pb-4 last:border-0">
            <p className="text-xs font-black text-gray-700 mb-3">{i+1}. {q}</p>
            <div className="grid grid-cols-4 gap-2">
              {[0, 1, 2, 3].map(val => (
                <button 
                  key={val} 
                  onClick={() => { const newAns = [...answers]; newAns[i] = val; setAnswers(newAns); }}
                  className={`py-2 rounded-lg text-[10px] font-bold transition-all border ${answers[i] === val ? 'bg-purple-600 text-white border-purple-600 shadow-md' : 'bg-gray-50 text-gray-500 border-transparent hover:bg-gray-100'}`}
                >
                  {val === 0 ? 'أبداً' : val === 3 ? 'دائماً' : val}
                </button>
              ))}
            </div>
          </div>
        ))}

        <button 
          onClick={() => setShowResult(true)}
          className="w-full bg-gray-800 text-white font-black py-4 rounded-xl shadow-lg active:scale-95 transition-all"
        >
          عرض التقييم النهائي
        </button>

        {showResult && (
          <div className={`p-6 rounded-[2rem] border-2 text-center animate-bounce-short ${getResult().bg}`}>
            <p className="text-xs font-black text-gray-500 mb-1">إجمالي النقاط: {totalScore}</p>
            <div className={`text-2xl font-black mb-2 ${getResult().color}`}>{getResult().label}</div>
            <p className="text-[10px] font-bold text-gray-600">
              * في حال وجود أي أفكار لإيذاء النفس، يجب استشارة الطبيب النفسي فوراً بغض النظر عن النتيجة.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
