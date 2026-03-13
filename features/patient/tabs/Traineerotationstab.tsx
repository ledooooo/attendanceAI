import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import {
  MapPin, Loader2, AlertCircle, CheckCircle2, Activity, Clock,
  Calendar, User, ChevronDown, AlertTriangle, Target, GraduationCap
} from 'lucide-react';

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  completed:  { label: 'مكتملة',         color: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200', dot: 'bg-emerald-500' },
  ongoing:    { label: 'جارية الآن',     color: 'text-indigo-700',  bg: 'bg-indigo-50',   border: 'border-indigo-300',  dot: 'bg-indigo-500' },
  scheduled:  { label: 'قادمة',          color: 'text-gray-600',    bg: 'bg-gray-50',     border: 'border-gray-200',    dot: 'bg-gray-400' },
  incomplete: { label: 'غير مكتملة',     color: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-300',   dot: 'bg-amber-400' },
  repeated:   { label: 'تعاد حالياً',    color: 'text-rose-700',    bg: 'bg-rose-50',     border: 'border-rose-300',    dot: 'bg-rose-400' },
};

const YEAR_COLORS: Record<number, { grad: string; text: string; bg: string }> = {
  1: { grad: 'from-blue-600 to-cyan-600',    text: 'text-blue-700',   bg: 'bg-blue-50'   },
  2: { grad: 'from-violet-600 to-purple-600',text: 'text-violet-700', bg: 'bg-violet-50' },
  3: { grad: 'from-emerald-600 to-teal-600', text: 'text-emerald-700',bg: 'bg-emerald-50'},
};

// ─── Duration string ──────────────────────────────────────────────────────────
function durationStr(start: string, end: string) {
  const a = new Date(start), b = new Date(end);
  const days  = Math.round((b.getTime() - a.getTime()) / 86400000);
  const weeks = Math.round(days / 7);
  return weeks > 0 ? `${weeks} أسبوع` : `${days} يوم`;
}

// ─── Attendance badge ─────────────────────────────────────────────────────────
function AttBadge({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const ok = pct >= 75;
  return (
    <span className={`flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full ${ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
      {ok ? <CheckCircle2 size={10}/> : <AlertTriangle size={10}/>}
      حضور {pct}%
    </span>
  );
}

// ─── Single Rotation Card ─────────────────────────────────────────────────────
function RotationCard({ rot, index }: { rot: any; index: number }) {
  const [open, setOpen] = useState(rot.status === 'ongoing');
  const cfg = STATUS_CFG[rot.status] || STATUS_CFG.scheduled;
  const yr  = rot.rotation_type?.training_year || 1;
  const yrClr = YEAR_COLORS[yr] || YEAR_COLORS[1];

  return (
    <div className={`rounded-2xl border shadow-sm hover:shadow-md transition-all overflow-hidden ${cfg.bg} ${cfg.border} ${rot.status === 'ongoing' ? 'ring-2 ring-indigo-300 ring-offset-1' : ''}`}>
      {/* clickable header */}
      <div className="p-4 cursor-pointer" onClick={() => setOpen(!open)}>
        <div className="flex items-start gap-3">
          {/* Index dot */}
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-black flex-shrink-0 ${
            rot.status === 'completed' ? 'bg-emerald-500' :
            rot.status === 'ongoing'   ? 'bg-indigo-600' :
            rot.status === 'incomplete'? 'bg-amber-400'  : 'bg-gray-300'
          }`}>
            {rot.status === 'completed' ? <CheckCircle2 size={16}/> :
             rot.status === 'ongoing'   ? <Activity size={16}/> : index + 1}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className={`text-sm font-black leading-tight ${cfg.color}`}>
                {rot.rotation_type?.name_ar || 'دورة تدريبية'}
                {rot.rotation_type?.is_elective && (
                  <span className="mr-2 text-[10px] font-black bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full">اختيارية</span>
                )}
              </h3>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0 ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                {cfg.label}
              </span>
            </div>
            <p className="text-[11px] font-semibold text-gray-500">{rot.rotation_type?.name_en}</p>

            <div className="flex flex-wrap items-center gap-3 mt-2 text-[10px] font-bold text-gray-500">
              <span className="flex items-center gap-1"><Calendar size={10}/>{new Date(rot.start_date).toLocaleDateString('ar-EG')}</span>
              <span className="text-gray-300">←</span>
              <span className="flex items-center gap-1"><Calendar size={10}/>{new Date(rot.end_date).toLocaleDateString('ar-EG')}</span>
              <span className="flex items-center gap-1 font-black text-gray-600"><Clock size={10}/>{durationStr(rot.start_date, rot.end_date)}</span>
              <AttBadge pct={rot.attendance_percentage} />
            </div>
          </div>

          <ChevronDown size={14} className={`text-gray-400 transition-transform flex-shrink-0 mt-1 ${open ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Expanded details */}
      {open && (
        <div className="px-4 pb-4 pt-0 border-t border-white/50 space-y-2 animate-in slide-in-from-top-1 duration-200">
          {/* Trainer */}
          {rot.trainer?.employee?.name && (
            <div className="flex items-center gap-2 bg-white/60 rounded-xl px-3 py-2 border border-white">
              <User size={13} className="text-gray-500" />
              <span className="text-xs font-black text-gray-700">المدرب المشرف:</span>
              <span className="text-xs font-bold text-indigo-700">{rot.trainer.employee.name}</span>
            </div>
          )}

          {/* Attendance warning */}
          {rot.attendance_percentage !== null && rot.attendance_percentage < 75 && (
            <div className="flex items-center gap-2 bg-rose-50 rounded-xl px-3 py-2 border border-rose-200">
              <AlertTriangle size={13} className="text-rose-500" />
              <span className="text-xs font-bold text-rose-700">نسبة الحضور دون الحد المطلوب (75%). الدورة تحتاج إعادة.</span>
            </div>
          )}

          {/* Year badge */}
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${yrClr.bg} ${yrClr.text}`}>
              السنة التدريبية {yr}
            </span>
            <span className="text-[10px] font-bold text-gray-400">{rot.rotation_type?.duration_months} أشهر مخططة</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function TraineeRotationsTab({ employeeId }: { employeeId: string }) {
  const [loading, setLoading]   = useState(true);
  const [trainee, setTrainee]   = useState<any>(null);
  const [rotations, setRotations] = useState<any[]>([]);
  const [filterYear, setFilterYear] = useState(0); // 0 = all

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: t } = await supabase.from('fellowship_trainees')
          .select('*, employee:employees(name)').eq('employee_id', employeeId).single();
        if (!t) { setLoading(false); return; }
        setTrainee(t);

        const { data: rots } = await supabase
          .from('fellowship_trainee_rotations')
          .select(`
            *,
            rotation_type:fellowship_rotation_types(name_ar, name_en, training_year, duration_months, is_elective),
            trainer:fellowship_trainers(employee:employees(name))
          `)
          .eq('trainee_id', t.id)
          .order('start_date');
        setRotations(rots || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    if (employeeId) load();
  }, [employeeId]);

  const filtered = rotations.filter(r =>
    filterYear === 0 || r.rotation_type?.training_year === filterYear
  );

  // ── Stats ──────────────────────────────────────────────────────────────────
  const completed  = rotations.filter(r => r.status === 'completed').length;
  const ongoing    = rotations.filter(r => r.status === 'ongoing').length;
  const incomplete = rotations.filter(r => r.status === 'incomplete' || r.status === 'repeated').length;
  const totalPlan  = 15;
  const pct        = Math.round((completed / totalPlan) * 100);

  // ── Group by year ──────────────────────────────────────────────────────────
  const byYear: Record<number, any[]> = { 1: [], 2: [], 3: [] };
  filtered.forEach(r => { const y = r.rotation_type?.training_year || 1; if (byYear[y]) byYear[y].push(r); });

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-28 gap-3">
      <div className="w-14 h-14 bg-cyan-50 rounded-2xl flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-cyan-600" />
      </div>
      <p className="text-sm font-bold text-gray-400">جاري تحميل جدول الدورات...</p>
    </div>
  );

  if (!trainee) return (
    <div className="p-8 text-center">
      <AlertCircle className="w-12 h-12 mx-auto text-orange-300 mb-3" />
      <p className="font-bold text-gray-500">حساب المتدرب غير مفعّل.</p>
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-5 animate-in fade-in duration-400" dir="rtl">

      {/* ══ Hero ═════════════════════════════════════════════════════════════ */}
      <div className="bg-gradient-to-br from-cyan-600 via-blue-700 to-indigo-700 rounded-3xl p-5 md:p-7 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: 'radial-gradient(circle, white 1.5px, transparent 1.5px)', backgroundSize: '20px 20px' }} />
        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center border border-white/20">
              <MapPin className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">جدول الدورات التدريبية</h2>
              <p className="text-white/60 text-xs font-semibold">15 دورة موزعة على 3 سنوات</p>
            </div>
          </div>

          {/* Progress ring */}
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16">
              <svg width="64" height="64" className="-rotate-90">
                <circle cx="32" cy="32" r="25" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="5" />
                <circle cx="32" cy="32" r="25" fill="none" stroke="white" strokeWidth="5"
                  strokeDasharray={`${2 * Math.PI * 25}`}
                  strokeDashoffset={`${2 * Math.PI * 25 * (1 - pct / 100)}`}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 1.2s ease-out' }} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                <span className="text-sm font-black leading-none">{pct}%</span>
                <span className="text-[8px] opacity-60">اكتمال</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'مكتملة',  val: completed,  cl: 'text-emerald-300' },
                { label: 'جارية',   val: ongoing,    cl: 'text-indigo-200' },
                { label: 'مشكلة',   val: incomplete, cl: 'text-rose-300' },
                { label: 'الإجمالي',val: totalPlan,  cl: 'text-white' },
              ].map(s => (
                <div key={s.label} className="bg-white/10 rounded-xl px-3 py-2 text-center">
                  <p className={`text-lg font-black leading-none ${s.cl}`}>{s.val}</p>
                  <p className="text-[9px] font-semibold text-white/60 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ══ Year filter ══════════════════════════════════════════════════════ */}
      <div className="flex gap-2">
        {[0,1,2,3].map(y => (
          <button key={y} onClick={() => setFilterYear(y)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all active:scale-95 ${
              filterYear === y ? 'bg-gray-800 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
            }`}>
            {y === 0 ? 'الكل' : `السنة ${y}`}
          </button>
        ))}
      </div>

      {/* ══ Rotations by year ════════════════════════════════════════════════ */}
      {[1,2,3].map(yr => {
        const yRots = byYear[yr];
        if (filterYear !== 0 && filterYear !== yr) return null;
        if (yRots.length === 0) return null;
        const yrDone = yRots.filter(r => r.status === 'completed').length;
        const yrClr  = YEAR_COLORS[yr] || YEAR_COLORS[1];
        return (
          <div key={yr}>
            {/* Year header */}
            <div className={`flex items-center justify-between mb-3 px-1`}>
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${yrClr.grad} flex items-center justify-center text-white font-black text-sm shadow-sm`}>
                  {yr}
                </div>
                <span className={`text-sm font-black ${yrClr.text}`}>السنة التدريبية {yr}</span>
              </div>
              <span className="text-xs font-black text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                {yrDone}/{yRots.length} مكتمل
              </span>
            </div>

            <div className="space-y-3 mb-5">
              {yRots.map((rot, i) => <RotationCard key={rot.id} rot={rot} index={i} />)}
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div className="bg-white p-12 rounded-2xl border border-dashed border-gray-200 text-center">
          <MapPin className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p className="font-black text-gray-400 text-sm">لا توجد دورات مسجلة</p>
        </div>
      )}

      {/* ══ Legend ═══════════════════════════════════════════════════════════ */}
      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
        <p className="text-xs font-black text-gray-600 mb-3 flex items-center gap-1.5"><Target size={14} className="text-blue-500"/> حالات الدورات</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(STATUS_CFG).map(([k, v]) => (
            <span key={k} className={`flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-full ${v.bg} ${v.color} border ${v.border}`}>
              <span className={`w-2 h-2 rounded-full ${v.dot}`}/>
              {v.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
