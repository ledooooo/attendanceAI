import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import {
  ClipboardList, Loader2, AlertCircle, User, Calendar,
  CheckCircle2, Clock, ChevronDown, Star, TrendingUp
} from 'lucide-react';

const RATING_MAP: Record<number, { label: string; color: string; bg: string; bar: string; emoji: string }> = {
  1: { label: 'دون المتوقع',      color: 'text-rose-700',    bg: 'bg-rose-50',    bar: 'bg-rose-400',    emoji: '😟' },
  2: { label: 'يلبي التوقعات',   color: 'text-amber-700',   bg: 'bg-amber-50',   bar: 'bg-amber-400',   emoji: '😐' },
  3: { label: 'فوق المتوقع',     color: 'text-blue-700',    bg: 'bg-blue-50',    bar: 'bg-blue-500',    emoji: '😊' },
  4: { label: 'متميز',           color: 'text-emerald-700', bg: 'bg-emerald-50', bar: 'bg-emerald-500', emoji: '🌟' },
};

// ─── Horizontal Rating Bar ─────────────────────────────────────────────────────
function RatingBar({ rating, max = 4 }: { rating: number; max?: number }) {
  const ri = RATING_MAP[rating] || RATING_MAP[2];
  const pct = (rating / max) * 100;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${ri.bar} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[10px] font-black w-4 ${ri.color}`}>{rating}</span>
    </div>
  );
}

// ─── TAR Card ─────────────────────────────────────────────────────────────────
function TARCard({ report }: { report: any }) {
  const [open, setOpen] = useState(false);
  const ri  = RATING_MAP[report.overall_rating] || RATING_MAP[2];
  const isQ = report.report_period_end && new Date(report.report_period_end) <=
              new Date(Date.now() - 86400000); // past

  return (
    <div className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all overflow-hidden`}
      style={{ borderLeft: `4px solid` }}>
      <div style={{ borderRight: `4px solid`, borderColor: ri.bar.replace('bg-', '').includes('emerald') ? '#10b981' : ri.bar.replace('bg-', '').includes('blue') ? '#3b82f6' : ri.bar.replace('bg-', '').includes('amber') ? '#f59e0b' : '#f87171' }}
        className="border-r-4">
        <div className="p-4 cursor-pointer" onClick={() => setOpen(!open)}>
          <div className="flex items-start gap-3">
            {/* Rating circle */}
            <div className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 ${ri.bg} border border-gray-100`}>
              <span className="text-xl">{ri.emoji}</span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div>
                  <p className="text-xs font-black text-gray-500 mb-0.5">تقرير دوري</p>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400">
                    <span className="flex items-center gap-1"><Calendar size={10}/>
                      {new Date(report.report_period_start).toLocaleDateString('ar-EG')}
                    </span>
                    <span>←</span>
                    <span>{new Date(report.report_period_end).toLocaleDateString('ar-EG')}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${ri.bg} ${ri.color}`}>
                    {ri.label}
                  </span>
                  {report.trainee_acknowledged
                    ? <span className="text-[10px] font-black text-emerald-600 flex items-center gap-1"><CheckCircle2 size={10}/> وقّعت</span>
                    : <span className="text-[10px] font-black text-amber-600 flex items-center gap-1"><Clock size={10}/> انتظار توقيع</span>
                  }
                </div>
              </div>

              {/* Overall rating bar */}
              <RatingBar rating={report.overall_rating} />

              {/* Trainer */}
              {report.trainer?.employee?.name && (
                <p className="text-[10px] font-bold text-gray-400 mt-1.5 flex items-center gap-1">
                  <User size={10}/> {report.trainer.employee.name}
                </p>
              )}
            </div>

            <ChevronDown size={14} className={`text-gray-400 transition-transform flex-shrink-0 mt-1 ${open ? 'rotate-180' : ''}`} />
          </div>
        </div>

        {/* Expanded: trainer comments */}
        {open && (
          <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3 animate-in slide-in-from-top-1 duration-200">
            {report.trainer_comments && (
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <p className="text-[10px] font-black text-gray-400 mb-1.5">تعليقات المدرب</p>
                <p className="text-xs font-bold text-gray-700 leading-relaxed">{report.trainer_comments}</p>
              </div>
            )}

            {!report.trainee_acknowledged && (
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 flex items-center gap-2">
                <Clock size={14} className="text-amber-500 flex-shrink-0" />
                <p className="text-xs font-bold text-amber-700">بانتظار توقيع المتدرب على التقرير.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function TraineeTARTab({ employeeId }: { employeeId: string }) {
  const [loading, setLoading]   = useState(true);
  const [traineeId, setTraineeId] = useState<string | null>(null);
  const [reports, setReports]   = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: t } = await supabase.from('fellowship_trainees').select('id').eq('employee_id', employeeId).single();
        if (!t) { setLoading(false); return; }
        setTraineeId(t.id);
        const { data } = await supabase
          .from('fellowship_tar_reports')
          .select('*, trainer:fellowship_trainers(employee:employees(name))')
          .eq('trainee_id', t.id)
          .order('report_period_start', { ascending: false });
        setReports(data || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    if (employeeId) load();
  }, [employeeId]);

  // ── Trends ──────────────────────────────────────────────────────────────────
  const avgRating  = reports.length > 0
    ? (reports.reduce((s, r) => s + (r.overall_rating || 0), 0) / reports.length).toFixed(1) : '—';
  const latestRi   = reports.length > 0 ? RATING_MAP[reports[0].overall_rating] : null;
  const unsigned   = reports.filter(r => !r.trainee_acknowledged).length;
  const improving  = reports.length >= 2 &&
    (reports[0].overall_rating > reports[1].overall_rating);

  // ── Rating distribution ──────────────────────────────────────────────────────
  const dist = [4,3,2,1].map(r => ({
    r, count: reports.filter(rep => rep.overall_rating === r).length,
    ...RATING_MAP[r],
  }));

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-28 gap-3">
      <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
      </div>
      <p className="text-sm font-bold text-gray-400">جاري تحميل التقارير...</p>
    </div>
  );

  if (!traineeId) return (
    <div className="p-8 text-center">
      <AlertCircle className="w-12 h-12 mx-auto text-orange-300 mb-3" />
      <p className="font-bold text-gray-500">حساب المتدرب غير مفعّل.</p>
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-5 animate-in fade-in duration-400" dir="rtl">

      {/* ══ Header ═══════════════════════════════════════════════════════════ */}
      <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 bg-indigo-50 rounded-2xl flex items-center justify-center">
            <ClipboardList size={22} className="text-indigo-600" />
          </div>
          <div>
            <h2 className="text-base font-black text-gray-800">تقارير التقييم الدوري (TAR)</h2>
            <p className="text-[11px] font-semibold text-gray-400">تقييمات المدرب الفصلية لأدائك خلال التدريب</p>
          </div>
        </div>

        {/* Stats row */}
        {reports.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-gray-50">
            {[
              { label: 'إجمالي التقارير', val: reports.length,           cl: 'text-indigo-600', bg: 'bg-indigo-50' },
              { label: 'متوسط التقييم',   val: `${avgRating}/4`,         cl: 'text-amber-600',  bg: 'bg-amber-50' },
              { label: 'انتظار توقيع',    val: unsigned,                  cl: 'text-rose-600',   bg: 'bg-rose-50' },
              { label: 'التقييم الأخير',  val: latestRi ? latestRi.emoji + ' ' + latestRi.label : '—', cl: latestRi?.color || 'text-gray-600', bg: latestRi?.bg || 'bg-gray-50' },
            ].map(s => (
              <div key={s.label} className={`${s.bg} p-3 rounded-xl`}>
                <p className={`text-sm font-black ${s.cl} leading-tight`}>{s.val}</p>
                <p className="text-[10px] font-bold text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Trend badge */}
        {improving && (
          <div className="mt-3 flex items-center gap-2 bg-emerald-50 rounded-xl px-4 py-2.5 border border-emerald-100">
            <TrendingUp size={16} className="text-emerald-500" />
            <p className="text-xs font-black text-emerald-700">أداؤك في تحسن مستمر! تقييمك الأخير أعلى من السابق.</p>
          </div>
        )}
      </div>

      {/* ══ Distribution chart ════════════════════════════════════════════════ */}
      {reports.length > 0 && (
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="text-xs font-black text-gray-600 mb-4 flex items-center gap-1.5">
            <Star size={14} className="text-amber-400 fill-amber-400" /> توزيع التقييمات
          </h3>
          <div className="space-y-2.5">
            {dist.map(d => (
              <div key={d.r} className="flex items-center gap-3">
                <span className={`text-xl w-8 text-center flex-shrink-0`}>{d.emoji}</span>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className={`text-[11px] font-black ${d.color}`}>{d.label}</span>
                    <span className="text-[10px] font-black text-gray-400">{d.count} تقرير</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${d.bar} transition-all duration-700`}
                      style={{ width: reports.length > 0 ? `${(d.count / reports.length) * 100}%` : '0%' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ Reports list ══════════════════════════════════════════════════════ */}
      {reports.length === 0 ? (
        <div className="bg-white p-14 rounded-2xl border border-dashed border-gray-200 text-center">
          <ClipboardList className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p className="font-black text-gray-400 text-sm">لا توجد تقارير تقييم بعد</p>
          <p className="text-xs font-semibold text-gray-300 mt-1">ستُضاف التقارير من قِبل المدرب كل فصل</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map(r => <TARCard key={r.id} report={r} />)}
        </div>
      )}

    </div>
  );
}
