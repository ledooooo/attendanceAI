import React, { useState } from 'react';
import { Activity, ArrowRight, ShieldAlert, BookOpen, Save, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

interface Props { onBack?: () => void; }

export default function CentorScoreCalculator({ onBack }: Props) {
  const [age, setAge] = useState('15-44');
  const [exudate, setExudate] = useState(false);
  const [nodes, setNodes] = useState(false);
  const [fever, setFever] = useState(false);
  const [noCough, setNoCough] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const calculate = () => {
    let score = 0;
    if (exudate) score += 1;
    if (nodes) score += 1;
    if (fever) score += 1;
    if (noCough) score += 1;

    if (age === '3-14') score += 1;
    else if (age === '45+') score -= 1;

    let recommendation = '';
    let color = '';
    if (score <= 1) { recommendation = 'لا داعي للمضاد الحيوي أو المسحة. (الخطر < 10%)'; color = 'text-green-600'; }
    else if (score === 2 || score === 3) { recommendation = 'يُنصح بعمل مسحة (Rapid Strep Test). (الخطر 15-35%)'; color = 'text-orange-500'; }
    else { recommendation = 'يُنصح ببدء المضاد الحيوي التجريبي أو عمل مسحة. (الخطر 50%+)'; color = 'text-red-600'; }

    setResult({ score, recommendation, color });
  };

  const saveResult = async () => {
    if (!result) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول');
      await supabase.from('saved_calculations').insert({
        user_id: user.id, title: 'مقياس سينتور (Centor)',
        result: `النقاط: ${result.score} | ${result.recommendation}`, input_data: { age, exudate, nodes, fever, noCough }
      });
      toast.success('تم الحفظ بنجاح');
    } catch (err: any) { toast.error(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 pb-10">
      <div className="flex items-center gap-3 mb-4">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border"><ArrowRight className="w-5 h-5 text-gray-600" /></button>}
        <div className="flex items-center gap-2">
          <div className="p-2 bg-red-100 text-red-700 rounded-xl"><ShieldAlert className="w-5 h-5" /></div>
          <div>
            <h2 className="text-lg font-black text-gray-800">مقياس سينتور المطور</h2>
            <span className="text-[10px] font-bold bg-red-50 text-red-600 px-2 py-0.5 rounded border border-red-100">مخصص للأطباء فقط</span>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 mb-4 text-xs text-blue-800 leading-relaxed">
        <p className="font-bold flex items-center gap-1.5 mb-1"><BookOpen className="w-4 h-4"/> الاستخدام والمصادر:</p>
        يُستخدم لتقييم احتمالية التهاب الحلق البكتيري (GAS) لتجنب الوصف العشوائي للمضادات الحيوية.<br/>
        <span className="font-bold text-[10px] text-blue-600/80 mt-1 block">* المرجع: IDSA (Infectious Diseases Society of America) Guidelines.</span>
      </div>

      <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-gray-100 mb-4">
        <div className="mb-4">
          <label className="text-xs font-bold text-gray-500 mb-2 block">عمر المريض</label>
          <div className="flex bg-gray-50 p-1 rounded-xl">
            <button onClick={()=>setAge('3-14')} className={`flex-1 py-2 text-sm font-bold rounded-lg ${age==='3-14' ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}>3 - 14 سنة</button>
            <button onClick={()=>setAge('15-44')} className={`flex-1 py-2 text-sm font-bold rounded-lg ${age==='15-44' ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}>15 - 44 سنة</button>
            <button onClick={()=>setAge('45+')} className={`flex-1 py-2 text-sm font-bold rounded-lg ${age==='45+' ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}>45 فأكثر</button>
          </div>
        </div>

        <div className="space-y-2">
          {[
            { state: exudate, set: setExudate, label: 'تضخم أو إفرازات صديدية على اللوزتين' },
            { state: nodes, set: setNodes, label: 'تورم أو ألم في الغدد الليمفاوية بالرقبة' },
            { state: fever, set: setFever, label: 'تاريخ حمى (أكثر من 38°C)' },
            { state: noCough, set: setNoCough, label: 'غياب السعال (لا يوجد كحة)' },
          ].map((item, i) => (
            <label key={i} className={`flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition-all ${item.state ? 'border-red-500 bg-red-50' : 'border-gray-100 hover:bg-gray-50'}`}>
              <input type="checkbox" checked={item.state} onChange={(e)=>item.set(e.target.checked)} className="w-5 h-5 accent-red-600"/>
              <span className="font-bold text-sm text-gray-700">{item.label}</span>
            </label>
          ))}
        </div>

        <button onClick={calculate} className="w-full bg-gray-800 text-white font-black py-3.5 rounded-xl mt-4 hover:bg-gray-900 active:scale-95 transition-all">احسب النقاط</button>
      </div>

      {result && (
        <div className="bg-white p-6 rounded-[2rem] border-2 border-red-100 shadow-sm text-center animate-in slide-in-from-bottom-4">
           <p className="text-gray-500 text-sm font-bold mb-1">النتيجة (Modified Centor Score)</p>
           <div className={`text-5xl font-black mb-2 ${result.color}`}>{result.score}</div>
           <p className={`text-sm font-black bg-gray-50 p-3 rounded-xl border ${result.color}`}>{result.recommendation}</p>
           
           <button onClick={saveResult} disabled={loading} className="w-full mt-4 flex items-center justify-center gap-2 text-sm bg-red-50 text-red-700 px-5 py-3 rounded-xl font-bold hover:bg-red-100 transition-colors">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ بالملف
           </button>
        </div>
      )}
    </div>
  );
}
