import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import {
  GraduationCap, BookOpen, FileText, CheckCircle, Loader2, AlertCircle,
  TrendingUp, Calendar, Target, Zap, ChevronLeft, Activity, Clock, Star
} from 'lucide-react';

function RingProgress({ value, max, color, size = 76, stroke = 6, label, sub }: {
  value: number; max: number; color: string; size?: number; stroke?: number; label: string; sub?: string;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={stroke} />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeDasharray={circ} strokeDashoffset={circ - pct * circ} strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-black text-gray-800 leading-none">{value}</span>
          <span className="text-[9px] font-bold text-gray-400 leading-none mt-0.5">/{max}</span>
        </div>
      </div>
      <p className="text-[10px] font-black text-gray-600 text-center leading-tight max-w-[72px]">{label}</p>
      {sub && <p className="text-[9px] font-semibold text-gray-400">{sub}</p>}
    </div>
  );
}

function SlimBar({ value, max, gradient, label, note }: { value: number; max: number; gradient: string; label: string; note?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs font-black text-gray-700">{label}</span>
        <span className="text-xs font-black text-gray-400">{value}<span className="font-semibold text-gray-300">/{max}</span></span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${gradient} transition-all duration-1000 ease-out`} style={{ width: `${pct}%` }} />
      </div>
      {note && <p className="text-[10px] font-semibold text-gray-400 mt-1">{note}</p>}
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, bg, badge }: any) {
  return (
    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg} ${color} group-hover:scale-110 transition-transform`}>
          <Icon size={20} />
        </div>
        {badge && (
          <span className="text-[10px] font-black bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1">
            <TrendingUp size={9} /> {badge}
          </span>
        )}
      </div>
      <p className="text-2xl font-black text-gray-800 leading-none">{value}</p>
      <p className="text-[11px] font-bold text-gray-500 mt-1 leading-tight">{title}</p>
    </div>
  );
}

export default function TraineeOverviewTab({ employeeId }: { employeeId: string }) {
  const [loading, setLoading] = useState(true);
  const [trainee, setTrainee] = useState<any>(null);
  const [stats, setStats] = useState({ logbooks: 0, approvedLogbooks: 0, portfolio: 0, dops: 0, lectures: 0, attended: 0 });
  const [rotations, setRotations] = useState<any[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const TOTAL_SKILLS = 34;
  const TOTAL_ROTATIONS = 15;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: t } = await supabase.from('fellowship_trainees')
          .select('*, employee:employees(name, specialty, photo_url)')
          .eq('employee_id', employeeId).single();
        if (!t) { setLoading(false); return; }
        setTrainee(t);
        const [
          { count: logs }, { count: approved }, { count: port },
          { count: dops }, { count: lecs }, { count: att },
        ] = await Promise.all([
          supabase.from('fellowship_logbook').select('*', { count: 'exact', head: true }).eq('trainee_id', t.id),
          supabase.from('fellowship_logbook').select('*', { count: 'exact', head: true }).eq('trainee_id', t.id).eq('trainer_reviewed', true),
          supabase.from('fellowship_portfolio_items').select('*', { count: 'exact', head: true }).eq('trainee_id', t.id),
          supabase.from('fellowship_dops_assessments').select('*', { count: 'exact', head: true }).eq('trainee_id', t.id),
          supabase.from('fellowship_lectures').select('*', { count: 'exact', head: true }),
          supabase.from('fellowship_lecture_attendance').select('*', { count: 'exact', head: true }).eq('trainee_id', t.id),
        ]);
        setStats({ logbooks: logs||0, approvedLogbooks: approved||0, portfolio: port||0, dops: dops||0, lectures: lecs||0, attended: att||0 });
        const { data: rots } = await supabase.from('fellowship_trainee_rotations')
          .select('*, rotation_type:fellowship_rotation_types(name_ar, training_year)')
          .eq('trainee_id', t.id).order('start_date');
        setRotations(rots || []);
        const { data: recent } = await supabase.from('fellowship_logbook')
          .select('id, diagnosis, entry_date, trainer_reviewed')
          .eq('trainee_id', t.id).order('created_at', { ascending: false }).limit(4);
        setRecentLogs(recent || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    if (employeeId) load();
  }, [employeeId]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-28 gap-3">
      <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
      </div>
      <p className="text-sm font-bold text-gray-400">جاري تحميل البيانات...</p>
    </div>
  );

  if (!trainee) return (
    <div className="p-8 text-center">
      <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-orange-400"><AlertCircle size={28} /></div>
      <h2 className="text-lg font-black text-gray-800 mb-2">الملف غير مفعّل بعد</h2>
      <p className="text-sm font-semibold text-gray-400 max-w-xs mx-auto">يرجى التواصل مع الإدارة لتفعيل حساب الزمالة.</p>
    </div>
  );

  const completed = rotations.filter(r => r.status === 'completed').length;
  const ongoing   = rotations.find(r => r.status === 'ongoing');
  const score = Math.round(
    ((stats.approvedLogbooks / Math.max(stats.logbooks, 1)) * 25) +
    ((stats.dops / TOTAL_SKILLS) * 25) +
    ((stats.attended / Math.max(stats.lectures, 1)) * 25) +
    ((stats.portfolio / 12) * 25)
  );
  const name0 = trainee.employee?.name?.split(' ')[0] || '';

  return (
    <div className="p-4 md:p-6 space-y-5 animate-in fade-in duration-400" dir="rtl">

      {/* Hero */}
      <div className="relative bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 rounded-3xl overflow-hidden">
        <div className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-white/5 rounded-full" />
        <div className="absolute -top-8 right-20 w-32 h-32 bg-white/5 rounded-full" />
        <div className="relative p-5 md:p-7">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur border border-white/20 flex items-center justify-center text-white text-2xl font-black overflow-hidden flex-shrink-0">
                {trainee.employee?.photo_url ? <img src={trainee.employee.photo_url} className="w-full h-full object-cover" alt="" /> : name0.charAt(0)}
              </div>
              <div>
                <p className="text-white/60 text-xs font-semibold">أهلاً وسهلاً 👋</p>
                <h1 className="text-xl font-black text-white leading-tight">د. {trainee.employee?.name}</h1>
                <p className="text-white/50 text-xs font-semibold mt-0.5 flex items-center gap-1.5">
                  <GraduationCap size={12} /> {trainee.employee?.specialty} · {trainee.trainee_code}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-[68px] h-[68px]">
                <svg width="68" height="68" className="-rotate-90">
                  <circle cx="34" cy="34" r="26" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="5" />
                  <circle cx="34" cy="34" r="26" fill="none" stroke="white" strokeWidth="5"
                    strokeDasharray={`${2 * Math.PI * 26}`}
                    strokeDashoffset={`${2 * Math.PI * 26 * (1 - score / 100)}`}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(.4,0,.2,1)' }} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                  <span className="text-sm font-black leading-none">{score}%</span>
                  <span className="text-[8px] font-semibold opacity-60">إنجاز</span>
                </div>
              </div>
              <div className="bg-white/10 rounded-2xl px-4 py-3 text-center border border-white/15">
                <p className="text-[10px] font-semibold text-white/60">السنة</p>
                <p className="text-3xl font-black text-white leading-none">{trainee.current_year}</p>
                <p className="text-[10px] font-semibold text-white/60">من ٣</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-white/10">
            {[
              { icon: Calendar, text: `التحاق: ${new Date(trainee.enrollment_date).toLocaleDateString('ar-EG')}` },
              { icon: Activity, text: trainee.status === 'active' ? 'نشط ✓' : 'غير نشط' },
              { icon: Target, text: `دوران: ${completed}/${TOTAL_ROTATIONS}` },
              ...(ongoing ? [{ icon: Clock, text: `جارٍ: ${ongoing.rotation_type?.name_ar}`, hl: true }] : []),
            ].map((p: any, i) => (
              <span key={i} className={`flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full ${p.hl ? 'bg-white/20 text-white border border-white/30' : 'bg-white/10 text-white/75'}`}>
                <p.icon size={11} /> {p.text}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="إجمالي الحالات" value={stats.logbooks} icon={BookOpen} color="text-blue-600" bg="bg-blue-50" />
        <StatCard title="الحالات المعتمدة" value={stats.approvedLogbooks} icon={CheckCircle} color="text-emerald-600" bg="bg-emerald-50"
          badge={stats.logbooks > 0 ? `${Math.round((stats.approvedLogbooks/stats.logbooks)*100)}%` : undefined} />
        <StatCard title="ملفات الإنجاز" value={stats.portfolio} icon={FileText} color="text-amber-600" bg="bg-amber-50" />
        <StatCard title="تقييمات DOPS" value={stats.dops} icon={Activity} color="text-purple-600" bg="bg-purple-50"
          badge={`${Math.round((stats.dops/TOTAL_SKILLS)*100)}%`} />
      </div>

      {/* Progress split */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="text-xs font-black text-gray-600 mb-5 flex items-center gap-1.5">
            <Star size={14} className="text-amber-400 fill-amber-400" /> مؤشرات الأداء
          </h3>
          <div className="grid grid-cols-2 gap-6">
            <RingProgress value={stats.approvedLogbooks} max={Math.max(stats.logbooks,1)} color="#10b981" label="حالات معتمدة" sub="Logbook" />
            <RingProgress value={stats.dops} max={TOTAL_SKILLS} color="#8b5cf6" label="مهارات DOPS" sub="34 مهارة" />
            <RingProgress value={stats.attended} max={Math.max(stats.lectures,1)} color="#3b82f6" label="المحاضرات" sub="Lectures" />
            <RingProgress value={completed} max={TOTAL_ROTATIONS} color="#f59e0b" label="الدوران" sub="Rotations" />
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="text-xs font-black text-gray-600 mb-5 flex items-center gap-1.5">
            <Zap size={14} className="text-indigo-500" /> تفاصيل الإنجاز
          </h3>
          <div className="space-y-4">
            <SlimBar value={stats.approvedLogbooks} max={50} gradient="bg-gradient-to-l from-emerald-400 to-teal-500" label="سجلات Logbook" note="المطلوب 50/سنة" />
            <SlimBar value={stats.dops} max={TOTAL_SKILLS} gradient="bg-gradient-to-l from-violet-400 to-purple-500" label="مهارات DOPS" />
            <SlimBar value={stats.portfolio} max={12} gradient="bg-gradient-to-l from-amber-400 to-yellow-500" label="Portfolio" note="12 نوع مطلوب" />
            <SlimBar value={stats.attended} max={Math.max(stats.lectures,1)} gradient="bg-gradient-to-l from-blue-400 to-indigo-500" label="حضور المحاضرات" />
          </div>
        </div>
      </div>

      {/* Rotations */}
      {rotations.length > 0 && (
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-black text-gray-600 flex items-center gap-1.5"><Clock size={14} className="text-teal-500" /> الدوران التدريبية</h3>
            <span className="text-[10px] font-black text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-100">{completed}/{rotations.length} مكتمل</span>
          </div>
          <div className="space-y-2">
            {rotations.slice(0, 7).map((rot, i) => {
              const done = rot.status === 'completed'; const act = rot.status === 'ongoing';
              return (
                <div key={rot.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${done ? 'bg-emerald-50/60 border-emerald-100' : act ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50/50 border-gray-100'}`}>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 ${done ? 'bg-emerald-500 text-white' : act ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {done ? <CheckCircle size={13}/> : act ? <Activity size={13}/> : i+1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-black truncate ${done ? 'text-emerald-800' : act ? 'text-indigo-800' : 'text-gray-600'}`}>{rot.rotation_type?.name_ar}</p>
                    <p className="text-[10px] font-semibold text-gray-400">السنة {rot.rotation_type?.training_year}</p>
                  </div>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${done ? 'bg-emerald-100 text-emerald-700' : act ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-500'}`}>
                    {done ? 'مكتمل' : act ? 'جارٍ ◉' : 'قادم'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent logs */}
      {recentLogs.length > 0 && (
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-black text-gray-600 flex items-center gap-1.5"><BookOpen size={14} className="text-blue-500" /> آخر الحالات</h3>
            <button className="text-[10px] font-black text-indigo-600 flex items-center gap-0.5 hover:underline">الكل <ChevronLeft size={12}/></button>
          </div>
          <div className="space-y-2">
            {recentLogs.map(log => (
              <div key={log.id} className="flex items-center gap-3 p-3 bg-gray-50/80 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${log.trainer_reviewed ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                <p className="flex-1 text-xs font-black text-gray-700 truncate">{log.diagnosis || 'بدون تشخيص'}</p>
                <span className="text-[10px] font-semibold text-gray-400">{new Date(log.entry_date).toLocaleDateString('ar-EG')}</span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${log.trainer_reviewed ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                  {log.trainer_reviewed ? '✓ معتمد' : '⏳ انتظار'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
