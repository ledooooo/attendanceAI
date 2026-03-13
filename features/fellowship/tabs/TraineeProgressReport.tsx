import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import {
  GraduationCap, CheckCircle2, XCircle, Clock, Loader2,
  BookOpen, Activity, FileText, Presentation, MapPin,
  ClipboardList, BarChart2, AlertTriangle, Download, Star
} from 'lucide-react';

// ─── Requirement types ─────────────────────────────────────────────────────────
interface Req {
  id: string; label: string; sublabel?: string;
  done: boolean; value: number; target: number;
  icon: any; color: string; bg: string;
  blocking: boolean; // هل غيابه يمنع التخرج؟
}

// ─── Single requirement row ────────────────────────────────────────────────────
function ReqRow({ req }: { req: Req }) {
  const Icon = req.icon;
  const pct  = Math.min(Math.round((req.value / Math.max(req.target, 1)) * 100), 100);
  return (
    <div className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all ${
      req.done
        ? 'bg-emerald-50/60 border-emerald-200'
        : req.blocking
          ? 'bg-rose-50/60 border-rose-200'
          : 'bg-amber-50/40 border-amber-200'
    }`}>
      {/* Icon */}
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${req.bg} ${req.color}`}>
        <Icon size={17} />
      </div>

      {/* Label + bar */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-black text-gray-800 leading-tight">{req.label}</p>
          <span className={`text-[11px] font-black ml-2 flex-shrink-0 ${req.done ? 'text-emerald-700' : req.blocking ? 'text-rose-600' : 'text-amber-600'}`}>
            {req.value}/{req.target}
          </span>
        </div>
        {req.sublabel && <p className="text-[10px] font-semibold text-gray-400 mb-1.5">{req.sublabel}</p>}
        <div className="h-1.5 bg-white/70 rounded-full overflow-hidden border border-gray-200">
          <div className={`h-full rounded-full transition-all duration-1000 ${
            req.done ? 'bg-emerald-500' : req.blocking ? 'bg-rose-400' : 'bg-amber-400'
          }`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Status badge */}
      <div className="flex-shrink-0">
        {req.done
          ? <CheckCircle2 size={20} className="text-emerald-500" />
          : req.blocking
            ? <XCircle size={20} className="text-rose-400" />
            : <Clock size={20} className="text-amber-400" />
        }
      </div>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function TraineeProgressReport({ employeeId }: { employeeId: string }) {
  const [loading, setLoading] = useState(true);
  const [trainee, setTrainee] = useState<any>(null);
  const [reqs, setReqs]       = useState<Req[]>([]);

  const TOTAL_SKILLS    = 34;
  const TOTAL_ROTATIONS = 15;
  const LOGBOOK_TARGET  = 50;
  const PORTFOLIO_TARGET = 12; // 4 case study + 4 journal + 4 health ed + 1 research + 1 cv + 1 incident

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: t } = await supabase.from('fellowship_trainees')
          .select('*, employee:employees(name, specialty, photo_url)')
          .eq('employee_id', employeeId).single();
        if (!t) { setLoading(false); return; }
        setTrainee(t);

        // ── Parallel fetches ─────────────────────────────────────────────
        const [
          { count: totalLogs }, { count: approvedLogs },
          { count: dopsCount },
          { count: portCount },
          { count: lecTotal }, { count: lecAtt },
          { data: rots },
          { data: aktRes }, { data: progRes }, { data: csaRes },
          { data: tars },
        ] = await Promise.all([
          supabase.from('fellowship_logbook').select('*', { count: 'exact', head: true }).eq('trainee_id', t.id),
          supabase.from('fellowship_logbook').select('*', { count: 'exact', head: true }).eq('trainee_id', t.id).eq('trainer_reviewed', true),
          supabase.from('fellowship_dops_assessments').select('*', { count: 'exact', head: true }).eq('trainee_id', t.id),
          supabase.from('fellowship_portfolio_items').select('*', { count: 'exact', head: true }).eq('trainee_id', t.id),
          supabase.from('fellowship_lectures').select('*', { count: 'exact', head: true }),
          supabase.from('fellowship_lecture_attendance').select('*', { count: 'exact', head: true }).eq('trainee_id', t.id),
          supabase.from('fellowship_trainee_rotations').select('status').eq('trainee_id', t.id),
          supabase.from('fellowship_akt_results').select('passed').eq('trainee_id', t.id),
          supabase.from('fellowship_progression_results').select('passed').eq('trainee_id', t.id),
          supabase.from('fellowship_csa_results').select('passed').eq('trainee_id', t.id),
          supabase.from('fellowship_tar_reports').select('id').eq('trainee_id', t.id),
        ]);

        const completedRots = (rots || []).filter(r => r.status === 'completed').length;
        const aktPassed     = (aktRes || []).some(r => r.passed);
        const progPassed    = (progRes || []).some(r => r.passed);
        const csaPassed     = (csaRes || []).some(r => r.passed);
        const logbookPassed = (approvedLogs || 0) >= LOGBOOK_TARGET;
        const dopsPassed    = (dopsCount || 0) >= TOTAL_SKILLS;
        const portPassed    = (portCount || 0) >= PORTFOLIO_TARGET;
        const rotPassed     = completedRots >= TOTAL_ROTATIONS;
        const attPct        = lecTotal ? Math.round(((lecAtt || 0) / lecTotal) * 100) : 100;
        const attPassed     = attPct >= 75;

        setReqs([
          {
            id: 'logbook', label: 'سجل الحالات (Logbook)',
            sublabel: 'مطلوب 50 حالة معتمدة على الأقل سنوياً',
            done: logbookPassed, value: approvedLogs || 0, target: LOGBOOK_TARGET,
            icon: BookOpen, color: 'text-blue-600', bg: 'bg-blue-100', blocking: true,
          },
          {
            id: 'dops', label: 'تقييم المهارات العملية (DOPS)',
            sublabel: 'مطلوب تقييم جميع المهارات الـ 34',
            done: dopsPassed, value: dopsCount || 0, target: TOTAL_SKILLS,
            icon: Activity, color: 'text-purple-600', bg: 'bg-purple-100', blocking: true,
          },
          {
            id: 'portfolio', label: 'ملف الإنجاز (Portfolio)',
            sublabel: '4 دراسة حالة + 4 نادي علمي + 4 تثقيف + 1 بحث + 1 CV + 1 تقرير',
            done: portPassed, value: portCount || 0, target: PORTFOLIO_TARGET,
            icon: FileText, color: 'text-amber-600', bg: 'bg-amber-100', blocking: true,
          },
          {
            id: 'rotations', label: 'الدورات التدريبية',
            sublabel: 'مطلوب إكمال الـ 15 دورة بحضور ≥75%',
            done: rotPassed, value: completedRots, target: TOTAL_ROTATIONS,
            icon: MapPin, color: 'text-cyan-600', bg: 'bg-cyan-100', blocking: true,
          },
          {
            id: 'attendance', label: 'حضور المحاضرات العلمية',
            sublabel: 'نسبة الحضور المطلوبة ≥75%',
            done: attPassed, value: attPct, target: 100,
            icon: Presentation, color: 'text-orange-600', bg: 'bg-orange-100', blocking: false,
          },
          {
            id: 'tar', label: 'تقارير التقييم الدوري (TAR)',
            sublabel: 'تقرير كل فصل دراسي',
            done: (tars?.length || 0) >= 3, value: tars?.length || 0, target: 3,
            icon: ClipboardList, color: 'text-teal-600', bg: 'bg-teal-100', blocking: false,
          },
          {
            id: 'akt', label: 'اختبار المعرفة التطبيقية (AKT)',
            sublabel: 'درجة النجاح ≥60% · 4 محاولات كحد أقصى',
            done: aktPassed, value: aktPassed ? 1 : (aktRes?.length || 0), target: 1,
            icon: BarChart2, color: 'text-indigo-600', bg: 'bg-indigo-100', blocking: true,
          },
          {
            id: 'progression', label: 'امتحان التقدم (Progression)',
            sublabel: 'يُعقد نهاية كل سنة تدريبية',
            done: progPassed, value: progPassed ? 1 : (progRes?.length || 0), target: 1,
            icon: BarChart2, color: 'text-violet-600', bg: 'bg-violet-100', blocking: true,
          },
          {
            id: 'csa', label: 'امتحان المهارات السريرية (CSA)',
            sublabel: 'مطلوب النجاح في 10 من 14 محطة',
            done: csaPassed, value: csaPassed ? 1 : (csaRes?.length || 0), target: 1,
            icon: Stethoscope, color: 'text-rose-600', bg: 'bg-rose-100', blocking: true,
          },
        ]);

      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    if (employeeId) load();
  }, [employeeId]);

  // ── Summary ──────────────────────────────────────────────────────────────
  const doneCount     = reqs.filter(r => r.done).length;
  const blockingFails = reqs.filter(r => !r.done && r.blocking).length;
  const allDone       = doneCount === reqs.length;
  const readyPct      = reqs.length > 0 ? Math.round((doneCount / reqs.length) * 100) : 0;

  const name0 = trainee?.employee?.name?.split(' ')[0] || '';

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-28 gap-3">
      <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
      </div>
      <p className="text-sm font-bold text-gray-400">جاري تحليل متطلبات التخرج...</p>
    </div>
  );

  if (!trainee) return (
    <div className="p-8 text-center">
      <GraduationCap className="w-12 h-12 mx-auto text-gray-200 mb-3" />
      <p className="font-bold text-gray-400">حساب المتدرب غير مفعّل.</p>
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-5 animate-in fade-in duration-400" dir="rtl">

      {/* ══ Hero ═══════════════════════════════════════════════════════════ */}
      <div className={`relative rounded-3xl overflow-hidden p-5 md:p-7 ${
        allDone
          ? 'bg-gradient-to-br from-emerald-600 to-teal-700'
          : blockingFails > 0
            ? 'bg-gradient-to-br from-indigo-700 to-violet-800'
            : 'bg-gradient-to-br from-amber-600 to-orange-700'
      }`}>
        <div className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: 'radial-gradient(circle, white 1.5px, transparent 1.5px)', backgroundSize: '22px 22px' }} />
        <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-white/5 rounded-full" />

        <div className="relative flex flex-col md:flex-row items-start md:items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center flex-shrink-0 overflow-hidden text-white text-2xl font-black">
            {trainee.employee?.photo_url
              ? <img src={trainee.employee.photo_url} className="w-full h-full object-cover" alt="" />
              : name0.charAt(0)
            }
          </div>
          <div className="flex-1">
            <p className="text-white/60 text-xs font-semibold">تقرير جاهزية التخرج</p>
            <h2 className="text-xl font-black text-white leading-tight">د. {trainee.employee?.name}</h2>
            <p className="text-white/50 text-xs font-semibold mt-0.5">{trainee.trainee_code} · السنة {trainee.current_year} من 3</p>
          </div>

          {/* Big status badge */}
          <div className="bg-white/15 backdrop-blur border border-white/20 rounded-2xl px-5 py-4 text-center flex-shrink-0">
            {allDone ? (
              <>
                <p className="text-3xl font-black text-white">🎓</p>
                <p className="text-[11px] font-black text-white/80 mt-1">جاهز للتخرج!</p>
              </>
            ) : (
              <>
                <p className="text-3xl font-black text-white">{readyPct}%</p>
                <p className="text-[10px] font-black text-white/70 mt-1">اكتمال المتطلبات</p>
              </>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative mt-5 pt-5 border-t border-white/10">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-black text-white/80">
              {doneCount} من {reqs.length} متطلب مكتمل
            </span>
            {blockingFails > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-black bg-rose-500/70 text-white px-2.5 py-1 rounded-full">
                <AlertTriangle size={10}/> {blockingFails} إلزامي ناقص
              </span>
            )}
          </div>
          <div className="h-2.5 bg-white/15 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all duration-1000"
              style={{ width: `${readyPct}%` }} />
          </div>
        </div>
      </div>

      {/* ══ Blocking requirements ════════════════════════════════════════════ */}
      <div>
        <h3 className="text-xs font-black text-gray-600 mb-3 flex items-center gap-2 px-1">
          <AlertTriangle size={14} className="text-rose-500" /> المتطلبات الإلزامية للتخرج
        </h3>
        <div className="space-y-2.5">
          {reqs.filter(r => r.blocking).map(r => <ReqRow key={r.id} req={r} />)}
        </div>
      </div>

      {/* ══ Non-blocking requirements ════════════════════════════════════════ */}
      <div>
        <h3 className="text-xs font-black text-gray-600 mb-3 flex items-center gap-2 px-1">
          <Star size={14} className="text-amber-400 fill-amber-400" /> متطلبات تكميلية
        </h3>
        <div className="space-y-2.5">
          {reqs.filter(r => !r.blocking).map(r => <ReqRow key={r.id} req={r} />)}
        </div>
      </div>

      {/* ══ Summary card ════════════════════════════════════════════════════ */}
      <div className={`rounded-2xl border p-5 ${
        allDone ? 'bg-emerald-50 border-emerald-200' :
        blockingFails > 0 ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'
      }`}>
        {allDone ? (
          <div className="text-center">
            <p className="text-3xl mb-2">🎓🎉</p>
            <h3 className="text-base font-black text-emerald-800">تهانينا! استكملت جميع متطلبات التخرج</h3>
            <p className="text-xs font-bold text-emerald-600 mt-1">يمكنك التقدم للجنة الامتحانات لاستلام شهادة الزمالة</p>
          </div>
        ) : blockingFails > 0 ? (
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-rose-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-black text-rose-800">لم تكتمل المتطلبات بعد</h3>
              <p className="text-xs font-bold text-rose-600 mt-1">
                {blockingFails} متطلب إلزامي لم يكتمل بعد. يجب استكمالها قبل التقدم للتخرج.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <Clock size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-black text-amber-800">قريباً من الاكتمال</h3>
              <p className="text-xs font-bold text-amber-600 mt-1">أكملت جميع المتطلبات الإلزامية. باقي بعض التكميليات.</p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

// minor import needed
import { Stethoscope } from 'lucide-react';
