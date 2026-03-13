import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import {
  Stethoscope, Loader2, AlertCircle, Star, CheckCircle2,
  CircleDashed, Filter, Search, ChevronDown, ChevronRight, Award
} from 'lucide-react';

// ─── المهارات الـ 34 من المنهج (seed data من الـ schema) ──────────────────────
const SKILL_CATEGORIES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  administrative: { label: 'إدارية وتوثيق',   color: 'text-slate-700',   bg: 'bg-slate-100',   border: 'border-slate-300' },
  diagnostic:     { label: 'تشخيصية',          color: 'text-blue-700',    bg: 'bg-blue-100',    border: 'border-blue-300' },
  therapeutic:    { label: 'علاجية وإجرائية',  color: 'text-violet-700',  bg: 'bg-violet-100',  border: 'border-violet-300' },
  emergency:      { label: 'طوارئ وإنعاش',     color: 'text-rose-700',    bg: 'bg-rose-100',    border: 'border-rose-300' },
};

// ─── Rating helpers ────────────────────────────────────────────────────────────
const RATING_INFO = (r: number) => {
  if (r >= 5) return { label: 'خبير',             color: 'text-emerald-700', bg: 'bg-emerald-50', bar: 'bg-emerald-500' };
  if (r >= 4) return { label: 'فوق المتوقع',      color: 'text-teal-700',    bg: 'bg-teal-50',    bar: 'bg-teal-500' };
  if (r >= 3) return { label: 'المستوى المطلوب',  color: 'text-blue-700',    bg: 'bg-blue-50',    bar: 'bg-blue-500' };
  if (r >= 2) return { label: 'دون المتوقع',      color: 'text-amber-700',   bg: 'bg-amber-50',   bar: 'bg-amber-500' };
  return             { label: 'يحتاج تدريباً',    color: 'text-rose-700',    bg: 'bg-rose-50',    bar: 'bg-rose-500' };
};

function StarRow({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star key={i} size={12}
          className={i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200 fill-gray-100'} />
      ))}
    </div>
  );
}

// ─── Single Skill Row ──────────────────────────────────────────────────────────
function SkillRow({ skill, assessments }: { skill: any; assessments: any[] }) {
  const [open, setOpen] = useState(false);
  const myAssessments = assessments.filter(a => a.skill_id === skill.id);
  const latestRating  = myAssessments.length > 0 ? myAssessments[0].rating : 0;
  const bestRating    = myAssessments.length > 0 ? Math.max(...myAssessments.map(a => a.rating)) : 0;
  const assessed      = myAssessments.length > 0;
  const info          = assessed ? RATING_INFO(latestRating) : null;
  const catCfg        = SKILL_CATEGORIES[skill.category] || SKILL_CATEGORIES.diagnostic;

  return (
    <div className={`rounded-2xl border transition-all ${assessed ? 'border-gray-100 bg-white shadow-sm' : 'border-dashed border-gray-200 bg-gray-50/50'}`}>
      <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50/80 transition-colors rounded-2xl"
        onClick={() => assessed && setOpen(!open)}>

        {/* Number + status icon */}
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0 ${
          assessed ? (bestRating >= 3 ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-white') : 'bg-gray-200 text-gray-500'
        }`}>
          {assessed ? (bestRating >= 3 ? <CheckCircle2 size={15}/> : skill.skill_number) : skill.skill_number}
        </div>

        {/* Name */}
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-black leading-tight ${assessed ? 'text-gray-800' : 'text-gray-500'}`}>
            {skill.name_ar}
          </p>
          <p className="text-[10px] font-semibold text-gray-400 mt-0.5">{skill.name_en}</p>
        </div>

        {/* Category */}
        <span className={`hidden sm:block text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0 ${catCfg.bg} ${catCfg.color}`}>
          {catCfg.label}
        </span>

        {/* Rating or pending */}
        <div className="flex-shrink-0 text-right">
          {assessed ? (
            <div className="flex flex-col items-end gap-1">
              <StarRow rating={latestRating} />
              <span className={`text-[10px] font-black ${info!.color}`}>{info!.label}</span>
            </div>
          ) : (
            <span className="text-[10px] font-semibold text-gray-400 flex items-center gap-1">
              <CircleDashed size={12}/> لم تُقيَّم
            </span>
          )}
        </div>

        {assessed && myAssessments.length > 0 && (
          <ChevronDown size={14} className={`text-gray-400 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
        )}
      </div>

      {/* Expanded assessment history */}
      {open && myAssessments.length > 0 && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-2 animate-in slide-in-from-top-1 duration-200">
          <p className="text-[10px] font-black text-gray-400 mb-2">سجل التقييمات ({myAssessments.length})</p>
          {myAssessments.map((a, i) => {
            const ri = RATING_INFO(a.rating);
            return (
              <div key={a.id} className={`${ri.bg} p-3 rounded-xl border ${i === 0 ? 'border-2' : 'border'} border-gray-200`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <StarRow rating={a.rating} />
                    <span className={`text-[10px] font-black ${ri.color}`}>{ri.label}</span>
                    {i === 0 && <span className="text-[9px] font-black bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">الأخير</span>}
                  </div>
                  <span className="text-[10px] font-semibold text-gray-400">
                    {new Date(a.assessment_date).toLocaleDateString('ar-EG')}
                  </span>
                </div>
                {a.assessor?.employee?.name && (
                  <p className="text-[10px] font-bold text-gray-500">المقيّم: {a.assessor.employee.name}</p>
                )}
                {a.assessor_feedback && (
                  <p className="text-[11px] font-bold text-gray-700 mt-1 leading-relaxed italic">"{a.assessor_feedback}"</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Category Section ──────────────────────────────────────────────────────────
function CategorySection({ catKey, skills, assessments }: { catKey: string; skills: any[]; assessments: any[] }) {
  const [open, setOpen] = useState(true);
  const cfg  = SKILL_CATEGORIES[catKey] || SKILL_CATEGORIES.diagnostic;
  const done = skills.filter(s => assessments.some(a => a.skill_id === s.id && a.rating >= 3)).length;
  const pct  = Math.round((done / skills.length) * 100);

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1.5 rounded-xl text-xs font-black ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
            {cfg.label}
          </span>
          <span className="text-xs font-black text-gray-500">{skills.length} مهارة</span>
          <div className="flex items-center gap-1.5">
            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${pct >= 75 ? 'bg-emerald-500' : pct >= 40 ? 'bg-blue-500' : 'bg-gray-400'}`}
                style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[10px] font-black text-gray-500">{done}/{skills.length}</span>
          </div>
        </div>
        <ChevronDown size={16} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2 animate-in slide-in-from-top-2 duration-200">
          {skills.map(s => <SkillRow key={s.id} skill={s} assessments={assessments} />)}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function TraineeSkillsTab({ employeeId }: { employeeId: string }) {
  const [loading, setLoading]       = useState(true);
  const [traineeId, setTraineeId]   = useState<string | null>(null);
  const [skills, setSkills]         = useState<any[]>([]);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [search, setSearch]         = useState('');
  const [filterCat, setFilterCat]   = useState('all');
  const [filterStatus, setFilterStatus] = useState('all'); // all | assessed | pending

  const TOTAL = 34;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: t } = await supabase.from('fellowship_trainees').select('id').eq('employee_id', employeeId).single();
        if (!t) { setLoading(false); return; }
        setTraineeId(t.id);

        const [{ data: allSkills }, { data: myAssessments }] = await Promise.all([
          supabase.from('fellowship_clinical_skills').select('*').order('skill_number'),
          supabase.from('fellowship_dops_assessments')
            .select('*, assessor:fellowship_trainers(employee:employees(name))')
            .eq('trainee_id', t.id)
            .order('assessment_date', { ascending: false }),
        ]);

        setSkills(allSkills || []);
        setAssessments(myAssessments || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    if (employeeId) load();
  }, [employeeId]);

  // ── Filtered skills ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return skills.filter(s => {
      const matchSearch = !search || s.name_ar.includes(search) || s.name_en.toLowerCase().includes(search.toLowerCase());
      const matchCat    = filterCat === 'all' || s.category === filterCat;
      const isAssessed  = assessments.some(a => a.skill_id === s.id);
      const matchStatus = filterStatus === 'all' || (filterStatus === 'assessed' ? isAssessed : !isAssessed);
      return matchSearch && matchCat && matchStatus;
    });
  }, [skills, assessments, search, filterCat, filterStatus]);

  // ── Group by category ────────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const g: Record<string, any[]> = { administrative: [], diagnostic: [], therapeutic: [], emergency: [] };
    filtered.forEach(s => { if (g[s.category]) g[s.category].push(s); else g.diagnostic.push(s); });
    return g;
  }, [filtered]);

  // ── Stats ────────────────────────────────────────────────────────────────────
  const assessedSkillIds = [...new Set(assessments.map(a => a.skill_id))];
  const assessedCount    = assessedSkillIds.length;
  const passedCount      = skills.filter(s => assessments.some(a => a.skill_id === s.id && a.rating >= 3)).length;
  const expertCount      = skills.filter(s => assessments.some(a => a.skill_id === s.id && a.rating >= 4)).length;
  const coveragePct      = Math.round((assessedCount / TOTAL) * 100);
  const passPct          = Math.round((passedCount  / TOTAL) * 100);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-28 gap-3">
      <div className="w-14 h-14 bg-teal-50 rounded-2xl flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-teal-600" />
      </div>
      <p className="text-sm font-bold text-gray-400">جاري تحميل قائمة المهارات...</p>
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
      <div className="relative bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-800 rounded-3xl overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg, white 0, white 1px, transparent 0, transparent 24px), repeating-linear-gradient(90deg, white 0, white 1px, transparent 0, transparent 24px)', backgroundSize: '24px 24px' }} />
        <div className="relative p-5 md:p-7">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center border border-white/20">
              <Stethoscope className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">قائمة المهارات السريرية</h2>
              <p className="text-white/60 text-xs font-semibold">34 مهارة موزعة على سنوات التدريب الثلاث</p>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'إجمالي المهارات', val: TOTAL,         add: '' },
              { label: 'تمت تقييمها',    val: assessedCount, add: `${coveragePct}%` },
              { label: 'اجتزت (≥3)',      val: passedCount,   add: `${passPct}%` },
              { label: 'ممتاز (≥4)',      val: expertCount,   add: '' },
            ].map(s => (
              <div key={s.label} className="bg-white/10 backdrop-blur border border-white/15 rounded-2xl p-3 text-center">
                <p className="text-2xl font-black text-white leading-none">{s.val}</p>
                {s.add && <p className="text-[10px] font-black text-emerald-300 leading-none mt-0.5">{s.add}</p>}
                <p className="text-[10px] font-semibold text-white/60 mt-1 leading-tight">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Overall progress bar */}
          <div className="mt-5 pt-5 border-t border-white/10">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-black text-white/80">التقدم الكلي في المهارات</span>
              <span className="text-xs font-black text-white">{passPct}%</span>
            </div>
            <div className="h-2.5 bg-white/15 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all duration-1000"
                style={{ width: `${passPct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* ══ Filters ══════════════════════════════════════════════════════════ */}
      <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="ابحث باسم المهارة..."
            className="w-full pr-9 pl-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold outline-none focus:border-teal-300" />
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-black outline-none focus:border-teal-300">
            <option value="all">كل الأنواع</option>
            {Object.entries(SKILL_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-black outline-none focus:border-teal-300">
            <option value="all">الكل</option>
            <option value="assessed">تم تقييمها</option>
            <option value="pending">لم تُقيَّم</option>
          </select>
        </div>
      </div>

      <p className="text-xs font-black text-gray-400 px-1">عرض {filtered.length} مهارة</p>

      {/* ══ Grouped Sections ═════════════════════════════════════════════════ */}
      <div className="space-y-4">
        {Object.entries(grouped).map(([catKey, catSkills]) =>
          catSkills.length > 0 ? (
            <CategorySection key={catKey} catKey={catKey} skills={catSkills} assessments={assessments} />
          ) : null
        )}
        {filtered.length === 0 && (
          <div className="bg-white p-12 rounded-2xl border border-dashed border-gray-200 text-center">
            <Stethoscope className="w-12 h-12 mx-auto mb-3 text-gray-200" />
            <p className="font-black text-gray-400 text-sm">لا نتائج تطابق البحث</p>
          </div>
        )}
      </div>

      {/* ══ Legend ═══════════════════════════════════════════════════════════ */}
      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
        <p className="text-xs font-black text-gray-600 mb-3 flex items-center gap-1.5"><Award size={14} className="text-amber-500"/> مقياس التقييم</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[5,4,3,2,1].map(r => {
            const ri = RATING_INFO(r);
            return (
              <div key={r} className={`${ri.bg} px-3 py-2 rounded-xl text-center border border-gray-200`}>
                <StarRow rating={r} />
                <p className={`text-[10px] font-black mt-1 ${ri.color}`}>{ri.label}</p>
                <p className="text-[9px] font-semibold text-gray-400">{r}/5</p>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
