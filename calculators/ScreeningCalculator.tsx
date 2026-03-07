import React, { useState } from 'react';
import { Stethoscope, ArrowRight, CheckSquare, Save, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

interface Props { onBack?: () => void; }

export default function ScreeningCalculator({ onBack }: Props) {
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('male');
  const [result, setResult] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const calculate = () => {
    const a = parseInt(age);
    if (!a) { toast.error('يرجى إدخال العمر'); return; }
    
    const tests = [];
    tests.push('قياس ضغط الدم (مرة كل سنتين على الأقل)');
    tests.push('فحص الأسنان (كل 6 شهور)');

    if (a >= 35 || (a >= 20 && gender==='male')) tests.push('تحليل دهون كامل (Lipid Profile) كل 5 سنوات');
    if (a >= 40) tests.push('تحليل سكر صائم وتراكمي (كل 3 سنوات)');
    if (a >= 45) tests.push('فحص سرطان القولون (تحليل براز سنوي أو منظار)');
    
    if (gender === 'female') {
      if (a >= 21) tests.push('مسحة عنق الرحم (Pap Smear) كل 3 سنوات');
      if (a >= 40) tests.push('أشعة الماموجرام للثدي كل سنة أو سنتين');
      if (a >= 65) tests.push('فحص هشاشة العظام (DEXA Scan)');
    }

    if (gender === 'male') {
      if (a >= 50) tests.push('فحص البروستاتا (PSA) واستشارة الطبيب');
      if (a >= 65) tests.push('فحص تمدد الشريان الأورطي البطني (للمدخنين)');
    }

    setResult(tests);
  };

  const saveResult = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول');
      await supabase.from('saved_calculations').insert({
        user_id: user.id, title: 'الفحص الدوري الشامل',
        result: `مقترح: ${result.length} فحوصات (العمر: ${age})`, input_data: { age, gender, tests: result }
      });
      toast.success('تم الحفظ بنجاح ✅');
    } catch (err: any) { toast.error(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center gap-3 mb-6">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50"><ArrowRight className="w-5 h-5 text-gray-600" /></button>}
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl"><Stethoscope className="w-5 h-5" /></div>
          <h2 className="text-xl font-black text-gray-800">الفحص الدوري الشامل</h2>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-4">
        <div className="flex bg-gray-100 p-1.5 rounded-xl">
           <button onClick={()=>setGender('male')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${gender==='male' ? 'bg-white shadow-sm text-emerald-600' : 'text-gray-500'}`}>رجل</button>
           <button onClick={()=>setGender('female')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${gender==='female' ? 'bg-white shadow-sm text-emerald-600' : 'text-gray-500'}`}>امرأة</button>
        </div>
        <div>
           <label className="block text-xs font-bold text-gray-500 mb-1.5">العمر (سنة)</label>
           <input type="number" value={age} onChange={e=>setAge(e.target.value)} className="w-full p-3.5 border bg-gray-50 focus:bg-white rounded-xl outline-none focus:border-emerald-500 font-bold" placeholder="مثال: 45"/>
        </div>
        <button onClick={calculate} className="w-full bg-emerald-600 text-white font-black py-3.5 rounded-xl hover:bg-emerald-700 shadow-md active:scale-95 transition-all mt-2">اعرض الفحوصات</button>
      </div>

      {result.length > 0 && (
        <div className="mt-6 bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm animate-in slide-in-from-bottom-4">
           <h3 className="font-bold text-gray-800 mb-4 text-sm flex items-center gap-2">
             <CheckSquare className="w-4 h-4 text-emerald-500"/> الفحوصات الموصى بها لك:
           </h3>
           <div className="space-y-2 mb-6 max-h-[40vh] overflow-y-auto pr-1 custom-scrollbar">
             {result.map((test, i) => (
               <div key={i} className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 text-emerald-900 text-xs font-bold leading-relaxed">
                  {test}
               </div>
             ))}
           </div>
           
           <button onClick={saveResult} disabled={loading} className="w-full flex items-center justify-center gap-2 text-sm bg-gray-800 text-white px-5 py-3 rounded-xl font-bold hover:bg-gray-900 shadow-md transition-colors">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ القائمة
           </button>
        </div>
      )}
    </div>
  );
}
