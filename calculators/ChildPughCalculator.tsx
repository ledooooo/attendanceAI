import React, { useState } from 'react';
import { ArrowRight, BookOpen, Save, Loader2, ExternalLink, Info } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

interface Props { onBack?: () => void; }

// ─── SVG Icon ─────────────────────────────────────────────────────────────────
const LiverIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
    <rect width="48" height="48" rx="14" fill="#FFF7ED"/>
    <path d="M10 22C10 16 14 11 22 11C30 11 38 15 38 24C38 32 32 37 24 37C16 37 10 32 10 26V22Z" fill="#FED7AA" stroke="#F97316" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M22 18C22 18 20 22 22 26C24 30 22 34 22 34" stroke="#EA580C" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M22 26C22 26 26 25 28 28" stroke="#EA580C" strokeWidth="1.3" strokeLinecap="round"/>
    <circle cx="29" cy="19" r="3" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="1.2"/>
    <path d="M28 19H30M29 18V20" stroke="#D97706" strokeWidth="1" strokeLinecap="round"/>
  </svg>
);

// ─── Option Selector ──────────────────────────────────────────────────────────
const OptionSelector = ({ label, unit, options, value, onChange }: any) => (
  <div>
    <div className="flex items-center justify-between mb-2">
      <label className="text-xs font-black text-gray-600">{label}</label>
      {unit && <span className="text-[9px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{unit}</span>}
    </div>
    <div className="grid grid-cols-3 gap-2">
      {options.map((opt: any) => (
        <button key={opt.value} onClick={() => onChange(opt.value)}
          className={`py-2.5 px-2 rounded-xl text-[11px] font-bold border-2 transition-all leading-tight text-center ${value === opt.value ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-100 bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
          <div>{opt.label}</div>
          <div className={`text-[9px] mt-0.5 font-black ${value === opt.value ? 'text-orange-500' : 'text-gray-300'}`}>{opt.pts}</div>
        </button>
      ))}
    </div>
  </div>
);

export default function ChildPughCalculator({ onBack }: Props) {
  const [bilirubin, setBilirubin] = useState(1);
  const [albumin, setAlbumin] = useState(1);
  const [inr, setInr] = useState(1);
  const [ascites, setAscites] = useState(1);
  const [enceph, setEnceph] = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const calculate = () => {
    const score = bilirubin + albumin + inr + ascites + enceph;
    let grade = '', color = '', bg = '', survival1y = '', survival2y = '', tip = '';
    if (score <= 6) {
      grade = 'A'; color = 'text-green-700'; bg = 'bg-green-50 border-green-200';
      survival1y = '100%'; survival2y = '85%';
      tip = 'قصور كبدي خفيف. المريض مرشح للعمليات الجراحية الاختيارية.';
    } else if (score <= 9) {
      grade = 'B'; color = 'text-orange-600'; bg = 'bg-orange-50 border-orange-200';
      survival1y = '80%'; survival2y = '60%';
      tip = 'قصور كبدي متوسط. يستدعي مراقبة دقيقة وتعديل جرعات الأدوية.';
    } else {
      grade = 'C'; color = 'text-red-700'; bg = 'bg-red-50 border-red-200';
      survival1y = '45%'; survival2y = '35%';
      tip = 'قصور كبدي شديد. يُنصح بتقييم زراعة الكبد ورعاية داعمة مكثفة.';
    }
    setResult({ score, grade, color, bg, survival1y, survival2y, tip });
  };

  const saveResult = async () => {
    if (!result) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول');
      await supabase.from('saved_calculations').insert({
        user_id: user.id, title: 'مقياس Child-Pugh',
        result: `الدرجة: ${result.grade} — النقاط: ${result.score}`,
        input_data: { bilirubin, albumin, inr, ascites, enceph }
      });
      toast.success('تم الحفظ ✅');
    } catch (err: any) { toast.error(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 pb-10">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-5">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border"><ArrowRight className="w-5 h-5 text-gray-600" /></button>}
        <div className="flex items-center gap-3">
          <LiverIcon />
          <div>
            <h2 className="text-xl font-black text-gray-800">مقياس Child-Pugh</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-bold bg-orange-50 text-orange-600 px-2 py-0.5 rounded border border-orange-100">للأطباء فقط ⚕️</span>
              <span className="text-xs text-gray-400 font-semibold">تصنيف قصور الكبد</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Info ── */}
      <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 mb-5 flex gap-3 text-orange-800">
        <Info className="w-5 h-5 shrink-0 mt-0.5 text-orange-500" />
        <div className="text-xs leading-relaxed">
          <p className="font-bold mb-1">الاستخدام السريري</p>
          <p>يُصنّف درجة قصور الكبد (A/B/C) بناءً على 5 معايير سريرية ومخبرية، ويُستخدم لتحديد تعديل جرعات الأدوية، وتقييم مخاطر الجراحة، والتحقق من الحاجة لزراعة الكبد.</p>
        </div>
      </div>

      {/* ── Form ── */}
      <div className="bg-white p-5 rounded-[2rem] shadow-sm border space-y-5">
        <OptionSelector label="البيليروبين الكلي" unit="mg/dL"
          value={bilirubin} onChange={setBilirubin}
          options={[{ value: 1, label: '< 2', pts: '1 نقطة' }, { value: 2, label: '2 – 3', pts: '2 نقاط' }, { value: 3, label: '> 3', pts: '3 نقاط' }]} />

        <OptionSelector label="الألبومين" unit="g/dL"
          value={albumin} onChange={setAlbumin}
          options={[{ value: 1, label: '> 3.5', pts: '1 نقطة' }, { value: 2, label: '2.8 – 3.5', pts: '2 نقاط' }, { value: 3, label: '< 2.8', pts: '3 نقاط' }]} />

        <OptionSelector label="مؤشر INR (زمن البروثرومبين)" unit="INR"
          value={inr} onChange={setInr}
          options={[{ value: 1, label: '< 1.7', pts: '1 نقطة' }, { value: 2, label: '1.7 – 2.3', pts: '2 نقاط' }, { value: 3, label: '> 2.3', pts: '3 نقاط' }]} />

        <OptionSelector label="الاستسقاء البطني (Ascites)" unit=""
          value={ascites} onChange={setAscites}
          options={[{ value: 1, label: 'لا يوجد', pts: '1 نقطة' }, { value: 2, label: 'خفيف / متحكم', pts: '2 نقاط' }, { value: 3, label: 'شديد / مقاوم', pts: '3 نقاط' }]} />

        <OptionSelector label="الاعتلال الدماغي الكبدي (Encephalopathy)" unit=""
          value={enceph} onChange={setEnceph}
          options={[{ value: 1, label: 'لا يوجد', pts: '1 نقطة' }, { value: 2, label: 'درجة 1 – 2', pts: '2 نقاط' }, { value: 3, label: 'درجة 3 – 4', pts: '3 نقاط' }]} />

        {/* Score preview */}
        <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border">
          <span className="text-xs font-bold text-gray-500">المجموع الحالي</span>
          <span className="text-xl font-black text-gray-800">{bilirubin + albumin + inr + ascites + enceph} <span className="text-xs text-gray-400">/ 15</span></span>
        </div>

        <button onClick={calculate} className="w-full bg-gray-800 text-white font-black py-3.5 rounded-xl hover:bg-gray-900 active:scale-95 transition-all">
          حساب التصنيف
        </button>
      </div>

      {/* ── Result ── */}
      {result && (
        <div className={`mt-5 p-6 rounded-[2rem] border-2 text-center animate-in slide-in-from-bottom-4 ${result.bg}`}>
          <p className="text-xs text-gray-400 font-bold mb-1">التصنيف</p>
          <div className={`text-7xl font-black mb-1 ${result.color}`}>{result.grade}</div>
          <p className="text-xs text-gray-500 font-bold mb-3">إجمالي النقاط: <span className="font-black text-gray-700">{result.score} / 15</span></p>

          {/* Survival stats */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            {[{ l: 'معدل البقاء (سنة)', v: result.survival1y }, { l: 'معدل البقاء (سنتان)', v: result.survival2y }].map((s, i) => (
              <div key={i} className="bg-white/60 p-3 rounded-xl border border-white">
                <p className="text-[9px] text-gray-400 font-bold mb-1">{s.l}</p>
                <p className={`text-xl font-black ${result.color}`}>{s.v}</p>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-600 bg-white/50 p-3 rounded-xl font-semibold leading-relaxed">{result.tip}</p>

          <button onClick={saveResult} disabled={loading}
            className="mt-4 w-full flex items-center justify-center gap-2 text-sm bg-white px-5 py-3 rounded-xl font-bold text-gray-800 border hover:bg-gray-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ
          </button>
        </div>
      )}

      {/* ── Sources ── */}
      <div className="mt-6 p-4 bg-gray-50 rounded-2xl border border-gray-100">
        <p className="flex items-center gap-1.5 text-xs font-black text-gray-600 mb-3"><BookOpen className="w-3.5 h-3.5"/> المصادر العلمية</p>
        <div className="space-y-2">
          {[
            { title: 'AASLD Practice Guidelines — Liver Cirrhosis Management', url: 'https://www.aasld.org/practice-guidelines' },
            { title: 'EASL Clinical Practice Guidelines — Decompensated Cirrhosis 2021', url: 'https://www.journal-of-hepatology.eu/article/S0168-8278(21)00398-6/fulltext' },
            { title: 'Pugh RN et al. — Transection of oesophagus (Lancet, 1973)', url: 'https://pubmed.ncbi.nlm.nih.gov/4123484/' },
          ].map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-[10px] text-orange-600 font-semibold hover:underline">
              <ExternalLink className="w-3 h-3 shrink-0" />{s.title}
            </a>
          ))}
        </div>
      </div>

    </div>
  );
}
