import React, { useState } from 'react';
import { ArrowRight, Save, Loader2, BookOpen, ExternalLink, Info, AlertTriangle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

interface Props { onBack?: () => void; }

// ─── SVG Icon ─────────────────────────────────────────────────────────────────
const PedDoseIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
    <rect width="48" height="48" rx="14" fill="#F5F3FF"/>
    {/* Syringe body */}
    <rect x="10" y="20" width="24" height="8" rx="3" fill="#DDD6FE" stroke="#7C3AED" strokeWidth="1.3"/>
    {/* Plunger */}
    <rect x="8" y="22" width="4" height="4" rx="1" fill="#7C3AED"/>
    {/* Needle */}
    <path d="M34 24H42" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round"/>
    <path d="M40 22L42 24L40 26" stroke="#7C3AED" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    {/* Scale marks */}
    <path d="M18 20V18M22 20V18M26 20V18" stroke="#7C3AED" strokeWidth="1" strokeLinecap="round"/>
    {/* Liquid */}
    <rect x="14" y="21" width="12" height="6" rx="2" fill="#C4B5FD" opacity="0.7"/>
    {/* Child symbol */}
    <circle cx="38" cy="12" r="5" fill="#EDE9FE" stroke="#7C3AED" strokeWidth="1.2"/>
    <path d="M36 12C36 12 37.5 10.5 39 12" stroke="#7C3AED" strokeWidth="1" strokeLinecap="round"/>
    <circle cx="37" cy="11" r="0.5" fill="#7C3AED"/>
    <circle cx="39.5" cy="11" r="0.5" fill="#7C3AED"/>
  </svg>
);

// ─── Common pediatric drugs ───────────────────────────────────────────────────
const drugPresets = [
  { name: 'Amoxicillin (أموكسيسيلين)', dose: '40', maxDaily: 1500, unit: 'مجم/كجم/يوم', note: 'قياسي للتهاب الأذن/حلق، جرعة مرتفعة 90 مجم/كجم للمقاوم' },
  { name: 'Ibuprofen (إيبوبروفين)', dose: '10', maxDaily: 2400, unit: 'مجم/كجم/جرعة', note: 'كل 6–8 ساعات. لا يُعطى للرضع < 6 أشهر' },
  { name: 'Paracetamol (باراسيتامول)', dose: '15', maxDaily: 4000, unit: 'مجم/كجم/جرعة', note: 'كل 4–6 ساعات. الحد اليومي 75 مجم/كجم أو 4جم' },
  { name: 'Azithromycin (أزيثرومايسين)', dose: '10', maxDaily: 500, unit: 'مجم/كجم/يوم', note: 'مرة واحدة يومياً لمدة 3–5 أيام' },
  { name: 'Cetirizine (سيتيريزين)', dose: '0.25', maxDaily: 10, unit: 'مجم/كجم/يوم', note: 'مرة واحدة ليلاً. للأطفال > 2 سنوات' },
  { name: 'Salbutamol oral (سالبوتامول)', dose: '0.1', maxDaily: 8, unit: 'مجم/كجم/جرعة', note: 'كل 6–8 ساعات. الرذاذ أفضل للربو' },
];

export default function PediatricDoseCalculator({ onBack }: Props) {
  const [weight, setWeight] = useState('');
  const [dosePerKg, setDosePerKg] = useState('');
  const [concentration, setConcentration] = useState('');
  const [frequency, setFrequency] = useState('3');
  const [selectedDrug, setSelectedDrug] = useState<typeof drugPresets[0] | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const applyPreset = (drug: typeof drugPresets[0]) => {
    setSelectedDrug(drug);
    setDosePerKg(drug.dose);
    setResult(null);
  };

  const calculateDose = () => {
    const w = parseFloat(weight);
    const d = parseFloat(dosePerKg);
    const c = parseFloat(concentration);
    const f = parseFloat(frequency);
    if (!w || !d || !c || !f || w <= 0 || d <= 0 || c <= 0) { toast.error('يرجى إدخال جميع القيم بشكل صحيح'); return; }
    if (w > 80) { toast.error('⚠️ تحقق من الوزن — القيمة تبدو مرتفعة لطفل'); return; }

    const totalDailyMg = w * d * f;
    const dosePerTimeMg = w * d;
    const dosePerTimeMl = dosePerTimeMg / c;

    // Max dose check
    let maxWarning = '';
    if (selectedDrug && totalDailyMg > selectedDrug.maxDaily) {
      maxWarning = `⚠️ الجرعة اليومية (${totalDailyMg.toFixed(0)} مجم) تتجاوز الحد الأقصى الموصى به (${selectedDrug.maxDaily} مجم/يوم). راجع الجرعة.`;
    }

    setResult({
      mgPerDose: dosePerTimeMg.toFixed(1),
      mlPerDose: dosePerTimeMl.toFixed(1),
      totalDaily: totalDailyMg.toFixed(1),
      maxWarning,
    });
  };

  const saveResult = async () => {
    if (!result) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول أولاً');
      await supabase.from('saved_calculations').insert({
        user_id: user.id, title: `جرعة أطفال — ${selectedDrug?.name ?? 'دواء مخصص'}`,
        result: `${result.mlPerDose} مل (${result.mgPerDose} مجم) / جرعة`,
        input_data: { weight, dosePerKg, concentration, frequency, drug: selectedDrug?.name }
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
          <PedDoseIcon />
          <div>
            <h2 className="text-xl font-black text-gray-800">حاسبة جرعات الأطفال</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-bold bg-violet-50 text-violet-600 px-2 py-0.5 rounded border border-violet-100">للأطباء فقط ⚕️</span>
              <span className="text-xs text-gray-400 font-semibold">Pediatric Dose Calculator</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Info ── */}
      <div className="bg-violet-50 p-4 rounded-2xl border border-violet-100 mb-5 flex gap-3 text-violet-800">
        <Info className="w-5 h-5 shrink-0 mt-0.5 text-violet-400" />
        <div className="text-xs leading-relaxed">
          <p className="font-bold mb-1">المعادلة المستخدمة</p>
          <p className="font-mono bg-white/60 px-2 py-1 rounded text-[10px] mb-1">الجرعة (مل) = [الوزن × مجم/كجم] ÷ تركيز الدواء</p>
          <p>اختر دواءً من القائمة للتعبئة التلقائية، أو أدخل القيم يدوياً.</p>
        </div>
      </div>

      {/* ── Drug presets ── */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 mb-4">
        <p className="text-xs font-black text-gray-600 mb-3">💊 الأدوية الشائعة (اضغط للتعبئة التلقائية)</p>
        <div className="space-y-2">
          {drugPresets.map((drug, i) => (
            <button key={i} onClick={() => applyPreset(drug)}
              className={`w-full text-right p-3 rounded-xl border-2 transition-all ${selectedDrug?.name === drug.name ? 'border-violet-400 bg-violet-50' : 'border-gray-100 hover:bg-gray-50'}`}>
              <div className="flex items-center justify-between">
                <p className="font-bold text-xs text-gray-800">{drug.name}</p>
                <span className="text-[9px] font-black bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">{drug.dose} {drug.unit}</span>
              </div>
              <p className="text-[9px] text-gray-400 font-semibold mt-0.5">{drug.note}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Form ── */}
      <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-gray-100 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-gray-600">وزن الطفل</label>
            <span className="text-[9px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full font-bold">كجم</span>
          </div>
          <input type="number" value={weight} onChange={e => setWeight(e.target.value)}
            className="w-full p-3 rounded-xl border bg-gray-50 focus:bg-white focus:border-violet-400 outline-none font-bold text-gray-800"
            placeholder="12" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-gray-600">الجرعة</label>
              <span className="text-[9px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full font-bold">مجم/كجم</span>
            </div>
            <input type="number" value={dosePerKg} onChange={e => setDosePerKg(e.target.value)}
              className="w-full p-3 rounded-xl border bg-gray-50 focus:bg-white focus:border-violet-400 outline-none font-bold text-gray-800"
              placeholder="50" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-gray-600">تركيز الدواء</label>
              <span className="text-[9px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full font-bold">مجم/مل</span>
            </div>
            <input type="number" value={concentration} onChange={e => setConcentration(e.target.value)}
              className="w-full p-3 rounded-xl border bg-gray-50 focus:bg-white focus:border-violet-400 outline-none font-bold text-gray-800"
              placeholder="50" />
            <p className="text-[9px] text-gray-400 mt-1 font-semibold">مثال: 250مجم/5مل = 50 مجم/مل</p>
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-gray-600 mb-1.5 block">عدد المرات يومياً</label>
          <div className="grid grid-cols-4 gap-2">
            {[{ v: '1', l: 'OD\nمرة' }, { v: '2', l: 'BID\nمرتين' }, { v: '3', l: 'TID\n3×' }, { v: '4', l: 'QID\n4×' }].map(o => (
              <button key={o.v} onClick={() => setFrequency(o.v)}
                className={`py-2.5 rounded-xl text-[10px] font-bold border-2 transition-all leading-tight ${frequency === o.v ? 'border-violet-400 bg-violet-50 text-violet-700' : 'border-gray-100 text-gray-500 hover:bg-gray-50'}`}>
                {o.l.split('\n')[0]}<br />{o.l.split('\n')[1]}
              </button>
            ))}
          </div>
        </div>

        <button onClick={calculateDose}
          className="w-full bg-violet-600 text-white py-3.5 rounded-xl font-black text-base hover:bg-violet-700 shadow-md active:scale-95 transition-all">
          احسب الجرعة
        </button>
      </div>

      {/* ── Result ── */}
      {result && (
        <div className="mt-5 space-y-3 animate-in slide-in-from-bottom-4">
          <div className="p-6 rounded-[2rem] text-center border-2 bg-violet-50 border-violet-200 shadow-sm">
            <p className="text-xs font-bold text-gray-400 mb-1">الجرعة في المرة الواحدة</p>
            <div className="text-6xl font-black text-violet-600 mb-1">{result.mlPerDose}</div>
            <p className="text-sm font-bold text-gray-500">مل / جرعة</p>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-white/70 p-3 rounded-2xl border border-white text-center">
                <p className="text-[9px] text-gray-400 font-bold">بالملليجرام</p>
                <p className="text-xl font-black text-violet-700">{result.mgPerDose} مجم</p>
              </div>
              <div className="bg-white/70 p-3 rounded-2xl border border-white text-center">
                <p className="text-[9px] text-gray-400 font-bold">الجرعة اليومية</p>
                <p className="text-xl font-black text-violet-700">{result.totalDaily} مجم</p>
              </div>
            </div>
          </div>

          {result.maxWarning && (
            <div className="bg-red-50 p-4 rounded-2xl border border-red-200 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-red-700 font-bold leading-relaxed">{result.maxWarning}</p>
            </div>
          )}

          {selectedDrug && (
            <div className="bg-amber-50 p-3 rounded-2xl border border-amber-100">
              <p className="text-[10px] text-amber-700 font-semibold">💡 {selectedDrug.note}</p>
            </div>
          )}

          <button onClick={saveResult} disabled={loading}
            className="w-full flex items-center justify-center gap-2 text-sm bg-white px-5 py-3.5 rounded-xl font-bold text-gray-800 hover:bg-gray-50 shadow-sm border">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ النتيجة
          </button>
        </div>
      )}

      {/* ── Sources ── */}
      <div className="mt-6 p-4 bg-gray-50 rounded-2xl border border-gray-100">
        <p className="flex items-center gap-1.5 text-xs font-black text-gray-600 mb-3"><BookOpen className="w-3.5 h-3.5"/> المصادر العلمية</p>
        <div className="space-y-2">
          {[
            { title: 'BNF for Children — Pediatric Drug Dosing Reference', url: 'https://bnfc.nice.org.uk/' },
            { title: 'AAP — Pediatric Pharmacology Guidelines', url: 'https://www.aap.org/en/practice-management/care-delivery-approaches/pharmacology/' },
            { title: 'Taketomo CK — Pediatric & Neonatal Dosage Handbook', url: 'https://www.wolterskluwer.com/en/solutions/lexicomp/about/lexicomp-online-ped-neonatal' },
          ].map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-[10px] text-violet-600 font-semibold hover:underline">
              <ExternalLink className="w-3 h-3 shrink-0" />{s.title}
            </a>
          ))}
        </div>
        <p className="text-[9px] text-gray-400 font-semibold mt-3 leading-relaxed">⚠️ هذه الحاسبة مساعدة فقط. تحقق دائماً من نشرة الدواء والمراجع الرسمية قبل وصف أي جرعة.</p>
      </div>

    </div>
  );
}
