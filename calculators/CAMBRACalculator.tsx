import React, { useState } from 'react';
import { ArrowRight, BookOpen, Save, Loader2, ExternalLink, Info } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

interface Props { onBack?: () => void; }

// ─── SVG Icon ─────────────────────────────────────────────────────────────────
const CAMBRAIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
    <rect width="48" height="48" rx="14" fill="#FFF7ED"/>
    {/* Tooth shape */}
    <path d="M15 18C15 15.239 17.239 13 20 13H28C30.761 13 33 15.239 33 18C33 21 31 23 31 26L30 35H26L24 29L22 35H18L17 26C17 23 15 21 15 18Z" fill="#FED7AA" stroke="#F97316" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M20 18C20 16.895 20.895 16 22 16H26C27.105 16 28 16.895 28 18" stroke="#EA580C" strokeWidth="1.3" strokeLinecap="round"/>
    {/* Bacteria dots */}
    <circle cx="20" cy="21" r="1.5" fill="#EF4444" opacity="0.7"/>
    <circle cx="28" cy="22" r="1.2" fill="#EF4444" opacity="0.5"/>
    <circle cx="24" cy="20" r="1" fill="#F97316" opacity="0.6"/>
  </svg>
);

export default function CAMBRACalculator({ onBack }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const [factors, setFactors] = useState({
    cavities:     { checked: false, label: 'وجود تسوس فعّال أو حشوات خلال الـ 3 سنوات الماضية', pts: 3, note: 'أقوى مؤشر للخطر المرتفع' },
    sugar:        { checked: false, label: 'تناول السكريات أو المشروبات الحمضية بين الوجبات (> 3 مرات يومياً)', pts: 1, note: '' },
    dryMouth:     { checked: false, label: 'جفاف الفم (Xerostomia) — بسبب أدوية أو إشعاع أو مرض', pts: 2, note: 'يقلل من الحماية الطبيعية للريق' },
    exposedRoots: { checked: false, label: 'وجود جذور أسنان مكشوفة', pts: 2, note: 'أعلى خطراً للتسوس الجذري' },
    ortho:        { checked: false, label: 'أجهزة تقويم أسنان ثابتة أو أطقم جزئية متحركة', pts: 1, note: '' },
    lowFluoride:  { checked: false, label: 'عدم استخدام معجون أسنان بالفلوريد بانتظام', pts: 1, note: '' },
    smoking:      { checked: false, label: 'التدخين أو استخدام التبغ', pts: 1, note: '' },
  });

  const toggle = (key: string) =>
    setFactors(prev => ({ ...prev, [key]: { ...prev[key as keyof typeof prev], checked: !prev[key as keyof typeof prev].checked } }));

  const calculate = () => {
    const checkedFactors = Object.values(factors).filter(f => f.checked);
    const totalPts = checkedFactors.reduce((sum, f) => sum + f.pts, 0);
    const hasCavities = factors.cavities.checked;

    let level = '', color = '', bg = '', recs: string[] = [];

    if (hasCavities || totalPts >= 5) {
      level = 'مرتفع جداً'; color = 'text-red-600'; bg = 'bg-red-50 border-red-200';
      recs = ['فلوريد موضعي عالي التركيز (5000 ppm)', 'زيارة طارئة للطبيب خلال أسبوع', 'اختبار اللعاب (Salivary test)', 'مضمضة بمضادات الجراثيم (Chlorhexidine)'];
    } else if (totalPts >= 3) {
      level = 'مرتفع'; color = 'text-orange-600'; bg = 'bg-orange-50 border-orange-200';
      recs = ['فلوريد موضعي 1450 ppm أو أعلى', 'متابعة كل 3–4 أشهر', 'تحسين عادات النظافة الفموية'];
    } else if (totalPts >= 1) {
      level = 'متوسط'; color = 'text-yellow-600'; bg = 'bg-yellow-50 border-yellow-200';
      recs = ['معجون بالفلوريد عند كل تفريش', 'زيارة كل 6 أشهر', 'تقليل استهلاك السكريات'];
    } else {
      level = 'منخفض'; color = 'text-green-600'; bg = 'bg-green-50 border-green-200';
      recs = ['متابعة سنوية', 'الاستمرار بعادات النظافة الفموية الجيدة'];
    }

    setResult({ level, color, bg, recs, totalPts });
  };

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 pb-10">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-5">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border"><ArrowRight className="w-5 h-5 text-gray-600" /></button>}
        <div className="flex items-center gap-3">
          <CAMBRAIcon />
          <div>
            <h2 className="text-xl font-black text-gray-800">تقييم مخاطر التسوس</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-bold bg-orange-50 text-orange-600 px-2 py-0.5 rounded border border-orange-100">للأطباء فقط ⚕️</span>
              <span className="text-xs text-gray-400 font-semibold">CAMBRA Protocol</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Info ── */}
      <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 mb-5 flex gap-3 text-orange-800">
        <Info className="w-5 h-5 shrink-0 mt-0.5 text-orange-500" />
        <div className="text-xs leading-relaxed">
          <p className="font-bold mb-1">ما هو بروتوكول CAMBRA؟</p>
          <p>Caries Management By Risk Assessment — نهج علمي معتمد من ADA لإدارة التسوس بناءً على تقدير المخاطر الفردية لكل مريض، بدلاً من العلاج التقليدي التفاعلي فقط.</p>
        </div>
      </div>

      {/* ── Form ── */}
      <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-gray-100 space-y-2.5">
        <p className="text-xs font-black text-gray-500 mb-1">عوامل الخطر — حدد ما ينطبق على المريض</p>
        {Object.entries(factors).map(([key, item]) => (
          <label key={key} className={`flex items-start gap-3 p-3.5 border-2 rounded-xl cursor-pointer transition-all ${item.checked ? 'border-orange-400 bg-orange-50' : 'border-gray-100 hover:bg-gray-50'}`}>
            <input type="checkbox" checked={item.checked} onChange={() => toggle(key)} className="w-5 h-5 accent-orange-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold text-xs text-gray-800">{item.label}</span>
              {item.note && <p className="text-[9px] text-gray-400 mt-0.5 font-semibold">{item.note}</p>}
            </div>
          </label>
        ))}
        <button onClick={calculate} className="w-full bg-gray-800 text-white font-black py-3.5 rounded-xl mt-2 hover:bg-gray-900 active:scale-95 transition-all">
          تحديد درجة الخطورة
        </button>
      </div>

      {/* ── Result ── */}
      {result && (
        <div className={`mt-5 p-6 rounded-[2rem] border-2 shadow-sm animate-in slide-in-from-bottom-4 ${result.bg}`}>
          <p className="text-xs text-gray-400 font-bold text-center mb-1">تصنيف خطر التسوس</p>
          <div className={`text-4xl font-black text-center mb-3 ${result.color}`}>{result.level}</div>
          <div className="bg-white/60 rounded-xl p-3 space-y-1.5">
            <p className="text-xs font-black text-gray-600 mb-2">📋 التوصيات العلاجية:</p>
            {result.recs.map((rec: string, i: number) => (
              <div key={i} className="flex items-start gap-2 text-xs text-gray-700 font-semibold">
                <span className="text-green-500 font-black mt-0.5">✓</span><span>{rec}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Sources ── */}
      <div className="mt-6 p-4 bg-gray-50 rounded-2xl border border-gray-100">
        <p className="flex items-center gap-1.5 text-xs font-black text-gray-600 mb-3"><BookOpen className="w-3.5 h-3.5"/> المصادر العلمية</p>
        <div className="space-y-2">
          {[
            { title: 'ADA — Caries Risk Assessment Forms (CAMBRA)', url: 'https://www.ada.org/resources/research/science-and-research-institute/oral-health-topics/caries-risk-assessment-and-management' },
            { title: 'Featherstone JDB — CAMBRA Caries Management (2007)', url: 'https://pubmed.ncbi.nlm.nih.gov/17803430/' },
            { title: 'American Dental Association — Caries Prevention Guidelines', url: 'https://www.ada.org/resources/ada-library/oral-health-topics/tooth-decay' },
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
