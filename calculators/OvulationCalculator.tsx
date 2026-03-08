import React, { useState } from 'react';
import { ArrowRight, Heart, Sparkles, Save, Loader2, BookOpen, ExternalLink, Info } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

interface Props { onBack?: () => void; }

// ─── SVG Icon ─────────────────────────────────────────────────────────────────
const OvulationIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
    <rect width="48" height="48" rx="14" fill="#FDF4FF"/>
    {/* Calendar base */}
    <rect x="8" y="14" width="32" height="26" rx="4" fill="#F3E8FF" stroke="#9333EA" strokeWidth="1.3"/>
    <rect x="8" y="14" width="32" height="8" rx="4" fill="#DDD6FE" stroke="#9333EA" strokeWidth="1.3"/>
    {/* Calendar pins */}
    <path d="M16 10V16M32 10V16" stroke="#9333EA" strokeWidth="1.8" strokeLinecap="round"/>
    {/* Days */}
    <circle cx="17" cy="28" r="2" fill="#C084FC"/>
    <circle cx="24" cy="28" r="2.5" fill="#9333EA"/>
    <circle cx="31" cy="28" r="2" fill="#C084FC"/>
    <circle cx="17" cy="35" r="2" fill="#C084FC"/>
    <circle cx="24" cy="35" r="2" fill="#E9D5FF"/>
    {/* Heart on ovulation day */}
    <path d="M23 27.5C23 27.5 22 26.5 21.3 27.2C20.6 27.9 21.5 28.8 23 30C24.5 28.8 25.4 27.9 24.7 27.2C24 26.5 23 27.5 23 27.5Z" fill="white"/>
  </svg>
);

// ─── Mini calendar strip ──────────────────────────────────────────────────────
const CalendarStrip = ({ fertileStartDate, fertileEndDate, ovulationDate }: any) => {
  const days = [];
  const start = new Date(fertileStartDate);
  start.setDate(start.getDate() - 2);
  for (let i = 0; i < 10; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const isOv = d.toDateString() === ovulationDate.toDateString();
    const isFertile = d >= fertileStartDate && d <= fertileEndDate;
    days.push({ date: d, isOv, isFertile });
  }
  const dayNames = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'];
  return (
    <div className="flex gap-1.5 justify-center mt-3">
      {days.map((d, i) => (
        <div key={i} className={`flex flex-col items-center px-1.5 py-2 rounded-xl text-center transition-all
          ${d.isOv ? 'bg-purple-600 text-white shadow-md shadow-purple-200' :
            d.isFertile ? 'bg-green-100 text-green-700 border border-green-200' :
            'bg-gray-50 text-gray-400'}`}>
          <span className="text-[8px] font-bold">{dayNames[d.date.getDay()]}</span>
          <span className="text-[11px] font-black">{d.date.getDate()}</span>
          {d.isOv && <span className="text-[7px]">💜</span>}
        </div>
      ))}
    </div>
  );
};

export default function OvulationCalculator({ onBack }: Props) {
  const [lastPeriod, setLastPeriod] = useState('');
  const [cycleLength, setCycleLength] = useState('28');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fmt = (d: Date) => d.toLocaleDateString('ar-EG', { weekday: 'long', month: 'long', day: 'numeric' });
  const fmtShort = (d: Date) => d.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });

  const calculate = () => {
    if (!lastPeriod) { toast.error('يرجى إدخال تاريخ أول يوم من آخر دورة'); return; }
    const cycle = parseInt(cycleLength);
    if (cycle < 21 || cycle > 45) { toast.error('طول الدورة يجب أن يكون بين 21 و 45 يوماً'); return; }

    const lpDate = new Date(lastPeriod);

    const nextPeriod = new Date(lpDate);
    nextPeriod.setDate(lpDate.getDate() + cycle);

    // Ovulation = 14 days before next period
    const ovulationDate = new Date(nextPeriod);
    ovulationDate.setDate(nextPeriod.getDate() - 14);

    // Fertile window: 5 days before + day of + 1 day after
    const fertileStart = new Date(ovulationDate);
    fertileStart.setDate(ovulationDate.getDate() - 5);
    const fertileEnd = new Date(ovulationDate);
    fertileEnd.setDate(ovulationDate.getDate() + 1);

    // Days until ovulation from today
    const today = new Date();
    const daysUntilOv = Math.round((ovulationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    setResult({
      ovulation: fmt(ovulationDate),
      ovulationDate,
      fertileStart: fmtShort(fertileStart),
      fertileEnd: fmtShort(fertileEnd),
      fertileStartDate: fertileStart,
      fertileEndDate: fertileEnd,
      nextPeriod: fmt(nextPeriod),
      nextPeriodDate: nextPeriod,
      daysUntilOv,
    });
  };

  const saveResult = async () => {
    if (!result) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول أولاً');
      await supabase.from('saved_calculations').insert({
        user_id: user.id, title: 'حاسبة التبويض والخصوبة',
        result: `التبويض: ${result.ovulation} | نافذة الخصوبة: ${result.fertileStart} – ${result.fertileEnd}`,
        input_data: { lastPeriod, cycleLength }
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
          <OvulationIcon />
          <div>
            <h2 className="text-xl font-black text-gray-800">حاسبة التبويض والخصوبة</h2>
            <p className="text-xs text-gray-400 font-semibold">Ovulation & Fertile Window</p>
          </div>
        </div>
      </div>

      {/* ── Info ── */}
      <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100 mb-5 flex gap-3 text-purple-800">
        <Info className="w-5 h-5 shrink-0 mt-0.5 text-purple-400" />
        <div className="text-xs leading-relaxed">
          <p className="font-bold mb-1">كيف تعمل الحاسبة؟</p>
          <p>يحدث التبويض عادةً قبل 14 يوماً من بداية الدورة التالية. نافذة الخصوبة تمتد من 5 أيام قبل التبويض حتى يوم بعده، وهي الفترة التي تكون فيها احتمالية الحمل أعلى.</p>
        </div>
      </div>

      {/* ── Form ── */}
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-4">
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1.5">أول يوم في آخر دورة شهرية</label>
          <input type="date" value={lastPeriod} onChange={e => setLastPeriod(e.target.value)}
            className="w-full p-3.5 border bg-gray-50 focus:bg-white rounded-xl outline-none focus:border-purple-400 font-bold text-gray-700" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-gray-600">طول الدورة المعتادة</label>
            <span className="text-[10px] font-bold bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">{cycleLength} يوماً</span>
          </div>
          <input type="range" min="21" max="45" value={cycleLength} onChange={e => setCycleLength(e.target.value)}
            className="w-full accent-purple-500" />
          <div className="flex justify-between text-[9px] text-gray-400 font-bold mt-1">
            <span>21 يوماً</span><span>28 (معتاد)</span><span>45 يوماً</span>
          </div>
        </div>
        <button onClick={calculate}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-black py-3.5 rounded-xl transition-all shadow-md active:scale-95">
          احسب أيام الخصوبة
        </button>
      </div>

      {/* ── Result ── */}
      {result && (
        <div className="mt-5 space-y-3 animate-in slide-in-from-bottom-4">

          {/* Countdown */}
          {result.daysUntilOv >= 0 && (
            <div className="bg-purple-50 p-3 rounded-2xl border border-purple-100 text-center">
              <p className="text-xs text-purple-600 font-bold">
                {result.daysUntilOv === 0 ? '🌟 اليوم هو يوم التبويض المتوقع!' :
                 result.daysUntilOv === 1 ? '⏰ غداً هو يوم التبويض المتوقع' :
                 `⏰ باقي ${result.daysUntilOv} يوم على موعد التبويض`}
              </p>
            </div>
          )}

          {/* Ovulation day */}
          <div className="bg-gradient-to-br from-purple-600 to-indigo-600 text-white p-6 rounded-[2rem] text-center relative overflow-hidden shadow-lg shadow-purple-200">
            <div className="relative z-10">
              <p className="text-purple-200 font-bold mb-1 text-xs">يوم التبويض المتوقع</p>
              <p className="text-2xl font-black">{result.ovulation}</p>
              <p className="text-purple-200 text-[10px] mt-1 font-semibold">ذروة الخصوبة</p>
            </div>
            <Sparkles className="absolute top-0 right-0 text-white/10 w-28 h-28 -mr-8 -mt-8"/>
          </div>

          {/* Calendar visual */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100">
            <p className="text-xs font-black text-gray-600 mb-1 text-center">نافذة الخصوبة على التقويم</p>
            <CalendarStrip fertileStartDate={result.fertileStartDate} fertileEndDate={result.fertileEndDate} ovulationDate={result.ovulationDate} />
            <div className="flex items-center justify-center gap-4 mt-3">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-purple-600"/><span className="text-[9px] text-gray-500 font-bold">يوم التبويض</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-green-300"/><span className="text-[9px] text-gray-500 font-bold">نافذة الخصوبة</span></div>
            </div>
          </div>

          {/* Fertile window */}
          <div className="bg-green-50 border border-green-200 p-5 rounded-2xl flex items-center justify-between shadow-sm">
            <div>
              <p className="text-green-700 font-black text-sm mb-0.5 flex items-center gap-1.5">
                <Heart className="w-4 h-4 fill-green-600"/> نافذة الخصوبة
              </p>
              <p className="text-[10px] font-bold text-gray-500">أفضل وقت لحدوث الحمل</p>
            </div>
            <div className="bg-white px-3 py-2 rounded-xl border border-green-100 text-center">
              <p className="text-sm font-black text-green-700">{result.fertileStart}</p>
              <p className="text-[9px] text-gray-400 font-bold">إلى</p>
              <p className="text-sm font-black text-green-700">{result.fertileEnd}</p>
            </div>
          </div>

          {/* Next period */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between">
            <p className="text-xs font-bold text-gray-500">🗓️ الدورة القادمة المتوقعة</p>
            <p className="text-xs font-black text-gray-800">{result.nextPeriod}</p>
          </div>

          {/* Tip */}
          <div className="bg-amber-50 p-3 rounded-2xl border border-amber-100">
            <p className="text-[10px] text-amber-700 font-semibold leading-relaxed">💡 <span className="font-black">نصيحة:</span> للزيادة من فرص الحمل، يُنصح بالإتيان كل يوم أو يوم بعد يوم خلال نافذة الخصوبة. دقة الحسابات تزداد مع انتظام الدورة.</p>
          </div>

          <button onClick={saveResult} disabled={loading}
            className="w-full flex items-center justify-center gap-2 text-sm bg-white px-5 py-3.5 rounded-xl font-bold text-gray-800 hover:bg-gray-50 shadow-sm border">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ في السجل
          </button>
        </div>
      )}

      {/* ── Sources ── */}
      <div className="mt-6 p-4 bg-gray-50 rounded-2xl border border-gray-100">
        <p className="flex items-center gap-1.5 text-xs font-black text-gray-600 mb-3"><BookOpen className="w-3.5 h-3.5"/> المصادر العلمية</p>
        <div className="space-y-2">
          {[
            { title: 'ACOG — Fertility Awareness Methods (2019)', url: 'https://www.acog.org/womens-health/faqs/fertility-awareness-based-methods-of-family-planning' },
            { title: 'Wilcox AJ et al. — Timing of intercourse (NEJM, 1995)', url: 'https://pubmed.ncbi.nlm.nih.gov/7477165/' },
            { title: 'WHO — Selected Practice Recommendations for Contraceptive Use', url: 'https://www.who.int/publications/i/item/9789241549158' },
          ].map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-[10px] text-purple-600 font-semibold hover:underline">
              <ExternalLink className="w-3 h-3 shrink-0" />{s.title}
            </a>
          ))}
        </div>
        <p className="text-[9px] text-gray-400 font-semibold mt-3">⚠️ هذه الحاسبة للدورات المنتظمة فقط. الدورات غير المنتظمة تحتاج متابعة طبية متخصصة.</p>
      </div>

    </div>
  );
}
