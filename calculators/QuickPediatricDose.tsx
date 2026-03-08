import React, { useState } from 'react';
import { ArrowRight, AlertOctagon, Info, Save, Loader2, BookOpen, ExternalLink, AlertTriangle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

interface Props { onBack?: () => void; }

// ─── SVG Icon ─────────────────────────────────────────────────────────────────
const QuickDoseIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
    <rect width="48" height="48" rx="14" fill="#FFF7ED"/>
    {/* Medicine bottle */}
    <rect x="16" y="14" width="16" height="22" rx="3" fill="#FED7AA" stroke="#F97316" strokeWidth="1.3"/>
    <rect x="18" y="10" width="12" height="6" rx="2" fill="#FDBA74" stroke="#F97316" strokeWidth="1.2"/>
    {/* Label lines */}
    <path d="M19 22H29M19 26H26" stroke="#F97316" strokeWidth="1" strokeLinecap="round"/>
    {/* Plus / dose mark */}
    <path d="M22 18H26M24 16V20" stroke="#EA580C" strokeWidth="1.5" strokeLinecap="round"/>
    {/* Spoon */}
    <path d="M32 30C32 30 37 28 38 32C39 36 35 38 33 36L32 30Z" fill="#FDE68A" stroke="#F59E0B" strokeWidth="1"/>
    {/* Lightning bolt — quick */}
    <path d="M10 18L12 24H10L13 30L11 24H13L10 18Z" fill="#F97316" opacity="0.8"/>
  </svg>
);

// ─── Drug data ─────────────────────────────────────────────────────────────────
interface DrugData {
  name: string; nameEn: string; color: string; badge: string;
  dosePerKg: number; maxSingleDose: number; maxDailyDose: number;
  freq: string; freqHours: string;
  concentrations: { label: string; mgPerMl: number; }[];
  ageMin: string; note: string; warning?: string;
  category: string;
}

const drugs: Record<string, DrugData> = {
  paracetamol: {
    name: 'باراسيتامول',  nameEn: 'Paracetamol / Acetaminophen',
    color: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700',
    dosePerKg: 15, maxSingleDose: 1000, maxDailyDose: 4000,
    freq: 'كل 4–6 ساعات', freqHours: 'حداً أقصى 5 جرعات يومياً',
    concentrations: [
      { label: '120 مجم / 5 مل (الشراب الصغير)', mgPerMl: 24 },
      { label: '250 مجم / 5 مل (الشراب الكبير)', mgPerMl: 50 },
    ],
    ageMin: 'جميع الأعمار', note: 'الأآمن والأكثر استخداماً. لا يُستخدم مع أمراض الكبد.',
    category: 'خافض حرارة / مسكن',
  },
  ibuprofen: {
    name: 'إيبوبروفين', nameEn: 'Ibuprofen',
    color: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700',
    dosePerKg: 10, maxSingleDose: 400, maxDailyDose: 1200,
    freq: 'كل 6–8 ساعات', freqHours: 'حداً أقصى 3 جرعات يومياً',
    concentrations: [
      { label: '100 مجم / 5 مل', mgPerMl: 20 },
      { label: '200 مجم / 5 مل', mgPerMl: 40 },
    ],
    ageMin: '6 شهور فأكثر',
    note: 'مسكن ومضاد التهاب. أعطِه مع الأكل.',
    warning: 'تجنب عند نقص السوائل، مرض الكلى، أو تحت سن 6 شهور.',
    category: 'مسكن / مضاد التهاب',
  },
  amoxicillin: {
    name: 'أموكسيسيلين', nameEn: 'Amoxicillin',
    color: 'bg-green-600', badge: 'bg-green-100 text-green-700',
    dosePerKg: 40, maxSingleDose: 500, maxDailyDose: 1500,
    freq: 'مقسمة على 3 جرعات', freqHours: 'كل 8 ساعات',
    concentrations: [
      { label: '125 مجم / 5 مل', mgPerMl: 25 },
      { label: '250 مجم / 5 مل', mgPerMl: 50 },
    ],
    ageMin: 'جميع الأعمار',
    note: 'الجرعة المحسوبة هي الجرعة اليومية الكاملة — قسّمها على 3.',
    warning: 'تحقق من حساسية البنسلين قبل الإعطاء.',
    category: 'مضاد حيوي',
  },
  azithromycin: {
    name: 'أزيثرومايسين', nameEn: 'Azithromycin',
    color: 'bg-purple-600', badge: 'bg-purple-100 text-purple-700',
    dosePerKg: 10, maxSingleDose: 500, maxDailyDose: 500,
    freq: 'مرة واحدة يومياً', freqHours: 'لمدة 3 أيام',
    concentrations: [
      { label: '200 مجم / 5 مل', mgPerMl: 40 },
    ],
    ageMin: '6 شهور فأكثر',
    note: 'مرة واحدة يومياً × 3 أيام للإصابات التنفسية.',
    category: 'مضاد حيوي',
  },
  cetirizine: {
    name: 'سيتيريزين', nameEn: 'Cetirizine',
    color: 'bg-teal-500', badge: 'bg-teal-100 text-teal-700',
    dosePerKg: 0.25, maxSingleDose: 10, maxDailyDose: 10,
    freq: 'مرة واحدة يومياً (مساءً)', freqHours: '',
    concentrations: [
      { label: '1 مجم / مل (الشراب)', mgPerMl: 1 },
    ],
    ageMin: 'سنة فأكثر',
    note: 'مضاد للحساسية — مناسب لمن سنة فأكثر.',
    category: 'مضاد حساسية',
  },
  dexamethasone: {
    name: 'ديكساميثازون (كروب)', nameEn: 'Dexamethasone (Croup)',
    color: 'bg-red-600', badge: 'bg-red-100 text-red-700',
    dosePerKg: 0.15, maxSingleDose: 10, maxDailyDose: 10,
    freq: 'جرعة واحدة فقط', freqHours: '(في الطوارئ)',
    concentrations: [
      { label: '0.5 مجم / 5 مل (الشراب)', mgPerMl: 0.1 },
    ],
    ageMin: '3 شهور فأكثر',
    note: 'جرعة واحدة للكروب الحاد. يُعطى تحت إشراف طبي.',
    warning: '⚠️ للاستخدام الطبي الطارئ فقط تحت إشراف.',
    category: 'كورتيزون',
  },
};

export default function QuickPediatricDose({ onBack }: Props) {
  const [weight, setWeight] = useState('');
  const [drugType, setDrugType] = useState('paracetamol');
  const [concIdx, setConcIdx] = useState(0);
  const [loading, setLoading] = useState(false);

  const drug = drugs[drugType];

  const w = parseFloat(weight);
  const hasDose = w > 0 && !isNaN(w);
  const rawDose = hasDose ? w * drug.dosePerKg : 0;
  const mgDose = Math.min(rawDose, drug.maxSingleDose);
  const mlDose = hasDose ? (mgDose / drug.concentrations[concIdx].mgPerMl).toFixed(1) : '–';
  const isCapped = rawDose > drug.maxSingleDose;

  const saveResult = async () => {
    if (!hasDose) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول');
      await supabase.from('saved_calculations').insert({
        user_id: user.id, title: `جرعة ${drug.name} (${weight} كجم)`,
        result: `${mgDose.toFixed(1)} مجم / ${mlDose} مل — ${drug.freq}`,
        input_data: { weight, drugType, concentration: drug.concentrations[concIdx].label }
      });
      toast.success('تم الحفظ ✅');
    } catch (err: any) { toast.error(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 duration-300 pb-10">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-5">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50"><ArrowRight className="w-5 h-5 text-gray-600" /></button>}
        <div className="flex items-center gap-3">
          <QuickDoseIcon />
          <div>
            <h2 className="text-xl font-black text-gray-800">الجرعات السريعة للأطفال</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-bold bg-orange-50 text-orange-600 px-2 py-0.5 rounded border border-orange-100">للأطباء فقط ⚕️</span>
              <span className="text-xs text-gray-400 font-semibold">Quick Pediatric Dose</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Warning ── */}
      <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 mb-5 flex gap-3 text-orange-800">
        <AlertOctagon className="w-5 h-5 shrink-0 mt-0.5 text-orange-400" />
        <p className="text-xs font-semibold leading-relaxed">تحقق دائماً من تركيز الدواء المكتوب على العلبة لأن التركيزات تختلف. هذه الحاسبة للإرشاد فقط.</p>
      </div>

      {/* ── Drug selector ── */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {Object.entries(drugs).map(([key, d]) => (
          <button key={key} onClick={() => { setDrugType(key); setConcIdx(0); }}
            className={`p-2.5 rounded-xl border-2 transition-all text-center ${drugType === key ? `${d.color} text-white border-transparent shadow-md` : 'border-gray-100 bg-white text-gray-600 hover:bg-gray-50'}`}>
            <p className="text-[9px] font-black leading-tight">{d.name}</p>
            <p className={`text-[7px] mt-0.5 ${drugType === key ? 'text-white/80' : 'text-gray-400'}`}>{d.category}</p>
          </button>
        ))}
      </div>

      {/* ── Form ── */}
      <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-gray-100 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-gray-600">وزن الطفل</label>
            <span className="text-[9px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full font-bold">كجم</span>
          </div>
          <input type="number" value={weight} onChange={e => setWeight(e.target.value)}
            className="w-full p-3.5 border bg-gray-50 focus:bg-white rounded-xl outline-none focus:border-orange-400 font-bold text-gray-800"
            placeholder="مثال: 15" />
          <div className="flex gap-2 mt-2">
            {[5, 10, 15, 20, 30].map(w => (
              <button key={w} onClick={() => setWeight(String(w))}
                className="text-[10px] font-bold px-2.5 py-1 bg-orange-50 text-orange-600 rounded-full border border-orange-100 hover:bg-orange-100">
                {w}
              </button>
            ))}
          </div>
        </div>

        {/* Concentration selector */}
        {drug.concentrations.length > 1 && (
          <div>
            <label className="text-xs font-bold text-gray-600 mb-1.5 block">تركيز الشراب على العلبة</label>
            <div className="space-y-2">
              {drug.concentrations.map((c, i) => (
                <label key={i} className={`flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition-all ${concIdx === i ? 'border-orange-400 bg-orange-50' : 'border-gray-100 hover:bg-gray-50'}`}>
                  <input type="radio" name="conc" checked={concIdx === i} onChange={() => setConcIdx(i)} className="w-4 h-4 accent-orange-500" />
                  <span className="text-xs font-bold text-gray-700">{c.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Drug info */}
        <div className={`p-3 rounded-xl ${drug.badge.includes('bg-') ? drug.badge.split(' ')[0] : 'bg-gray-50'}`}>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${drug.badge}`}>{drug.category}</span>
            <span className="text-[9px] text-gray-400 font-semibold">{drug.ageMin}</span>
          </div>
          <p className="text-[10px] text-gray-600 font-semibold">{drug.note}</p>
        </div>
      </div>

      {/* ── Result ── */}
      {hasDose && (
        <div className="mt-5 space-y-3 animate-in slide-in-from-bottom-4">

          {/* Main result */}
          <div className={`${drug.color} text-white p-6 rounded-[2rem] text-center shadow-lg`}>
            <p className="text-white/80 text-xs font-bold mb-1">الجرعة الفعالة</p>
            <div className="text-5xl font-black">{mgDose.toFixed(1)}</div>
            <p className="font-bold text-white/80">مليجرام (mg)</p>
            <div className="mt-3 bg-white/20 rounded-xl py-2 px-4 inline-block">
              <p className="text-sm font-black">{mlDose} مل</p>
              <p className="text-[10px] text-white/80 font-semibold">{drug.concentrations[concIdx].label}</p>
            </div>
          </div>

          {/* Frequency */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gray-400 font-bold">التكرار</p>
              <p className="font-black text-sm text-gray-800">{drug.freq}</p>
              <p className="text-[10px] text-gray-400 font-semibold">{drug.freqHours}</p>
            </div>
            <div className="text-left">
              <p className="text-[9px] text-gray-400 font-bold">أقصى جرعة يومية</p>
              <p className="font-black text-sm text-gray-800">{Math.min(w * drug.dosePerKg * 3, drug.maxDailyDose).toFixed(0)} مجم</p>
            </div>
          </div>

          {/* Max dose warning */}
          {isCapped && (
            <div className="bg-red-50 p-3 rounded-2xl border border-red-200 flex gap-3">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-red-700 font-bold">الجرعة المحسوبة بالوزن تتجاوز الحد الأقصى — تم تحديدها عند {drug.maxSingleDose} مجم.</p>
            </div>
          )}

          {/* Drug warning */}
          {drug.warning && (
            <div className="bg-amber-50 p-3 rounded-2xl border border-amber-100 flex gap-3">
              <AlertOctagon className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-700 font-bold">{drug.warning}</p>
            </div>
          )}

          <button onClick={saveResult} disabled={loading}
            className="w-full flex items-center justify-center gap-2 text-sm bg-white px-5 py-3.5 rounded-xl font-bold text-gray-800 hover:bg-gray-50 shadow-sm border">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ الجرعة
          </button>
        </div>
      )}

      {/* ── Sources ── */}
      <div className="mt-5 p-4 bg-gray-50 rounded-2xl border border-gray-100">
        <p className="flex items-center gap-1.5 text-xs font-black text-gray-600 mb-3"><BookOpen className="w-3.5 h-3.5"/> المصادر العلمية</p>
        <div className="space-y-2">
          {[
            { title: 'BNF for Children — Pediatric Dosing', url: 'https://bnfc.nice.org.uk/' },
            { title: 'AAP — Clinical Practice Guidelines — Pain Management', url: 'https://www.aap.org/en/patient-care/acute-illness-management/' },
            { title: 'WHO — Model Formulary for Children', url: 'https://www.who.int/publications/i/item/9789241547840' },
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
