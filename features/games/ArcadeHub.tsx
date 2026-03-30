import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';
import { 
  Gamepad2, Trophy, BrainCircuit, X, ChevronRight, 
  Stethoscope, Pill, Syringe, HeartPulse, Activity, Cross
} from 'lucide-react';

// ==========================================
// 1. نافذة التحدي المعرفي (تعمل بالذكاء الاصطناعي)
// ==========================================
const VictoryQuizModal = ({ employee, onClose, onSuccess }: any) => {
  const [quiz, setQuiz] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  useEffect(() => { fetchQuiz(); }, []);

  const fetchQuiz = async () => {
    setLoading(true);
    // استدعاء دالة الذكاء الاصطناعي التي أنشأناها مسبقاً
    const { data, error } = await supabase.functions.invoke('generate-quiz', {
      body: {
        specialty: employee.job_title || 'عام', // يجلب تخصص الموظف الحقيقي
        category: 'طبي وعلمي', 
        difficulty: 'متوسط',
        length: 'قصير',
        language: 'ar',
        include_hint: true
      }
    });

    if (error || !data) {
      toast.error('تعذر جلب التحدي، يبدو أن السيرفر مشغول.');
      onClose();
    } else {
      setQuiz(data);
    }
    setLoading(false);
  };

  const handleAnswer = async (optionKey: string) => {
    setSelectedOption(optionKey);
    
    if (optionKey === quiz.correct_option) {
      toast.success('إجابة صحيحة! 🎉 كسبت 10 نقاط!', { duration: 4000, icon: '🏆' });
      // استدعاء دالة إضافة النقاط في قاعدة البيانات
      await supabase.rpc('add_employee_points', { 
        p_emp_id: employee.employee_id || employee.id, 
        p_points: 10 
      });
      onSuccess(); // تحديث نقاط الموظف في الواجهة
    } else {
      toast.error('إجابة خاطئة 😔، حظ أوفر المرة القادمة!');
    }
    
    // إغلاق النافذة بعد 5 ثواني ليتسنى له قراءة التفسير
    setTimeout(() => onClose(), 5000);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4" dir="rtl">
        <div className="bg-white rounded-3xl p-8 flex flex-col items-center justify-center animate-pulse">
          <BrainCircuit size={48} className="text-indigo-500 mb-4 animate-bounce" />
          <h3 className="text-lg font-black text-gray-800">جاري إعداد تحدي خاص بتخصصك...</h3>
          <p className="text-sm text-gray-500 mt-2">الذكاء الاصطناعي يكتب السؤال الآن 🤖</p>
        </div>
      </div>
    );
  }

  if (!quiz) return null;
  const isAnswered = selectedOption !== null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in" dir="rtl">
      <div className="bg-white rounded-[2rem] p-6 max-w-lg w-full shadow-2xl relative overflow-hidden">
        {/* خلفية جمالية */}
        <div className="absolute top-0 right-0 left-0 h-2 bg-gradient-to-r from-emerald-400 to-indigo-500"></div>
        
        <h2 className="text-2xl font-black text-indigo-900 mb-2 mt-2">🎉 مبروك الفوز في اللعبة!</h2>
        <p className="text-sm font-bold text-gray-500 mb-6">أجب على هذا السؤال من تخصصك لمضاعفة نقاطك وكسب 10 نقاط إضافية:</p>
        
        <div className="bg-indigo-50 p-4 rounded-2xl mb-6 border border-indigo-100">
          <p className="text-gray-900 text-lg font-black leading-snug">{quiz.question_text}</p>
        </div>
        
        <div className="space-y-3">
          {['A', 'B', 'C', 'D'].map((key) => {
            const optionText = quiz[`option_${key.toLowerCase()}`];
            let btnClass = "w-full text-right p-4 rounded-xl border-2 border-gray-100 hover:bg-gray-50 hover:border-indigo-200 transition-all font-bold text-gray-700";
            
            if (isAnswered) {
              if (key === quiz.correct_option) btnClass = "w-full text-right p-4 rounded-xl bg-emerald-100 border-2 border-emerald-500 text-emerald-900 font-black";
              else if (key === selectedOption) btnClass = "w-full text-right p-4 rounded-xl bg-red-50 border-2 border-red-500 text-red-800 font-bold opacity-70 line-through";
              else btnClass = "w-full text-right p-4 rounded-xl bg-gray-50 border-2 border-gray-100 text-gray-400 font-bold opacity-50";
            }

            return (
              <button key={key} disabled={isAnswered} onClick={() => handleAnswer(key)} className={btnClass}>
                {optionText}
              </button>
            );
          })}
        </div>

        {quiz.hint && !isAnswered && (
          <div className="mt-6 flex items-start gap-2 bg-amber-50 p-3 rounded-xl text-amber-700 text-xs font-bold border border-amber-200">
            <span>💡</span> <p>{quiz.hint}</p>
          </div>
        )}

        {isAnswered && quiz.explanation && (
          <div className={`mt-6 p-4 rounded-xl text-sm font-bold animate-in slide-in-from-bottom-4 ${selectedOption === quiz.correct_option ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-blue-50 text-blue-800 border border-blue-200'}`}>
            <span className="block mb-1 opacity-70">📚 التفسير العلمي:</span>
            {quiz.explanation}
          </div>
        )}
      </div>
    </div>
  );
};

// ==========================================
// 2. لعبة تطابق الذاكرة الطبية (Memory Match)
// ==========================================
const MemoryGame = ({ onWin, onExit }: any) => {
  const icons = [Stethoscope, Pill, Syringe, HeartPulse, Activity, Cross];
  const [cards, setCards] = useState<any[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [solved, setSolved] = useState<number[]>([]);
  const [disabled, setDisabled] = useState(false);

  useEffect(() => {
    // تجهيز الكروت (كل أيقونة مرتين) وخلطها
    const shuffled = [...icons, ...icons]
      .sort(() => Math.random() - 0.5)
      .map((Icon, index) => ({ id: index, Icon }));
    setCards(shuffled);
  }, []);

  const handleClick = (index: number) => {
    if (disabled || flipped.includes(index) || solved.includes(index)) return;
    const newFlipped = [...flipped, index];
    setFlipped(newFlipped);

    if (newFlipped.length === 2) {
      setDisabled(true);
      const match = cards[newFlipped[0]].Icon === cards[newFlipped[1]].Icon;
      if (match) {
        const newSolved = [...solved, ...newFlipped];
        setSolved(newSolved);
        setFlipped([]);
        setDisabled(false);
        if (newSolved.length === cards.length) setTimeout(onWin, 500); // الفوز!
      } else {
        setTimeout(() => {
          setFlipped([]);
          setDisabled(false);
        }, 1000); // إخفاء بعد ثانية إذا أخطأ
      }
    }
  };

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 max-w-lg mx-auto w-full animate-in zoom-in-95">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-black text-indigo-900">تطابق الذاكرة الطبية</h3>
        <button onClick={onExit} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600"><X size={20}/></button>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {cards.map((card, index) => {
          const isFlipped = flipped.includes(index) || solved.includes(index);
          const Icon = card.Icon;
          return (
            <button 
              key={index} 
              onClick={() => handleClick(index)}
              className={`aspect-square flex items-center justify-center rounded-2xl transition-all duration-300 transform ${isFlipped ? 'bg-indigo-100 rotate-y-180 shadow-inner' : 'bg-indigo-600 hover:bg-indigo-700 shadow-md hover:-translate-y-1 cursor-pointer'}`}
            >
              {isFlipped ? <Icon size={32} className="text-indigo-600 animate-in zoom-in" /> : <BrainCircuit size={24} className="text-white/30" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ==========================================
// 3. نادي الترفيه الرئيسي (Arcade Hub)
// ==========================================
export default function ArcadeHub({ employeeProfile }: { employeeProfile: any }) {
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [currentPoints, setCurrentPoints] = useState(employeeProfile?.points || 0);

  // تحديث محلي للنقاط بعد نجاح التحدي
  const handleQuizSuccess = () => setCurrentPoints(prev => prev + 10);

  // واجهة اختيار الألعاب
  if (activeGame === null) {
    return (
      <div className="p-4 md:p-8 max-w-5xl mx-auto text-right" dir="rtl">
        {/* هيدر النادي */}
        <div className="bg-gradient-to-l from-indigo-900 to-purple-800 rounded-[2rem] p-8 text-white shadow-xl mb-8 flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden">
          {/* ديكورات خلفية */}
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-purple-500/30 rounded-full blur-2xl"></div>
          
          <div className="relative z-10 text-center md:text-right">
            <h1 className="text-3xl md:text-4xl font-black mb-2 flex items-center justify-center md:justify-start gap-3">
              <Gamepad2 className="w-10 h-10 text-yellow-400" /> نادي الترفيه والتعلم
            </h1>
            <p className="text-indigo-200 font-bold text-sm md:text-base">العب، استمتع، أجب على تحديات تخصصك، وضاعف نقاطك!</p>
          </div>
          
          <div className="relative z-10 bg-white/10 backdrop-blur-md border border-white/20 px-8 py-4 rounded-3xl flex flex-col items-center">
            <span className="text-indigo-200 text-xs font-black uppercase mb-1">رصيد نقاطك الحالي</span>
            <div className="flex items-center gap-2">
              <Trophy className="w-8 h-8 text-yellow-400" />
              <span className="text-4xl font-black text-white tracking-tighter">{currentPoints}</span>
            </div>
          </div>
        </div>

        <h3 className="text-xl font-black text-gray-800 mb-6">🎮 اختر اللعبة لتطوير مهاراتك:</h3>

        {/* قائمة الألعاب المتوفرة */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* كارت لعبة الذاكرة */}
          <div onClick={() => setActiveGame('memory')} className="group bg-white p-6 rounded-[2rem] border border-gray-100 hover:border-indigo-200 hover:shadow-xl transition-all cursor-pointer relative overflow-hidden">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-indigo-50 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out z-0"></div>
            <div className="relative z-10 flex gap-4">
              <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
                <BrainCircuit size={32} />
              </div>
              <div>
                <h4 className="text-lg font-black text-gray-800 mb-1">تطابق الذاكرة الطبية</h4>
                <p className="text-xs text-gray-500 font-bold mb-4 leading-relaxed">نشط ذاكرتك البصرية وتعرف على الأدوات الطبية المتطابقة في أسرع وقت.</p>
                <span className="inline-flex items-center gap-1 text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full">
                  لعبة فردية <ChevronRight size={12}/>
                </span>
              </div>
            </div>
          </div>

          {/* كارت لعبة قريباً */}
          <div className="bg-gray-50 p-6 rounded-[2rem] border border-dashed border-gray-200 relative overflow-hidden opacity-70">
             <div className="flex gap-4 items-center h-full">
              <div className="w-16 h-16 bg-gray-200 text-gray-400 rounded-2xl flex items-center justify-center shrink-0">
                <Gamepad2 size={32} />
              </div>
              <div>
                <h4 className="text-lg font-black text-gray-600 mb-1">تيك تاك تو (أطباء ضد تمريض)</h4>
                <p className="text-xs text-gray-400 font-bold">لعبة جماعية تنافسية يتم تطويرها حالياً...</p>
                <span className="inline-block mt-3 text-[10px] font-black text-gray-500 bg-gray-200 px-3 py-1 rounded-full">قريباً ⏳</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 flex items-center justify-center" dir="rtl">
      {/* مشغل اللعبة */}
      {activeGame === 'memory' && (
        <MemoryGame 
          onExit={() => setActiveGame(null)} 
          onWin={() => {
            setActiveGame(null); // العودة للقائمة
            setShowQuizModal(true); // فتح التحدي الذكي
          }} 
        />
      )}

      {/* المودال الذكي يفتح عند الفوز */}
      {showQuizModal && (
        <VictoryQuizModal 
          employee={employeeProfile} 
          onClose={() => setShowQuizModal(false)}
          onSuccess={handleQuizSuccess} 
        />
      )}
    </div>
  );
}
