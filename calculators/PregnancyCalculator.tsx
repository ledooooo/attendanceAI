import React, { useState } from 'react';
import { ArrowRight, Save, Loader2, BookOpen, ExternalLink, Info, Baby } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

interface Props { onBack?: () => void; }

// ─── SVG Icon ─────────────────────────────────────────────────────────────────
const PregnancyIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
    <rect width="48" height="48" rx="14" fill="#FFF0F6"/>
    {/* Body silhouette */}
    <ellipse cx="24" cy="16" rx="7" ry="7" fill="#FFD6EB" stroke="#EC4899" strokeWidth="1.3"/>
    {/* Pregnant belly */}
    <path d="M17 22C17 22 15 24 15 28C15 33 18 37 24 38C30 37 33 33 33 28C33 24 31 22 31 22" fill="#FFD6EB" stroke="#EC4899" strokeWidth="1.3"/>
    {/* Baby inside */}
    <circle cx="24" cy="30" r="5" fill="#FFC0DB" stroke="#EC4899" strokeWidth="1"/>
    <circle cx="24" cy="28.5" r="1.5" fill="#EC4899" opacity="0.6"/>
    {/* Heart */}
    <path d="M22.5 33.5C22.5 33.5 21 32 21 31C21 30.2 21.7 29.5 22.5 29.5C22.9 29.5 23.3 29.7 23.5 30C23.7 29.7 24.1 29.5 24.5 29.5C25.3 29.5 26 30.2 26 31C26 32 24.5 33.5 24.5 33.5H22.5Z" fill="#EC4899"/>
  </svg>
);

// ─── Milestones per week ───────────────────────────────────────────────────────
const getMilestone = (weeks: number): { baby: string; mom: string; appt: string | null } => {
  if (weeks < 4)  return { baby: 'تخصيب ومرحلة التكاثر الخلوي', mom: 'قد لا تظهر أعراض بعد', appt: null };
  if (weeks < 6)  return { baby: 'تشكّل الأنبوب العصبي والقلب يبدأ بالنبض', mom: 'غثيان صباحي واحتقان الثدي شائعان', appt: 'اختبار الحمل وبدء حمض الفوليك' };
  if (weeks < 8)  return { baby: 'الجنين بحجم حبة الليمون — تتشكل الأطراف', mom: 'غثيان وإرهاق وزيادة التبول', appt: 'أول زيارة للطبيب — إيكو مبكر' };
  if (weeks < 12) return { baby: 'تكتمل أعضاء الجنين الرئيسية — حجم قريش الإصبع', mom: 'بداية تراجع الغثيان في كثير من الحالات', appt: 'فحص NT (سماكة الرقبة) + تحاليل أولى الثلث' };
  if (weeks < 16) return { baby: 'يمكن تحديد جنس الجنين — يتحرك بنشاط', mom: 'ظهور بطن ملحوظ وتراجع أعراض الثلث الأول', appt: 'تحاليل الثلث الثاني — Triple/Quad Screen' };
  if (weeks < 20) return { baby: 'الجنين يسمع الأصوات ويتحرك بقوة', mom: 'حركة الجنين تُشعَر بها (الحركات الأولى)', appt: 'إيكو تشريحي مفصّل (أسبوع 18–20)' };
  if (weeks < 24) return { baby: 'الرئتان تتطوران — بصمة أصابع تتشكل', mom: 'حرقة وأوجاع ظهر وتورم خفيف', appt: 'فحص سكر الحمل (Glucose Challenge Test)' };
  if (weeks < 28) return { baby: 'يفتح عينيه — نوم وصحيان منتظمان', mom: 'اشتداد حركة الجنين', appt: 'إبرة Rh لمن دمهم سالب + فحص فقر الدم' };
  if (weeks < 32) return { baby: 'يزداد الوزن بسرعة — دهون تحت الجلد تتراكم', mom: 'صعوبة في التنفس وضغط على المثانة', appt: 'إيكو تكميلي ومتابعة دورية كل أسبوعين' };
  if (weeks < 36) return { baby: 'الرئتان شبه مكتملة — وضعية الولادة تبدأ', mom: 'تقلصات براكستون هيكس وتعب شديد', appt: 'فحص Group B Strep + تقييم وضع الجنين' };
  if (weeks < 40) return { baby: 'جاهز للولادة — الرأس ينزل للحوض', mom: 'تقلصات متزايدة وإفرازات أكثر', appt: 'زيارات أسبوعية — تقييم عنق الرحم' };
  return { baby: 'الجنين مكتمل النمو ويتوقع ولادته خلال أيام', mom: 'وضعية المخاض وانتظار بدء الطلق', appt: 'التواصل الفوري مع الطبيب إذا بدأت أعراض المخاض' };
};

const apptSchedule = [
  { week: '4–8',  title: 'الزيارة الأولى',        items: ['تأكيد الحمل وحساب EDD', 'تحاليل دم شاملة', 'فحص بول', 'بدء حمض الفوليك وفيتامين D'] },
  { week: '10–13',title: 'الثلث الأول المتأخر',   items: ['إيكو NT (سماكة القفا)', 'Double/Triple Marker', 'تحليل دم RH وصورة دم كاملة'] },
  { week: '18–22',title: 'إيكو تشريحي',            items: ['فحص أعضاء الجنين كاملة', 'قياس طول عنق الرحم', 'تحديد موضع المشيمة'] },
  { week: '24–28',title: 'فحص سكر الحمل',          items: ['Glucose Challenge Test (GCT)', 'إبرة Anti-D (إذا Rh سالب)', 'فحص فقر الدم'] },
  { week: '32–34',title: 'إيكو متأخر',             items: ['تقييم نمو الجنين وموضعه', 'قياس السائل الأمنيوسي', 'متابعة المشيمة'] },
  { week: '36+',  title: 'تحضير للولادة',          items: ['Group B Strep (GBS)', 'فحص عنق الرحم', 'مناقشة خطة الولادة'] },
];

export default function PregnancyCalculator({ onBack }: Props) {
  const [lmp, setLmp] = useState('');
  const [cycleLength, setCycleLength] = useState('28');
  const [result, setResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'appts'>('overview');
  const [loading, setLoading] = useState(false);

  const calculate = () => {
    if (!lmp) { toast.error('يرجى إدخال تاريخ آخر دورة'); return; }
    const lmpDate = new Date(lmp);
    const adj = parseInt(cycleLength) - 28;
    const eddDate = new Date(lmpDate);
    eddDate.setDate(lmpDate.getDate() + 280 + adj);

    const today = new Date();
    const diffMs = today.getTime() - lmpDate.getTime();
    if (diffMs < 0) { toast.error('تاريخ آخر دورة يجب أن يكون في الماضي'); return; }

    const diffDays = Math.floor(diffMs / 86400000);
    const weeks = Math.floor(diffDays / 7);
    const days = diffDays % 7;
    const remainingDays = Math.max(0, 280 + adj - diffDays);
    const progress = Math.min(100, (diffDays / (280 + adj)) * 100);

    let trimester = '', triColor = '', triNum = 1;
    if (weeks < 13) { trimester = 'الثلث الأول'; triColor = 'bg-blue-100 text-blue-700 border-blue-200'; triNum = 1; }
    else if (weeks < 27) { trimester = 'الثلث الثاني'; triColor = 'bg-green-100 text-green-700 border-green-200'; triNum = 2; }
    else { trimester = 'الثلث الثالث'; triColor = 'bg-pink-100 text-pink-700 border-pink-200'; triNum = 3; }

    const milestone = getMilestone(weeks);

    setResult({
      edd: eddDate.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      eddShort: eddDate.toLocaleDateString('ar-EG'),
      weeks, days, remainingDays, trimester, triColor, triNum, progress,
      milestone, diffDays,
    });
  };

  const saveResult = async () => {
    if (!result) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول');
      await supabase.from('saved_calculations').insert({
        user_id: user.id, title: 'حاسبة الحمل (EDD)',
        result: `الموعد: ${result.eddShort} | العمر: ${result.weeks} أسبوع و${result.days} يوم`,
        input_data: { lmp, cycleLength }
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
          <PregnancyIcon />
          <div>
            <h2 className="text-xl font-black text-gray-800">حاسبة الحمل والولادة</h2>
            <p className="text-xs text-gray-400 font-semibold">EDD · GA · Pregnancy Milestones</p>
          </div>
        </div>
      </div>

      {/* ── Info ── */}
      <div className="bg-pink-50 p-4 rounded-2xl border border-pink-100 mb-5 flex gap-3 text-pink-800">
        <Info className="w-5 h-5 shrink-0 mt-0.5 text-pink-400" />
        <div className="text-xs leading-relaxed">
          <p className="font-bold mb-1">قاعدة Naegele للحساب</p>
          <p>موعد الولادة = LMP + 280 يوم (40 أسبوع). يُعدَّل حسب طول الدورة: الدورة &gt; 28 يوم = EDD يتأخر، &lt; 28 يوم = يتقدم.</p>
        </div>
      </div>

      {/* ── Form ── */}
      <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-gray-100 space-y-4">
        <div>
          <label className="text-xs font-bold text-gray-600 mb-1.5 block">تاريخ أول يوم لآخر دورة (LMP)</label>
          <input type="date" value={lmp} onChange={e => setLmp(e.target.value)}
            className="w-full p-3.5 rounded-xl border bg-gray-50 focus:bg-white focus:border-pink-400 outline-none font-bold text-gray-800" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-gray-600">طول الدورة المعتادة</label>
            <span className="text-[10px] font-bold bg-pink-50 text-pink-600 px-2 py-0.5 rounded-full">{cycleLength} يوماً</span>
          </div>
          <input type="range" min="21" max="45" value={cycleLength} onChange={e => setCycleLength(e.target.value)}
            className="w-full accent-pink-500" />
          <div className="flex justify-between text-[9px] text-gray-400 font-bold mt-1">
            <span>21 يوم</span><span>28 (معتاد)</span><span>45 يوم</span>
          </div>
        </div>
        <button onClick={calculate}
          className="w-full bg-pink-500 text-white py-3.5 rounded-xl font-black text-base hover:bg-pink-600 shadow-md active:scale-95 transition-all">
          احسب موعد الولادة
        </button>
      </div>

      {/* ── Result ── */}
      {result && (
        <div className="mt-5 space-y-4 animate-in slide-in-from-bottom-4">

          {/* EDD hero */}
          <div className="bg-gradient-to-br from-pink-500 to-rose-500 text-white p-6 rounded-[2rem] text-center relative overflow-hidden shadow-lg shadow-pink-200">
            <Baby className="absolute -bottom-2 -right-2 w-24 h-24 text-white/10 rotate-12" />
            <div className="relative z-10">
              <p className="text-pink-100 text-xs font-bold mb-1">موعد الولادة المتوقع (EDD)</p>
              <p className="text-2xl font-black leading-tight">{result.edd}</p>
              <p className="text-pink-200 text-xs mt-1 font-semibold">باقي {result.remainingDays} يوم</p>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white p-3 rounded-2xl border border-gray-100 text-center">
              <p className="text-[9px] text-gray-400 font-bold mb-0.5">عمر الحمل</p>
              <p className="text-lg font-black text-gray-800">{result.weeks}<span className="text-xs text-gray-400">أسبوع</span></p>
              <p className="text-[9px] text-gray-400">{result.days} يوم</p>
            </div>
            <div className={`p-3 rounded-2xl border text-center ${result.triColor}`}>
              <p className="text-[9px] font-bold mb-0.5 opacity-70">المرحلة</p>
              <p className="text-xs font-black">{result.trimester}</p>
              <p className="text-[9px] opacity-70">الثلث {result.triNum === 1 ? 'الأول' : result.triNum === 2 ? 'الثاني' : 'الثالث'}</p>
            </div>
            <div className="bg-white p-3 rounded-2xl border border-gray-100 text-center">
              <p className="text-[9px] text-gray-400 font-bold mb-0.5">التقدم</p>
              <p className="text-lg font-black text-pink-600">{Math.round(result.progress)}%</p>
              <p className="text-[9px] text-gray-400">من 40 أسبوع</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100">
            <div className="flex justify-between text-[9px] text-gray-400 font-bold mb-1.5">
              <span>بداية الحمل</span><span>الولادة ({result.eddShort})</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-pink-400 to-rose-500 rounded-full transition-all duration-1000"
                style={{ width: `${result.progress}%` }} />
            </div>
            <div className="flex justify-between text-[9px] text-gray-400 font-bold mt-1">
              <span className="text-pink-500 font-black">الأسبوع {result.weeks}</span>
              <span>40 أسبوع</span>
            </div>
          </div>

          {/* Tab switch */}
          <div className="flex bg-gray-100 p-1.5 rounded-xl">
            <button onClick={() => setActiveTab('overview')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${activeTab === 'overview' ? 'bg-white shadow text-pink-600' : 'text-gray-500'}`}>
              🍼 مراحل نمو الجنين
            </button>
            <button onClick={() => setActiveTab('appts')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${activeTab === 'appts' ? 'bg-white shadow text-pink-600' : 'text-gray-500'}`}>
              📅 مواعيد الرعاية
            </button>
          </div>

          {activeTab === 'overview' && (
            <div className="space-y-3">
              <div className="bg-pink-50 p-4 rounded-2xl border border-pink-100">
                <p className="text-[10px] font-black text-pink-600 mb-2">👶 الجنين في الأسبوع {result.weeks}</p>
                <p className="text-xs text-gray-700 font-semibold leading-relaxed">{result.milestone.baby}</p>
              </div>
              <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100">
                <p className="text-[10px] font-black text-rose-600 mb-2">🤰 الأم في الأسبوع {result.weeks}</p>
                <p className="text-xs text-gray-700 font-semibold leading-relaxed">{result.milestone.mom}</p>
              </div>
              {result.milestone.appt && (
                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
                  <p className="text-[10px] font-black text-amber-600 mb-1">📌 موعد مهم في هذه المرحلة</p>
                  <p className="text-xs text-amber-700 font-semibold">{result.milestone.appt}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'appts' && (
            <div className="space-y-3">
              {apptSchedule.map((a, i) => {
                const [wMin, wMax] = a.week.includes('–') ? a.week.split('–').map(Number) : [parseInt(a.week), 99];
                const isNow = result.weeks >= wMin && result.weeks <= wMax;
                return (
                  <div key={i} className={`p-4 rounded-2xl border transition-all ${isNow ? 'border-pink-300 bg-pink-50' : 'border-gray-100 bg-white'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <p className={`font-black text-xs ${isNow ? 'text-pink-700' : 'text-gray-700'}`}>{a.title}</p>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${isNow ? 'bg-pink-200 text-pink-700' : 'bg-gray-100 text-gray-500'}`}>
                        {isNow ? '◀ الآن' : `أسبوع ${a.week}`}
                      </span>
                    </div>
                    {a.items.map((item, j) => (
                      <p key={j} className="text-[10px] text-gray-600 font-semibold mb-1">• {item}</p>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          <button onClick={saveResult} disabled={loading}
            className="w-full flex items-center justify-center gap-2 text-sm bg-gray-800 text-white px-5 py-3.5 rounded-xl font-bold shadow-md hover:bg-gray-900 transition-colors">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ النتيجة
          </button>
        </div>
      )}

      {/* ── Sources ── */}
      <div className="mt-5 p-4 bg-gray-50 rounded-2xl border border-gray-100">
        <p className="flex items-center gap-1.5 text-xs font-black text-gray-600 mb-3"><BookOpen className="w-3.5 h-3.5"/> المصادر العلمية</p>
        <div className="space-y-2">
          {[
            { title: 'ACOG — Gestational Age & EDD Guidelines', url: 'https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2017/05/methods-for-estimating-the-due-date' },
            { title: 'WHO — Antenatal Care Model for a Positive Pregnancy', url: 'https://www.who.int/reproductivehealth/publications/antenatal-care-guidelines/en/' },
            { title: 'NICE — Antenatal Care Guidance (NG201)', url: 'https://www.nice.org.uk/guidance/ng201' },
          ].map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-[10px] text-pink-600 font-semibold hover:underline">
              <ExternalLink className="w-3 h-3 shrink-0" />{s.title}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
