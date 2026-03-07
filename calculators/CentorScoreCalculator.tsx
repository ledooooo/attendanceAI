import React, { useState } from 'react';
import { ArrowRight, BookOpen, Save, Loader2, ExternalLink, Info } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

interface Props { onBack?: () => void; }

// ─── SVG Icon ─────────────────────────────────────────────────────────────────
const ThroatIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
    <rect width="48" height="48" rx="14" fill="#FFF1F2"/>
    {/* Open mouth shape */}
    <path d="M14 20C14 16 18 13 24 13C30 13 34 16 34 20V28C34 32 30 35 24 35C18 35 14 32 14 28V20Z" fill="#FECDD3" stroke="#F43F5E" strokeWidth="1.5"/>
    {/* Tonsils */}
    <ellipse cx="19.5" cy="25" rx="3" ry="4" fill="#FCA5A5" stroke="#EF4444" strokeWidth="1.2"/>
    <ellipse cx="28.5" cy="25" rx="3" ry="4" fill="#FCA5A5" stroke="#EF4444" strokeWidth="1.2"/>
    {/* Uvula */}
    <path d="M24 20V27" stroke="#E11D48" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="24" cy="28" r="1.5" fill="#E11D48"/>
    {/* Exudate dots */}
    <circle cx="19.5" cy="24" r="0.8" fill="white" opacity="0.8"/>
    <circle cx="28.5" cy="24" r="0.8" fill="white" opacity="0.8"/>
  </svg>
);

export default function CentorScoreCalculator({ onBack }: Props) {
  const [age, setAge] = useState('15-44');
  const [exudate, setExudate] = useState(false);
  const [nodes, setNodes] = useState(false);
  const [fever, setFever] = useState(false);
  const [noCough, setNoCough] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Live score
  const liveScore = (() => {
    let s = 0;
    if (exudate) s++; if (nodes) s++; if (fever) s++; if (noCough) s++;
    if (age === '3-14') s++; else if (age === '45+') s--;
    return s;
  })();

  const calculate = () => {
    const score = liveScore;
    let recommendation = '', color = '', bg = '', gasProb = '', action = '';

    if (score <= 1) {
      recommendation = 'خطر منخفض جداً للبكتيريا (GAS)';
      color = 'text-green-700'; bg = 'bg-green-50 border-green-200';
      gasProb = '< 10%'; action = 'لا حاجة لمضاد حيوي أو مسحة. علاج داعم (مسكنات، غرغرة).';
    } else if (score === 2 || score === 3) {
      recommendation = 'خطر متوسط — يُنصح بالتحقق';
      color = 'text-orange-600'; bg = 'bg-orange-50 border-orange-200';
      gasProb = '15–35%'; action = 'إجراء Rapid Antigen Detection Test (RADT). العلاج حسب النتيجة.';
    } else {
      recommendation = 'خطر مرتفع للعدوى البكتيرية';
      color = 'text-red-700'; bg = 'bg-red-50 border-red-200';
      gasProb = '> 50%'; action = 'يُنصح ببدء مضاد حيوي تجريبي (Amoxicillin خط أول) أو تأكيد بالمسحة.';
    }

    setResult({ score, recommendation, color, bg, gasProb, action });
  };

  const saveResult = async () => {
    if (!result) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول');
      await supabase.from('saved_calculations').insert({
        user_id: user.id, title: 'مقياس Centor المطوّر (McIsaac)',
        result: `النقاط: ${result.score} — ${result.recommendation}`,
        input_data: { age, exudate, nodes, fever, noCough }
      });
      toast.success('تم الحفظ بنجاح');
    } catch (err: any) { toast.error(err.message); } finally { setLoading(false); }
  };

  const factors = [
    { state: exudate, set: setExudate, label: 'تضخم أو إفرازات صديدية على اللوزتين', desc: 'Tonsillar exudate or swelling' },
    { state: nodes,   set: setNodes,   label: 'تورم أو ألم في الغدد الليمفاوية الأمامية', desc: 'Tender anterior cervical lymphadenopathy' },
    { state: fever,   set: setFever,   label: 'تاريخ حمى (> 38°C)', desc: 'History of fever' },
    { state: noCough, set: setNoCough, label: 'غياب السعال', desc: 'Absence of cough' },
  ];

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 pb-10">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-5">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border"><ArrowRight className="w-5 h-5 text-gray-600" /></button>}
        <div className="flex items-center gap-3">
          <ThroatIcon />
          <div>
            <h2 className="text-xl font-black text-gray-800">مقياس Centor المطوّر</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-bold bg-red-50 text-red-600 px-2 py-0.5 rounded border border-red-100">للأطباء فقط ⚕️</span>
              <span className="text-xs text-gray-400 font-semibold">McIsaac Score</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Info ── */}
      <div className="bg-red-50 p-4 rounded-2xl border border-red-100 mb-5 flex gap-3 text-red-800">
        <Info className="w-5 h-5 shrink-0 mt-0.5 text-red-400" />
        <div className="text-xs leading-relaxed">
          <p className="font-bold mb-1">الاستخدام السريري</p>
          <p>يُقدّر احتمالية التهاب الحلق البكتيري بـ Group A Streptococcus (GAS)، للحد من الوصف غير المبرر للمضادات الحيوية والمقاومة البكتيرية المتزايدة.</p>
        </div>
      </div>

      {/* ── Form ── */}
      <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-gray-100 space-y-4">

        {/* Age */}
        <div>
          <p className="text-xs font-black text-gray-500 mb-2">عمر المريض</p>
          <div className="flex bg-gray-50 p-1 rounded-xl">
            {[
              { v: '3-14', l: '3 – 14 سنة', pts: '+1' },
              { v: '15-44', l: '15 – 44 سنة', pts: '0' },
              { v: '45+', l: '45+ سنة', pts: '−1' },
            ].map(btn => (
              <button key={btn.v} onClick={() => setAge(btn.v)}
                className={`flex-1 py-2.5 text-[11px] font-bold rounded-lg flex flex-col items-center transition-all ${age === btn.v ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}>
                <span>{btn.l}</span>
                <span className="text-[9px] opacity-60">{btn.pts}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Checkboxes */}
        <div className="space-y-2">
          {factors.map((item, i) => (
            <label key={i} className={`flex items-start gap-3 p-3.5 border-2 rounded-xl cursor-pointer transition-all ${item.state ? 'border-red-400 bg-red-50' : 'border-gray-100 hover:bg-gray-50'}`}>
              <input type="checkbox" checked={item.state} onChange={e => item.set(e.target.checked)} className="w-5 h-5 accent-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-xs text-gray-800">{item.label}</p>
                <p className="text-[9px] text-gray-400 font-semibold mt-0.5">{item.desc}</p>
              </div>
              <span className={`text-sm font-black shrink-0 mr-auto ${item.state ? 'text-red-500' : 'text-gray-200'}`}>+1</span>
            </label>
          ))}
        </div>

        {/* Live score preview */}
        <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border">
          <span className="text-xs font-bold text-gray-500">النقاط الحالية</span>
          <span className="text-xl font-black text-gray-800">{liveScore}</span>
        </div>

        <button onClick={calculate} className="w-full bg-gray-800 text-white font-black py-3.5 rounded-xl hover:bg-gray-900 active:scale-95 transition-all">
          احسب النقاط
        </button>
      </div>

      {/* ── Result ── */}
      {result && (
        <div className={`mt-5 p-6 rounded-[2rem] border-2 text-center animate-in slide-in-from-bottom-4 ${result.bg}`}>
          <p className="text-xs text-gray-400 font-bold mb-1">النتيجة (Modified Centor)</p>
          <div className={`text-6xl font-black mb-2 ${result.color}`}>{result.score}</div>
          <p className={`text-sm font-black inline-block px-4 py-1 rounded-lg bg-white/60 ${result.color}`}>{result.recommendation}</p>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-white/60 p-3 rounded-xl border border-white">
              <p className="text-[9px] text-gray-400 font-bold mb-1">احتمالية GAS</p>
              <p className={`text-lg font-black ${result.color}`}>{result.gasProb}</p>
            </div>
            <div className="bg-white/60 p-3 rounded-xl border border-white col-span-1">
              <p className="text-[9px] text-gray-400 font-bold mb-1">الإجراء الموصى به</p>
              <p className="text-[10px] font-bold text-gray-700 leading-relaxed">{result.action}</p>
            </div>
          </div>

          <button onClick={saveResult} disabled={loading}
            className="mt-4 w-full flex items-center justify-center gap-2 text-sm bg-white px-5 py-3 rounded-xl font-bold text-red-700 border hover:bg-red-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ بالملف
          </button>
        </div>
      )}

      {/* ── Sources ── */}
      <div className="mt-6 p-4 bg-gray-50 rounded-2xl border border-gray-100">
        <p className="flex items-center gap-1.5 text-xs font-black text-gray-600 mb-3"><BookOpen className="w-3.5 h-3.5"/> المصادر العلمية</p>
        <div className="space-y-2">
          {[
            { title: 'IDSA Guidelines — Pharyngitis Management 2012', url: 'https://www.idsociety.org/practice-guideline/pharyngitis/' },
            { title: 'McIsaac WJ et al. — Validation of a management algorithm (CMAJ, 1998)', url: 'https://pubmed.ncbi.nlm.nih.gov/9734729/' },
            { title: 'Centor RM et al. — Original Centor score publication (1981)', url: 'https://pubmed.ncbi.nlm.nih.gov/7444468/' },
          ].map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-[10px] text-red-600 font-semibold hover:underline">
              <ExternalLink className="w-3 h-3 shrink-0" />{s.title}
            </a>
          ))}
        </div>
      </div>

    </div>
  );
}
