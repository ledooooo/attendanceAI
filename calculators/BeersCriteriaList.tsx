import React, { useState } from 'react';
import { ArrowRight, ShieldAlert, BookOpen, Save, Loader2, ExternalLink, Info } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

interface Props { onBack?: () => void; }

// ─── SVG Icon ─────────────────────────────────────────────────────────────────
const CHA2Icon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
    <rect width="48" height="48" rx="14" fill="#FFF1F2"/>
    <path d="M24 38C24 38 11 30.5 11 21.5C11 17.358 14.358 14 18.5 14C20.896 14 23.013 15.15 24 16.95C24.987 15.15 27.104 14 29.5 14C33.642 14 37 17.358 37 21.5C37 30.5 24 38 24 38Z" fill="#FECDD3" stroke="#F43F5E" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M19 23H23L24.5 20L26 25L27.5 22H29" stroke="#E11D48" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

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

    // تصنيف الخطر الحقيقي (بدون نقطة الأنثى المعزولة)
    const maleScore = female ? score - 1 : score;
    let rec = '', color = '', bg = '', strokeRisk = '';

    if (maleScore === 0 || (female && score === 1 && maleScore === 0)) {
      rec = 'خطر منخفض جداً — لا يُنصح بأدوية السيولة (OAC)';
      color = 'text-green-700'; bg = 'bg-green-50 border-green-200';
      strokeRisk = '~0.2% / سنة';
    } else if (maleScore === 1 || (female && maleScore === 1)) {
      rec = 'خطر منخفض–متوسط — يمكن النظر في مضادات التخثر حسب تقدير الطبيب والمريض';
      color = 'text-orange-600'; bg = 'bg-orange-50 border-orange-200';
      strokeRisk = '~0.6–0.9% / سنة';
    } else {
      rec = 'خطر مرتفع — يُنصح بشدة بوصف مضادات التخثر الفموية (OAC)';
      color = 'text-red-700'; bg = 'bg-red-50 border-red-200';
      strokeRisk = score >= 6 ? '>9% / سنة' : score >= 4 ? '~4% / سنة' : '~2% / سنة';
    }

    setResult({ score, rec, color, bg, strokeRisk });
  };

  const saveResult = async () => {
    if (!result) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول');
      await supabase.from('saved_calculations').insert({
        user_id: user.id, title: 'مقياس CHA₂DS₂-VASc',
        result: `النقاط: ${result.score}`, input_data: { score: result.score }
      });
      toast.success('تم الحفظ');
    } catch (err: any) { toast.error(err.message); } finally { setLoading(false); }
  };

  const factors = [
    { s: female, f: setFemale, l: 'الجنس: أنثى', pts: '+1', note: 'لا تُعدّ عاملاً مستقلاً للخطر' },
    { s: chf, f: setChf, l: 'فشل القلب الاحتقاني / اعتلال عضلة القلب', pts: '+1', note: '' },
    { s: htn, f: setHtn, l: 'ارتفاع ضغط الدم', pts: '+1', note: '' },
    { s: dm, f: setDm, l: 'مرض السكري', pts: '+1', note: '' },
    { s: stroke, f: setStroke, l: 'جلطة دماغية سابقة أو TIA أو جلطة انسدادية', pts: '+2', note: 'أعلى عوامل الخطر' },
    { s: vasc, f: setVasc, l: 'أمراض الأوعية الدموية (احتشاء عضلة القلب، الشريان الأورطي، الشريان المحيطي)', pts: '+1', note: '' },
  ];

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 pb-10">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-5">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border"><ArrowRight className="w-5 h-5" /></button>}
        <div className="flex items-center gap-3">
          <CHA2Icon />
          <div>
            <h2 className="text-xl font-black text-gray-800">مقياس CHA₂DS₂-VASc</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-bold bg-red-50 text-red-600 px-2 py-0.5 rounded border border-red-100">للأطباء فقط ⚕️</span>
              <span className="text-xs text-gray-400 font-semibold">خطر السكتة الدماغية</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Info ── */}
      <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 mb-5 flex gap-3 text-blue-800">
        <Info className="w-5 h-5 shrink-0 mt-0.5 text-blue-500" />
        <div className="text-xs leading-relaxed">
          <p className="font-bold mb-1">الاستخدام السريري</p>
          <p>يُستخدم لتقييم خطر السكتة الدماغية في مرضى الرجفان الأذيني غير الصمامي (Non-valvular AF)، وتحديد الحاجة لمضادات التخثر الفموية وفق إرشادات ACC/AHA/ESC.</p>
        </div>
      </div>

      {/* ── Form ── */}
      <div className="bg-white p-5 rounded-[2rem] shadow-sm border space-y-2.5">

        {/* Age */}
        <div>
          <p className="text-xs font-black text-gray-500 mb-2">الفئة العمرية</p>
          <div className="flex bg-gray-50 p-1 rounded-xl">
            {[
              { v: 'under65', l: 'أقل من 65', pts: '0' },
              { v: '65-74', l: '65 – 74', pts: '+1' },
              { v: '75+', l: '75 فأكثر', pts: '+2' },
            ].map(btn => (
              <button key={btn.v} onClick={() => setAge(btn.v)}
                className={`flex-1 py-2.5 text-xs font-bold rounded-lg flex flex-col items-center transition-all ${age === btn.v ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}>
                <span>{btn.l}</span>
                <span className="text-[9px] opacity-70">{btn.pts}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Factors */}
        {factors.map((item, idx) => (
          <label key={idx} className={`flex items-center gap-3 p-3.5 border-2 rounded-xl cursor-pointer transition-all ${item.s ? 'border-red-400 bg-red-50' : 'border-gray-100 hover:bg-gray-50'}`}>
            <input type="checkbox" checked={item.s} onChange={e => item.f(e.target.checked)} className="w-5 h-5 accent-red-600 shrink-0" />
            <div className="flex-1">
              <span className="font-bold text-xs text-gray-800">{item.l}</span>
              {item.note && <p className="text-[9px] text-gray-400 mt-0.5">{item.note}</p>}
            </div>
            <span className={`text-sm font-black shrink-0 ${item.s ? 'text-red-600' : 'text-gray-300'}`}>{item.pts}</span>
          </label>
        ))}

        <button onClick={calculate} className="w-full bg-gray-800 text-white font-black py-3.5 rounded-xl mt-2 hover:bg-gray-900 active:scale-95 transition-all">
          احسب درجة الخطر
        </button>
      </div>

      {/* ── Result ── */}
      {result && (
        <div className={`mt-5 p-6 rounded-[2rem] border-2 text-center animate-in slide-in-from-bottom-4 ${result.bg}`}>
          <p className="text-xs text-gray-400 font-bold mb-1">النقاط الإجمالية (من 9)</p>
          <div className={`text-6xl font-black mb-1 ${result.color}`}>{result.score}</div>

          {/* Score bar */}
          <div className="flex gap-1 justify-center mb-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className={`h-2 w-5 rounded-full ${i < result.score ? result.color.replace('text-', 'bg-') : 'bg-gray-200'}`} />
            ))}
          </div>

          <div className="bg-white/60 p-3 rounded-xl mb-2">
            <p className={`text-xs font-black leading-relaxed ${result.color}`}>{result.rec}</p>
          </div>
          <p className="text-[10px] text-gray-500 font-bold">تقدير خطر السكتة: <span className={`font-black ${result.color}`}>{result.strokeRisk}</span></p>

          <button onClick={saveResult} disabled={loading}
            className="w-full mt-4 flex justify-center gap-2 text-sm bg-white text-red-700 px-5 py-3 rounded-xl font-bold border hover:bg-red-50 transition-colors">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ
          </button>
        </div>
      )}

      {/* ── Sources ── */}
      <div className="mt-6 p-4 bg-gray-50 rounded-2xl border border-gray-100">
        <p className="flex items-center gap-1.5 text-xs font-black text-gray-600 mb-3"><BookOpen className="w-3.5 h-3.5"/> المصادر العلمية</p>
        <div className="space-y-2">
          {[
            { title: 'ESC Guidelines — Atrial Fibrillation Management 2020', url: 'https://www.escardio.org/Guidelines/Clinical-Practice-Guidelines/Atrial-Fibrillation' },
            { title: 'ACC/AHA Guideline on Atrial Fibrillation 2023', url: 'https://www.acc.org/guidelines' },
            { title: 'Lip GY et al. — Refining Clinical Risk Stratification (Chest, 2010)', url: 'https://pubmed.ncbi.nlm.nih.gov/19762550/' },
          ].map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-[10px] text-blue-600 font-semibold hover:underline">
              <ExternalLink className="w-3 h-3 shrink-0" />{s.title}
            </a>
          ))}
        </div>
      </div>

    </div>
  );
}
