import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import { Activity, Star, Loader2, User, Calendar, Filter, ChevronDown, MessageSquare } from 'lucide-react';

const RATING_BADGE = (r: number) => {
  if (r >= 5) return { label: 'خبير',            bg: 'bg-emerald-50', color: 'text-emerald-700', bar: 'bg-emerald-500' };
  if (r >= 4) return { label: 'فوق المتوقع',     bg: 'bg-teal-50',    color: 'text-teal-700',    bar: 'bg-teal-500' };
  if (r >= 3) return { label: 'المستوى المطلوب', bg: 'bg-blue-50',    color: 'text-blue-700',    bar: 'bg-blue-500' };
  if (r >= 2) return { label: 'دون المتوقع',     bg: 'bg-amber-50',   color: 'text-amber-700',   bar: 'bg-amber-500' };
  return             { label: 'يحتاج تدريباً',   bg: 'bg-rose-50',    color: 'text-rose-700',    bar: 'bg-rose-500' };
};

function DopsCard({ item }: { item: any }) {
  const [expanded, setExpanded] = useState(false);
  const badge = RATING_BADGE(item.rating);
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden group">
      <div className={`h-1 w-full ${badge.bar}`} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <h3 className="font-black text-gray-800 text-sm leading-tight flex-1">{item.skill?.name_ar || 'مهارة إكلينيكية'}</h3>
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0 ${badge.bg} ${badge.color}`}>{badge.label}</span>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-0.5">
            {[1,2,3,4,5].map(s => (
              <Star key={s} size={14} className={s <= item.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200 fill-gray-100'} />
            ))}
          </div>
          <span className="text-[11px] font-black text-gray-400">({item.rating}/5)</span>
        </div>
        <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 bg-gray-50 px-3 py-2 rounded-xl">
          <span className="flex items-center gap-1.5"><User size={11}/> {item.assessor?.employee?.name || 'مدرب'}</span>
          <span className="flex items-center gap-1.5"><Calendar size={11}/> {new Date(item.assessment_date).toLocaleDateString('ar-EG')}</span>
        </div>
        {item.assessor_feedback && (
          <div className="mt-3">
            <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1.5 text-[11px] font-black text-purple-600 hover:text-purple-800">
              <MessageSquare size={12}/> ملاحظات المدرب <ChevronDown size={11} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
            {expanded && (
              <div className="mt-2 p-3 bg-purple-50 rounded-xl border border-purple-100 animate-in slide-in-from-top-1 duration-200">
                <p className="text-xs font-bold text-purple-800 leading-relaxed">"{item.assessor_feedback}"</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TraineeDopsTab({ employeeId }: { employeeId: string }) {
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const TOTAL = 34;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: t } = await supabase.from('fellowship_trainees').select('id').eq('employee_id', employeeId).single();
        if (t) {
          const { data } = await supabase.from('fellowship_dops_assessments')
            .select('*, skill:fellowship_clinical_skills(name_ar, category), assessor:fellowship_trainers(employee:employees(name))')
            .eq('trainee_id', t.id).order('assessment_date', { ascending: false });
          setAssessments(data || []);
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    if (employeeId) load();
  }, [employeeId]);

  const filtered = useMemo(() => {
    if (filter === 'all') return assessments;
    const r = Number(filter);
    return assessments.filter(a => a.rating >= r && a.rating < r+1);
  }, [assessments, filter]);

  const avg = assessments.length > 0 ? (assessments.reduce((s, a) => s + (a.rating||0), 0) / assessments.length).toFixed(1) : '—';
  const excellent = assessments.filter(a => a.rating >= 4).length;
  const pct = Math.round((assessments.length / TOTAL) * 100);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-28 gap-3">
      <div className="w-14 h-14 bg-purple-50 rounded-2xl flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-purple-600" /></div>
      <p className="text-sm font-bold text-gray-400">جاري تحميل التقييمات...</p>
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-5 animate-in fade-in duration-400" dir="rtl">

      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 bg-purple-50 rounded-2xl flex items-center justify-center"><Activity size={22} className="text-purple-600" /></div>
          <div>
            <h2 className="text-base font-black text-gray-800">تقييم المهارات العملية (DOPS)</h2>
            <p className="text-[11px] font-semibold text-gray-400">تقييمات المدربين أثناء مراقبة أدائك المباشر</p>
          </div>
        </div>

        {/* stats */}
        <div className="grid grid-cols-4 gap-2 pt-4 border-t border-gray-50">
          {[
            { label: 'التقييمات', val: assessments.length, cl: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'متوسط التقييم', val: avg + '/5', cl: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'تغطية المهارات', val: pct + '%', cl: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'تقييمات ممتازة', val: excellent, cl: 'text-emerald-600', bg: 'bg-emerald-50' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} p-3 rounded-xl text-center`}>
              <p className={`text-lg font-black ${s.cl}`}>{s.val}</p>
              <p className="text-[9px] font-bold text-gray-500 leading-tight mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* coverage bar */}
        <div className="mt-4">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs font-black text-gray-600">تغطية المهارات ({assessments.length}/{TOTAL})</span>
            <span className="text-xs font-black text-purple-600">{pct}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-l from-purple-500 to-violet-400 rounded-full transition-all duration-1000" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {assessments.length === 0 ? (
        <div className="bg-white p-14 rounded-2xl border border-dashed border-gray-200 text-center">
          <Activity className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p className="font-black text-gray-400 text-sm">لا توجد تقييمات بعد</p>
          <p className="text-xs font-semibold text-gray-300 mt-1">ستُضاف من قبل المدربين عند ملاحظة أدائك</p>
        </div>
      ) : (
        <>
          {/* filter */}
          <div className="flex items-center gap-2 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
            <Filter size={14} className="text-gray-400 flex-shrink-0" />
            {[
              { val: 'all', label: 'الكل' },
              { val: '5', label: '★★★★★' },
              { val: '4', label: '★★★★' },
              { val: '3', label: '★★★' },
              { val: '2', label: '★★ وأقل' },
            ].map(o => (
              <button key={o.val} onClick={() => setFilter(o.val)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${filter === o.val ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {o.label}
              </button>
            ))}
          </div>

          <p className="text-xs font-black text-gray-400 px-1">عرض {filtered.length} من {assessments.length}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map(item => <DopsCard key={item.id} item={item} />)}
          </div>
        </>
      )}
    </div>
  );
}
