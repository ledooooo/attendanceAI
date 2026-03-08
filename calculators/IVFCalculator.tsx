import React, { useState } from 'react';
import { Save, ArrowRight, Loader2, BookOpen, ExternalLink, Info, RefreshCw } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

interface Props { onBack?: () => void; }

// ─── SVG Icon ─────────────────────────────────────────────────────────────────
const IVIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
    <rect width="48" height="48" rx="14" fill="#ECFEFF"/>
    {/* IV bag */}
    <rect x="13" y="8" width="18" height="20" rx="4" fill="#CFFAFE" stroke="#06B6D4" strokeWidth="1.3"/>
    {/* Liquid level */}
    <rect x="13" y="18" width="18" height="10" rx="0" fill="#67E8F9" opacity="0.7"/>
    <path d="M13 18H31" stroke="#06B6D4" strokeWidth="0.8" strokeDasharray="2 1"/>
    {/* Hanger hole */}
    <circle cx="22" cy="8" r="2" fill="white" stroke="#06B6D4" strokeWidth="1"/>
    {/* Drip chamber */}
    <rect x="19" y="28" width="6" height="6" rx="1" fill="#A5F3FC" stroke="#06B6D4" strokeWidth="1"/>
    {/* Tubing */}
    <path d="M22 34V40" stroke="#06B6D4" strokeWidth="1.5" strokeLinecap="round"/>
    {/* Drop */}
    <path d="M22 37C22 37 20.5 38.5 20.5 39.5C20.5 40.3 21.2 41 22 41C22.8 41 23.5 40.3 23.5 39.5C23.5 38.5 22 37 22 37Z" fill="#06B6D4"/>
    {/* Rate gauge */}
    <circle cx="37" cy="20" r="6" fill="#ECFEFF" stroke="#06B6D4" strokeWidth="1"/>
    <path d="M34 20L37 17L40 20" stroke="#0891B2" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M37 17V23" stroke="#0891B2" strokeWidth="1" strokeLinecap="round" opacity="0.4"/>
  </svg>
);

const dropFactors = [
  { value: '15', label: '15 نقطة/مل', desc: 'Macrodrip — بالغين (جهاز عادي)', example: '(أشيع استخداماً)' },
  { value: '20', label: '20 نقطة/مل', desc: 'Macrodrip — بالغين (جهاز آخر)', example: '' },
  { value: '60', label: '60 نقطة/مل', desc: 'Microdrip — أطفال / دقة عالية', example: '(Pediatric set)' },
];

// Common IV fluids reference
const commonFluids = [
  { name: 'Normal Saline (NS 0.9%)', use: 'توسعة الحجم، جفاف، صدمة' },
  { name: 'Half Normal Saline (0.45%)', use: 'صيانة، تصحيح فرط صوديوم' },
  { name: 'Ringer\'s Lactate (RL)', use: 'الصدمة، ما قبل الجراحة' },
  { name: 'Dextrose 5% (D5W)', use: 'تغذية وريدية، نقص سكر' },
  { name: 'Dextrose 5% + NS (D5NS)', use: 'صيانة، نقص كلوريد' },
];

export default function IVFCalculator({ onBack }: Props) {
  const [volume, setVolume] = useState('');
  const [time, setTime] = useState('');
  const [timeUnit, setTimeUnit] = useState<'hours' | 'minutes'>('hours');
  const [dropFactor, setDropFactor] = useState('15');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const calculate = () => {
    const v = parseFloat(volume);
    const t = parseFloat(time);
    const df = parseFloat(dropFactor);
    if (!v || !t || v <= 0 || t <= 0) { toast.error('يرجى إدخال قيم صحيحة للحجم والوقت'); return; }

    const totalMinutes = timeUnit === 'hours' ? t * 60 : t;
    const dropsPerMin = (v * df) / totalMinutes;
    const mlPerHour = (v / totalMinutes) * 60;

    const roundedDrops = Math.round(dropsPerMin);
    const roundedMl = Math.round(mlPerHour * 10) / 10;

    // Practical tip
    let tip = '';
    if (roundedDrops <= 10) tip = 'معدل منخفض جداً — تأكد من صحة البيانات، أو استخدم ضخة infusion.';
    else if (roundedDrops <= 30) tip = 'معدل مناسب — عدّ النقط كل 15 ثانية (÷4).';
    else if (roundedDrops <= 50) tip = 'معدل متوسط — عدّ النقط كل 10 ثوانٍ (÷6).';
    else tip = 'معدل مرتفع — يُفضَّل استخدام ضخة وريدية إن أمكن.';

    setResult({ dropsPerMin: roundedDrops, mlPerHour: roundedMl, totalMinutes, tip });
  };

  const saveResult = async () => {
    if (!result) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول أولاً');
      await supabase.from('saved_calculations').insert({
        user_id: user.id, title: 'معدل المحاليل الوريدية (IV Drip Rate)',
        result: `${result.dropsPerMin} نقطة/دقيقة | ${result.mlPerHour} مل/ساعة`,
        input_data: { volume, time, timeUnit, dropFactor }
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
          <IVIcon />
          <div>
            <h2 className="text-xl font-black text-gray-800">حاسبة المحاليل الوريدية</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-bold bg-cyan-50 text-cyan-600 px-2 py-0.5 rounded border border-cyan-100">للأطباء والتمريض ⚕️</span>
              <span className="text-xs text-gray-400 font-semibold">IV Drip Rate</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Info ── */}
      <div className="bg-cyan-50 p-4 rounded-2xl border border-cyan-100 mb-5 flex gap-3 text-cyan-800">
        <Info className="w-5 h-5 shrink-0 mt-0.5 text-cyan-400" />
        <div className="text-xs leading-relaxed">
          <p className="font-bold mb-1">معادلة الحساب</p>
          <p className="font-mono bg-white/60 px-2 py-1 rounded text-[10px] mb-1">النقط/دقيقة = (الحجم × معامل التنقيط) ÷ الوقت بالدقائق</p>
          <p>تُستخدم عند عدم توافر ضخة وريدية إلكترونية (Infusion Pump).</p>
        </div>
      </div>

      {/* ── Form ── */}
      <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-gray-100 space-y-4">

        {/* Volume */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-gray-600">حجم المحلول</label>
            <span className="text-[9px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full font-bold">mL</span>
          </div>
          <input type="number" value={volume} onChange={e => setVolume(e.target.value)}
            className="w-full p-3.5 rounded-xl border bg-gray-50 focus:bg-white focus:border-cyan-400 outline-none font-bold text-gray-800"
            placeholder="500" />
          <div className="flex gap-2 mt-2">
            {[250, 500, 1000].map(v => (
              <button key={v} onClick={() => setVolume(String(v))}
                className="text-[10px] font-bold px-2.5 py-1 bg-cyan-50 text-cyan-600 rounded-lg border border-cyan-100 hover:bg-cyan-100">
                {v} مل
              </button>
            ))}
          </div>
        </div>

        {/* Time */}
        <div>
          <label className="text-xs font-bold text-gray-600 mb-1.5 block">المدة الزمنية</label>
          <div className="flex gap-2">
            <input type="number" value={time} onChange={e => setTime(e.target.value)}
              className="flex-1 p-3.5 rounded-xl border bg-gray-50 focus:bg-white focus:border-cyan-400 outline-none font-bold text-gray-800"
              placeholder={timeUnit === 'hours' ? '8' : '480'} />
            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button onClick={() => setTimeUnit('hours')}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition ${timeUnit === 'hours' ? 'bg-white shadow text-cyan-600' : 'text-gray-500'}`}>
                ساعات
              </button>
              <button onClick={() => setTimeUnit('minutes')}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition ${timeUnit === 'minutes' ? 'bg-white shadow text-cyan-600' : 'text-gray-500'}`}>
                دقائق
              </button>
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            {[6, 8, 12].map(h => (
              <button key={h} onClick={() => { setTime(String(h)); setTimeUnit('hours'); }}
                className="text-[10px] font-bold px-2.5 py-1 bg-cyan-50 text-cyan-600 rounded-lg border border-cyan-100 hover:bg-cyan-100">
                {h} ساعات
              </button>
            ))}
          </div>
        </div>

        {/* Drop factor */}
        <div>
          <label className="text-xs font-bold text-gray-600 mb-2 block">معامل التنقيط (Drop Factor)</label>
          <div className="space-y-2">
            {dropFactors.map(df => (
              <label key={df.value} className={`flex items-start gap-3 p-3 border-2 rounded-xl cursor-pointer transition-all ${dropFactor === df.value ? 'border-cyan-400 bg-cyan-50' : 'border-gray-100 hover:bg-gray-50'}`}>
                <input type="radio" name="df" value={df.value} checked={dropFactor === df.value} onChange={() => setDropFactor(df.value)}
                  className="w-4 h-4 accent-cyan-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-black text-xs text-gray-800">{df.label}</p>
                  <p className="text-[10px] text-gray-400 font-semibold">{df.desc} {df.example}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <button onClick={calculate}
          className="w-full bg-cyan-600 text-white py-3.5 rounded-xl font-black text-base hover:bg-cyan-700 shadow-md active:scale-95 transition-all">
          احسب معدل التنقيط
        </button>
      </div>

      {/* ── Result ── */}
      {result && (
        <div className="mt-5 space-y-3 animate-in slide-in-from-bottom-4">
          <div className="p-6 rounded-[2rem] text-center border-2 bg-cyan-50 border-cyan-200 shadow-sm">
            <p className="text-xs font-bold text-gray-500 mb-1">سرعة التنقيط المطلوبة</p>
            <div className="text-6xl font-black text-cyan-600 mb-1">{result.dropsPerMin}</div>
            <p className="text-sm font-bold text-gray-500">نقطة / دقيقة</p>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-white/70 p-3 rounded-2xl border border-white">
                <p className="text-[9px] text-gray-400 font-bold">معادل</p>
                <p className="text-xl font-black text-teal-600">{result.mlPerHour}</p>
                <p className="text-[9px] text-gray-400 font-bold">مل / ساعة</p>
              </div>
              <div className="bg-white/70 p-3 rounded-2xl border border-white">
                <p className="text-[9px] text-gray-400 font-bold">كل 15 ثانية</p>
                <p className="text-xl font-black text-blue-600">{Math.round(result.dropsPerMin / 4)}</p>
                <p className="text-[9px] text-gray-400 font-bold">نقطة</p>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
            <p className="text-xs font-black text-amber-700 mb-1">💡 نصيحة عملية</p>
            <p className="text-[10px] text-amber-600 font-semibold leading-relaxed">{result.tip}</p>
          </div>

          <button onClick={saveResult} disabled={loading}
            className="w-full flex items-center justify-center gap-2 text-sm bg-white px-5 py-3.5 rounded-xl font-bold text-gray-800 hover:bg-gray-50 shadow-sm border">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ في السجل
          </button>
        </div>
      )}

      {/* ── Common fluids reference ── */}
      <div className="mt-5 bg-white p-4 rounded-2xl border border-gray-100">
        <p className="text-xs font-black text-gray-600 mb-3">💧 استخدامات المحاليل الشائعة</p>
        {commonFluids.map((f, i) => (
          <div key={i} className="flex items-start justify-between py-2 border-b border-gray-50 last:border-0">
            <span className="text-[10px] font-bold text-gray-600 font-mono">{f.name}</span>
            <span className="text-[9px] text-gray-400 font-semibold text-left max-w-[140px]">{f.use}</span>
          </div>
        ))}
      </div>

      {/* ── Sources ── */}
      <div className="mt-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
        <p className="flex items-center gap-1.5 text-xs font-black text-gray-600 mb-3"><BookOpen className="w-3.5 h-3.5"/> المصادر العلمية</p>
        <div className="space-y-2">
          {[
            { title: 'Lippincott — IV Therapy Nursing Manual (2022)', url: 'https://www.nursingcenter.com/ncblog/november-2016/iv-therapy-manual' },
            { title: 'INS — Infusion Therapy Standards of Practice (2021)', url: 'https://www.ins1.org/standards-of-practice/' },
            { title: 'WHO — Guide to Good Nursing Practice: IV Fluids', url: 'https://www.who.int/publications/i/item/9789241549677' },
          ].map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-[10px] text-cyan-600 font-semibold hover:underline">
              <ExternalLink className="w-3 h-3 shrink-0" />{s.title}
            </a>
          ))}
        </div>
      </div>

    </div>
  );
}
