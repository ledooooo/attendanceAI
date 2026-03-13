import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import {
  GraduationCap, Loader2, AlertCircle, CheckCircle2, XCircle,
  Clock, ChevronDown, BarChart2, Target, Calendar, RefreshCw, Award
} from 'lucide-react';

// ─── AKT subject weights ──────────────────────────────────────────────────────
const AKT_SUBJECTS = [
  { key: 'internal_med_score',      label: 'الباطنة وطب المسنين', weight: 30 },
  { key: 'obgyn_score',             label: 'النساء والتوليد',      weight: 15 },
  { key: 'paediatrics_score',       label: 'طب الأطفال',          weight: 14 },
  { key: 'emergency_score',         label: 'الطوارئ',              weight: 10 },
  { key: 'community_score',         label: 'طب المجتمع',          weight: 8  },
  { key: 'psychiatry_score',        label: 'الطب النفسي',         weight: 7  },
  { key: 'surgery_score',           label: 'الجراحة',              weight: 5  },
  { key: 'ent_score',               label: 'أنف وأذن وحنجرة',     weight: 4  },
  { key: 'ophthalmology_score',     label: 'العيون',               weight: 3  },
  { key: 'dermatology_score',       label: 'الجلدية',              weight: 2  },
  { key: 'male_reproductive_score', label: 'الصحة الإنجابية',     weight: 1  },
  { key: 'family_lifecycle_score',  label: 'دورة حياة الأسرة',    weight: 1  },
];

const PROG_SUBJECTS = [
  { key: 'internal_med_score', label: 'الباطنة وطب المسنين', weight: 30 },
  { key: 'community_score',    label: 'طب المجتمع',          weight: 25 },
  { key: 'paediatrics_score',  label: 'طب الأطفال',          weight: 20 },
  { key: 'obgyn_score',        label: 'النساء والتوليد',      weight: 13 },
  { key: 'psychiatry_score',   label: 'الطب النفسي',         weight: 12 },
];

const CSA_GRADES: Record<string, { label: string; color: string; bg: string }> = {
  CP: { label: 'نجاح واضح',       color: 'text-emerald-700', bg: 'bg-emerald-100' },
  MP: { label: 'نجاح حدي',        color: 'text-teal-700',    bg: 'bg-teal-100'    },
  MF: { label: 'رسوب حدي',        color: 'text-amber-700',   bg: 'bg-amber-100'   },
  CF: { label: 'رسوب واضح',       color: 'text-rose-700',    bg: 'bg-rose-100'    },
  UX: { label: 'غير مقبول',       color: 'text-red-800',     bg: 'bg-red-100'     },
};

// ─── Score bar ────────────────────────────────────────────────────────────────
function ScoreBar({ score, weight, label }: { score: number | null; weight: number; label: string }) {
  const pct = score ?? 0;
  const passed = pct >= 60;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-black text-gray-700">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-gray-400">وزن {weight}%</span>
          <span className={`text-xs font-black ${score !== null ? (passed ? 'text-emerald-600' : 'text-rose-600') : 'text-gray-400'}`}>
            {score !== null ? `${score}%` : '—'}
          </span>
        </div>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${passed ? 'bg-emerald-500' : score !== null ? 'bg-rose-400' : 'bg-gray-300'}`}
          style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Exam attempt card ────────────────────────────────────────────────────────
function AttemptCard({ attempt, examType, index }: { attempt: any; examType: string; index: number }) {
  const [open, setOpen] = useState(index === 0);
  const passed = attempt.passed;
  const isBest = index === 0;

  return (
    <div className={`rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition-all ${
      passed ? 'border-emerald-200 bg-emerald-50/40' : 'border-gray-100 bg-white'
    } ${isBest ? 'ring-2 ring-offset-1 ring-indigo-200' : ''}`}>
      <div className="p-4 cursor-pointer" onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-3">
          {/* Attempt badge */}
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-sm ${
            passed ? 'bg-emerald-500 text-white' : 'bg-rose-100 text-rose-600'
          }`}>
            {passed ? <CheckCircle2 size={18}/> : <XCircle size={18}/>}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-gray-700">المحاولة {attempt.attempt_number}</span>
                {isBest && <span className="text-[10px] font-black bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">الأحدث</span>}
                {passed && <span className="text-[10px] font-black bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Award size={9}/> ناجح</span>}
              </div>
              <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1"><Calendar size={10}/>{new Date(attempt.exam_date).toLocaleDateString('ar-EG')}</span>
            </div>

            <div className="flex items-center gap-3 mt-1.5">
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${passed ? 'bg-emerald-500' : 'bg-rose-400'}`}
                  style={{ width: `${attempt.total_score ?? 0}%` }} />
              </div>
              <span className={`text-sm font-black flex-shrink-0 ${passed ? 'text-emerald-700' : 'text-rose-600'}`}>
                {attempt.total_score ?? '—'}%
              </span>
            </div>
          </div>

          <ChevronDown size={14} className={`text-gray-400 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Subject breakdown */}
      {open && (
        <div className="px-4 pb-4 border-t border-gray-100/80 pt-3 space-y-3 animate-in slide-in-from-top-1 duration-200">
          {examType === 'AKT' && (
            <>
              <p className="text-[10px] font-black text-gray-400">توزيع النتائج على المواد</p>
              <div className="space-y-2.5">
                {AKT_SUBJECTS.map(s => <ScoreBar key={s.key} score={attempt[s.key]} weight={s.weight} label={s.label} />)}
              </div>
              {/* Question types */}
              <p className="text-[10px] font-black text-gray-400 mt-4 pt-3 border-t border-gray-100">أنواع الأسئلة التفسيرية</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'ecg_score', label: 'رسم القلب ECG', w: 15 },
                  { key: 'xray_score', label: 'أشعة X-Ray', w: 20 },
                  { key: 'lab_score', label: 'تحاليل مخبرية', w: 30 },
                  { key: 'signs_score', label: 'علامات سريرية', w: 30 },
                  { key: 'growth_score', label: 'منحنيات النمو', w: 5 },
                ].map(s => (
                  <div key={s.key} className="bg-gray-50 rounded-xl p-2.5 border border-gray-100">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-black text-gray-600">{s.label}</span>
                      <span className="text-[10px] font-bold text-gray-400">{s.w}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${(attempt[s.key] ?? 0) >= 60 ? 'bg-blue-400' : 'bg-amber-400'} transition-all duration-700`}
                        style={{ width: `${attempt[s.key] ?? 0}%` }} />
                    </div>
                    <p className="text-[10px] font-black text-gray-500 mt-1">{attempt[s.key] ?? '—'}%</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {examType === 'Progression' && (
            <>
              <p className="text-[10px] font-black text-gray-400">توزيع النتائج — السنة {attempt.training_year}</p>
              <div className="space-y-2.5">
                {PROG_SUBJECTS.map(s => <ScoreBar key={s.key} score={attempt[s.key]} weight={s.weight} label={s.label} />)}
              </div>
              {attempt.can_proceed && (
                <div className="flex items-center gap-2 bg-emerald-50 rounded-xl p-2.5 border border-emerald-200">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  <p className="text-xs font-bold text-emerald-700">مسموح بالتقدم للسنة التالية</p>
                </div>
              )}
            </>
          )}

          {examType === 'CSA' && attempt.station_results && (
            <>
              <p className="text-[10px] font-black text-gray-400">نتائج المحطات ({attempt.stations_passed}/{attempt.total_stations})</p>
              <div className="grid grid-cols-2 gap-2">
                {(attempt.station_results as any[]).map((st: any) => {
                  const g = CSA_GRADES[st.grade] || CSA_GRADES.CF;
                  return (
                    <div key={st.station} className={`${g.bg} rounded-xl p-2.5 border border-gray-200`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-gray-600">محطة {st.station}</span>
                        <span className={`text-[10px] font-black ${g.color}`}>{st.grade}</span>
                      </div>
                      <p className={`text-[10px] font-bold ${g.color} mt-0.5`}>{g.label}</p>
                    </div>
                  );
                })}
              </div>
              {attempt.overall_grade && (
                <div className={`flex items-center justify-between ${CSA_GRADES[attempt.overall_grade]?.bg || 'bg-gray-50'} rounded-xl p-3 border border-gray-200`}>
                  <span className="text-xs font-black text-gray-700">التقييم الكلي</span>
                  <span className={`text-sm font-black ${CSA_GRADES[attempt.overall_grade]?.color}`}>
                    {attempt.overall_grade} — {CSA_GRADES[attempt.overall_grade]?.label}
                  </span>
                </div>
              )}
            </>
          )}

          {attempt.examiner_notes && (
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <p className="text-[10px] font-black text-gray-400 mb-1">ملاحظات الممتحن</p>
              <p className="text-xs font-bold text-gray-700 leading-relaxed">{attempt.examiner_notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Exam Section ─────────────────────────────────────────────────────────────
function ExamSection({ title, type, attempts, maxAttempts, color, bg, icon: Icon }: {
  title: string; type: string; attempts: any[]; maxAttempts: number;
  color: string; bg: string; icon: any;
}) {
  const passed      = attempts.some(a => a.passed);
  const bestScore   = attempts.length > 0 ? Math.max(...attempts.map(a => a.total_score ?? 0)) : null;
  const remaining   = maxAttempts - attempts.length;

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Section header */}
      <div className={`${bg} p-4 border-b border-gray-100`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color} bg-white/60 border border-white`}>
              <Icon size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-gray-800">{title}</h3>
              <p className="text-[10px] font-semibold text-gray-500">{attempts.length} محاولة من {maxAttempts}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {passed ? (
              <span className="flex items-center gap-1 text-[11px] font-black text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                <CheckCircle2 size={12}/> ناجح ✓
              </span>
            ) : attempts.length > 0 ? (
              <span className="flex items-center gap-1 text-[11px] font-black text-rose-700 bg-rose-100 px-2.5 py-1 rounded-full">
                <XCircle size={12}/> لم ينجح بعد
              </span>
            ) : (
              <span className="text-[11px] font-black text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                لم يؤدَّ بعد
              </span>
            )}
            {bestScore !== null && (
              <span className="text-[10px] font-bold text-gray-500">أعلى نتيجة: {bestScore}%</span>
            )}
          </div>
        </div>

        {/* Attempts usage bar */}
        <div className="mt-3">
          <div className="flex gap-1">
            {Array.from({ length: maxAttempts }).map((_, i) => {
              const att = attempts[attempts.length - 1 - i]; // oldest first display
              const used = i < attempts.length;
              return (
                <div key={i} className={`flex-1 h-2 rounded-full transition-all duration-500 ${
                  !used ? 'bg-white/50' :
                  attempts[i]?.passed ? 'bg-emerald-500' : 'bg-rose-400'
                }`} />
              );
            })}
          </div>
          <p className="text-[10px] font-semibold text-gray-500 mt-1">
            {remaining > 0 ? `${remaining} محاولة متبقية` : 'تم استنفاد جميع المحاولات'}
          </p>
        </div>
      </div>

      {/* Attempts */}
      <div className="p-4 space-y-3">
        {attempts.length === 0 ? (
          <div className="text-center py-8 text-gray-300">
            <Clock className="w-10 h-10 mx-auto mb-2" />
            <p className="text-xs font-bold text-gray-400">لم يُؤدَّ هذا الامتحان بعد</p>
          </div>
        ) : (
          [...attempts].reverse().map((att, i) => (
            <AttemptCard key={att.id} attempt={att} examType={type} index={attempts.length - 1 - i} />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function TraineeExamsTab({ employeeId }: { employeeId: string }) {
  const [loading, setLoading]   = useState(true);
  const [traineeId, setTraineeId] = useState<string | null>(null);
  const [aktResults, setAktResults]   = useState<any[]>([]);
  const [progResults, setProgResults] = useState<any[]>([]);
  const [csaResults, setCsaResults]   = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: t } = await supabase.from('fellowship_trainees').select('id').eq('employee_id', employeeId).single();
        if (!t) { setLoading(false); return; }
        setTraineeId(t.id);

        const [{ data: akt }, { data: prog }, { data: csa }] = await Promise.all([
          supabase.from('fellowship_akt_results').select('*').eq('trainee_id', t.id).order('exam_date', { ascending: false }),
          supabase.from('fellowship_progression_results').select('*').eq('trainee_id', t.id).order('exam_date', { ascending: false }),
          supabase.from('fellowship_csa_results').select('*').eq('trainee_id', t.id).order('exam_date', { ascending: false }),
        ]);

        setAktResults(akt || []);
        setProgResults(prog || []);
        setCsaResults(csa || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    if (employeeId) load();
  }, [employeeId]);

  // ── Overall readiness ─────────────────────────────────────────────────────
  const aktPassed  = aktResults.some(a => a.passed);
  const progPassed = progResults.some(a => a.passed);
  const csaPassed  = csaResults.some(a => a.passed);
  const allPassed  = aktPassed && progPassed && csaPassed;
  const passedCount = [aktPassed, progPassed, csaPassed].filter(Boolean).length;

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-28 gap-3">
      <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-amber-600" />
      </div>
      <p className="text-sm font-bold text-gray-400">جاري تحميل نتائج الامتحانات...</p>
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
      <div className={`relative rounded-3xl overflow-hidden p-5 md:p-7 ${
        allPassed ? 'bg-gradient-to-br from-emerald-600 to-teal-700' : 'bg-gradient-to-br from-amber-600 to-orange-700'
      }`}>
        <div className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'radial-gradient(circle, white 1.5px, transparent 1.5px)', backgroundSize: '22px 22px' }} />
        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center border border-white/20">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">نتائج الامتحانات</h2>
              <p className="text-white/60 text-xs font-semibold">AKT · Progression · CSA</p>
            </div>
          </div>

          {/* 3 exam status pills */}
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'AKT', passed: aktPassed },
              { label: 'Progression', passed: progPassed },
              { label: 'CSA', passed: csaPassed },
            ].map(e => (
              <div key={e.label} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black border ${
                e.passed ? 'bg-white/20 text-white border-white/30' : 'bg-black/10 text-white/70 border-white/10'
              }`}>
                {e.passed ? <CheckCircle2 size={13}/> : <Clock size={13}/>}
                {e.label}
              </div>
            ))}
          </div>
        </div>

        {/* Overall progress */}
        <div className="mt-5 pt-5 border-t border-white/10">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-black text-white/80">اجتياز الامتحانات ({passedCount}/3)</span>
            <span className="text-xs font-black text-white">{Math.round((passedCount / 3) * 100)}%</span>
          </div>
          <div className="h-2.5 bg-white/15 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all duration-1000"
              style={{ width: `${(passedCount / 3) * 100}%` }} />
          </div>
          {allPassed && (
            <p className="text-white text-xs font-black mt-2 flex items-center gap-1.5">
              <Award size={14}/> اجتزت جميع الامتحانات! أنت مؤهل للتخرج 🎉
            </p>
          )}
        </div>
      </div>

      {/* ══ Exam sections ════════════════════════════════════════════════════ */}
      <ExamSection title="اختبار المعرفة التطبيقية (AKT)" type="AKT"
        attempts={aktResults} maxAttempts={4}
        color="text-blue-600" bg="bg-blue-50" icon={BarChart2} />

      <ExamSection title="امتحان التقدم (Progression)" type="Progression"
        attempts={progResults} maxAttempts={4}
        color="text-violet-600" bg="bg-violet-50" icon={Target} />

      <ExamSection title="امتحان المهارات السريرية (CSA)" type="CSA"
        attempts={csaResults} maxAttempts={4}
        color="text-teal-600" bg="bg-teal-50" icon={RefreshCw} />

    </div>
  );
}
