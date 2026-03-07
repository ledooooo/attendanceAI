import React, { useState } from 'react';
import { Heart, ArrowRight, AlertTriangle, CheckCircle, Save, Loader2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';

interface Props { onBack?: () => void; }

export default function CVDRiskCalculator({ onBack }: Props) {
  const [gender, setGender] = useState('male');
  const [age, setAge] = useState('');
  const [cholesterol, setCholesterol] = useState('');
  const [hdl, setHdl] = useState('');
  const [systolic, setSystolic] = useState('');
  const [smoker, setSmoker] = useState(false);
  const [diabetes, setDiabetes] = useState(false);
  const [treated, setTreated] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const calculate = () => {
    let points = 0;
    const a = parseInt(age);
    const chol = parseInt(cholesterol);
    const h = parseInt(hdl);
    const sys = parseInt(systolic);

    if (!a || !chol || !h || !sys) {
        toast.error("يرجى إدخال جميع البيانات المطلوبة");
        return;
    }

    if (gender === 'male') {
       if (a <= 34) points -= 9; else if (a <= 39) points -= 4; else if (a <= 44) points += 0; else if (a <= 49) points += 3; else if (a <= 54) points += 6; else if (a <= 59) points += 8; else points += 10;
       if (chol < 160) points += 0; else if (chol < 200) points += 4; else if (chol < 240) points += 7; else points += 9;
       if (smoker) points += 8;
    } else {
       if (a <= 34) points -= 7; else if (a <= 39) points -= 3; else if (a <= 44) points += 0; else if (a <= 49) points += 3; else if (a <= 54) points += 6; else points += 8;
       if (chol < 160) points += 0; else if (chol < 200) points += 4; else if (chol < 240) points += 8; else points += 11;
       if (smoker) points += 9;
    }

    if (h >= 60) points -= 1; else if (h < 40) points += 2; else points += 1;

    if (sys < 120) points += 0; else if (sys < 130) points += (treated ? 1 : 0); else if (sys < 140) points += (treated ? 2 : 1); else points += (treated ? 3 : 2);

    let risk = 1;
    if (points <= 0) risk = 1; else if (points <= 4) risk = 1; else if (points <= 6) risk = 2; else if (points <= 8) risk = 3; else if (points <= 10) risk = 6; else if (points <= 12) risk = 10; else if (points <= 14) risk = 16; else if (points <= 16) risk = 25; else risk = 30;

    if (diabetes) risk = Math.min(risk * 1.5, 99);

    let riskStatus = ''; let statusColor = ''; let bgColor = '';
    if (risk < 10) { riskStatus = 'خطر منخفض'; statusColor = 'text-green-600'; bgColor = 'bg-green-50 border-green-200'; }
    else if (risk <= 20) { riskStatus = 'خطر متوسط'; statusColor = 'text-orange-500'; bgColor = 'bg-orange-50 border-orange-200'; }
    else { riskStatus = 'خطر مرتفع'; statusColor = 'text-red-600'; bgColor = 'bg-red-50 border-red-200'; }

    setResult({ score: Math.round(risk), points, riskStatus, statusColor, bgColor });
  };

  const saveResult = async () => {
    if (!result) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول أولاً');
      await supabase.from('saved_calculations').insert({
        user_id: user.id, title: 'مخاطر القلب (Framingham)',
        result: `${result.score}% - ${result.riskStatus}`, input_data: { age, gender, systolic, cholesterol, hdl, smoker, diabetes }
      });
      toast.success('تم حفظ النتيجة بنجاح ✅');
    } catch (err: any) { toast.error(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 duration-300 pb-10">
      <div className="flex items-center gap-3 mb-6">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50"><ArrowRight className="w-5 h-5 text-gray-600" /></button>}
        <div className="flex items-center gap-2">
          <div className="p-2 bg-rose-100 text-rose-600 rounded-xl"><Heart className="w-5 h-5" /></div>
          <h2 className="text-xl font-black text-gray-800">حاسبة مخاطر القلب (CVD)</h2>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <div className="flex bg-gray-100 p-1.5 rounded-xl col-span-1 md:col-span-2">
             <button onClick={()=>setGender('male')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition ${gender==='male' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>ذكر</button>
             <button onClick={()=>setGender('female')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition ${gender==='female' ? 'bg-white shadow text-pink-600' : 'text-gray-500'}`}>أنثى</button>
           </div>

           <div><label className="text-xs font-bold text-gray-500 block mb-1">العمر</label><input type="number" value={age} onChange={e=>setAge(e.target.value)} className="w-full p-3.5 border bg-gray-50 focus:bg-white focus:border-rose-500 outline-none rounded-xl font-bold" placeholder="مثال: 45"/></div>
           <div><label className="text-xs font-bold text-gray-500 block mb-1">الضغط الانقباضي</label><input type="number" value={systolic} onChange={e=>setSystolic(e.target.value)} className="w-full p-3.5 border bg-gray-50 focus:bg-white focus:border-rose-500 outline-none rounded-xl font-bold" placeholder="120"/></div>
           <div><label className="text-xs font-bold text-gray-500 block mb-1">الكوليسترول الكلي</label><input type="number" value={cholesterol} onChange={e=>setCholesterol(e.target.value)} className="w-full p-3.5 border bg-gray-50 focus:bg-white focus:border-rose-500 outline-none rounded-xl font-bold" placeholder="mg/dL"/></div>
           <div><label className="text-xs font-bold text-gray-500 block mb-1">HDL (الجيد)</label><input type="number" value={hdl} onChange={e=>setHdl(e.target.value)} className="w-full p-3.5 border bg-gray-50 focus:bg-white focus:border-rose-500 outline-none rounded-xl font-bold" placeholder="mg/dL"/></div>

           <div className="col-span-1 md:col-span-2 space-y-2 pt-2">
              <label className="flex items-center gap-3 cursor-pointer p-3 border-2 border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
                <input type="checkbox" checked={smoker} onChange={e=>setSmoker(e.target.checked)} className="w-5 h-5 accent-rose-600"/>
                <span className="font-bold text-sm text-gray-700">مدخن حالياً؟</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-3 border-2 border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
                <input type="checkbox" checked={diabetes} onChange={e=>setDiabetes(e.target.checked)} className="w-5 h-5 accent-rose-600"/>
                <span className="font-bold text-sm text-gray-700">مريض سكري؟</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-3 border-2 border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
                <input type="checkbox" checked={treated} onChange={e=>setTreated(e.target.checked)} className="w-5 h-5 accent-rose-600"/>
                <span className="font-bold text-sm text-gray-700">تتناول علاج للضغط؟</span>
              </label>
           </div>
        </div>

        <button onClick={calculate} className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black py-4 rounded-xl mt-4 transition-all shadow-md active:scale-95">احسب الخطر</button>
      </div>

      {result && (
        <div className={`p-6 rounded-[2rem] border-2 text-center shadow-sm animate-in slide-in-from-bottom-4 ${result.bgColor}`}>
           <p className="text-gray-600 text-xs font-bold mb-2">احتمالية الإصابة بأزمة قلبية (10 سنوات)</p>
           <div className={`text-6xl font-black mb-1 ${result.statusColor}`}>{result.score}%</div>
           <span className={`text-sm font-black bg-white inline-block px-4 py-1.5 rounded-lg shadow-sm border mb-4 ${result.statusColor}`}>{result.riskStatus}</span>
           
           <div className="bg-white/60 p-4 rounded-xl text-right text-[10px] md:text-xs leading-relaxed font-bold text-gray-700 mb-4 border border-white">
             <ul className="list-disc list-inside space-y-1.5">
               <li><strong className="text-green-600">أقل من 10%:</strong> خطر منخفض.</li>
               <li><strong className="text-orange-500">10% - 20%:</strong> خطر متوسط.</li>
               <li><strong className="text-red-600">أكثر من 20%:</strong> خطر مرتفع.</li>
             </ul>
           </div>

           <button onClick={saveResult} disabled={loading} className="w-full flex items-center justify-center gap-2 text-sm bg-white px-5 py-3.5 rounded-xl font-bold text-gray-800 shadow-sm border transition-colors hover:bg-gray-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ النتيجة
           </button>
        </div>
      )}
    </div>
  );
}
