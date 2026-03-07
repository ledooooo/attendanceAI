import React, { useState } from 'react';
import { Heart, ArrowRight, ShieldAlert, BookOpen, Save, Loader2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';

interface Props { onBack?: () => void; }

export default function CHADSVASCCalculator({ onBack }: Props) {
  const [age, setAge] = useState('under65');
  const [female, setFemale] = useState(false);
  const [chf, setChf] = useState(false);
  const [htn, setHtn] = useState(false);
  const [stroke, setStroke] = useState(false);
  const [dm, setDm] = useState(false);
  const [vasc, setVasc] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const calculate = () => {
    let score = 0;
    if (chf) score += 1; if (htn) score += 1; if (dm) score += 1; if (vasc) score += 1;
    if (stroke) score += 2;
    if (female) score += 1;
    if (age === '65-74') score += 1; else if (age === '75+') score += 2;

    let rec = ''; let color = '';
    if (score === 0 || (female && score === 1)) { rec = 'خطر منخفض جداً. لا ينصح بأدوية السيولة (OAC).'; color = 'text-green-600'; }
    else if (score === 1 || (female && score === 2)) { rec = 'خطر متوسط. يمكن النظر في مضادات التخثر حسب حالة المريض.'; color = 'text-orange-500'; }
    else { rec = 'خطر مرتفع. يُنصح بشدة بوصف مضادات التخثر (OAC).'; color = 'text-red-600'; }

    setResult({ score, rec, color });
  };

  const saveResult = async () => {
    if (!result) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول');
      await supabase.from('saved_calculations').insert({
        user_id: user.id, title: 'مقياس السكتة (CHA2DS2-VASc)', result: `النقاط: ${result.score}`, input_data: { score: result.score }
      });
      toast.success('تم الحفظ');
    } catch (err: any) { toast.error(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 pb-10">
      <div className="flex items-center gap-3 mb-4">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border"><ArrowRight className="w-5 h-5" /></button>}
        <div className="flex items-center gap-2">
          <div className="p-2 bg-red-100 text-red-700 rounded-xl"><ShieldAlert className="w-5 h-5" /></div>
          <div><h2 className="text-lg font-black text-gray-800">مقياس CHA2DS2-VASc</h2><span className="text-[10px] font-bold bg-red-50 text-red-600 px-2 py-0.5 rounded border border-red-100">للأطباء فقط</span></div>
        </div>
      </div>

      <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 mb-4 text-xs text-blue-800 leading-relaxed">
        <p className="font-bold flex items-center gap-1.5 mb-1"><BookOpen className="w-4 h-4"/> الاستخدام والمصادر:</p>
        تقييم خطر السكتة الدماغية لمرضى الرفرفة الأذينية (AF) لتحديد الحاجة لأدوية السيولة.<br/>
        <span className="font-bold text-[10px] text-blue-600/80 mt-1 block">* المرجع: AHA / ACC / ESC.</span>
      </div>

      <div className="bg-white p-5 rounded-[2rem] shadow-sm border space-y-2">
        <div className="flex bg-gray-50 p-1 rounded-xl mb-3">
          <button onClick={()=>setAge('under65')} className={`flex-1 py-2 text-xs font-bold rounded-lg ${age==='under65'?'bg-white shadow text-red-600':'text-gray-500'}`}>أقل من 65</button>
          <button onClick={()=>setAge('65-74')} className={`flex-1 py-2 text-xs font-bold rounded-lg ${age==='65-74'?'bg-white shadow text-red-600':'text-gray-500'}`}>65 - 74 (+1)</button>
          <button onClick={()=>setAge('75+')} className={`flex-1 py-2 text-xs font-bold rounded-lg ${age==='75+'?'bg-white shadow text-red-600':'text-gray-500'}`}>75 فأكثر (+2)</button>
        </div>
        {[
          { s: female, f: setFemale, l: 'الجنس: أنثى (+1)' },
          { s: chf, f: setChf, l: 'فشل القلب الاحتقاني / ضعف العضلة (+1)' },
          { s: htn, f: setHtn, l: 'ارتفاع ضغط الدم (+1)' },
          { s: dm, f: setDm, l: 'مرض السكري (+1)' },
          { s: stroke, f: setStroke, l: 'جلطة دماغية سابقة أو TIA (+2)' },
          { s: vasc, f: setVasc, l: 'أمراض الأوعية الدموية (جلطة قلب، الخ) (+1)' },
        ].map((i, idx) => (
          <label key={idx} className={`flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer ${i.s ? 'border-red-500 bg-red-50' : 'hover:bg-gray-50'}`}>
            <input type="checkbox" checked={i.s} onChange={e=>i.f(e.target.checked)} className="w-5 h-5 accent-red-600"/><span className="font-bold text-sm">{i.l}</span>
          </label>
        ))}
        <button onClick={calculate} className="w-full bg-gray-800 text-white font-black py-3.5 rounded-xl mt-4">التقييم</button>
      </div>

      {result && (
        <div className="bg-white p-6 mt-4 rounded-[2rem] border-2 border-red-100 text-center animate-in slide-in-from-bottom-4">
           <div className={`text-5xl font-black mb-2 ${result.color}`}>{result.score} <span className="text-lg">نقاط</span></div>
           <p className={`text-sm font-black bg-gray-50 p-3 rounded-xl border ${result.color}`}>{result.rec}</p>
           <button onClick={saveResult} disabled={loading} className="w-full mt-4 flex justify-center gap-2 text-sm bg-red-50 text-red-700 px-5 py-3 rounded-xl font-bold"><Save className="w-4 h-4"/> حفظ</button>
        </div>
      )}
    </div>
  );
}
