import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import {
  User, Calendar, BookOpen, Loader2, Presentation,
  CheckCircle, MapPin, GraduationCap, Activity, Phone
} from 'lucide-react';

export default function TraineeProfileTab({ employeeId }: { employeeId: string }) {
  const [trainee, setTrainee] = useState<any>(null);
  const [presentations, setPresentations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: t } = await supabase
          .from('fellowship_trainees')
          .select('*, employee:employees(name, specialty, phone, photo_url)')
          .eq('employee_id', employeeId).single();
        if (t) {
          setTrainee(t);
          const { data: pres } = await supabase
            .from('fellowship_lectures').select('*')
            .eq('presenter_trainee_id', t.id)
            .order('lecture_date', { ascending: false });
          setPresentations(pres || []);
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    if (employeeId) load();
  }, [employeeId]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-28 gap-3">
      <div className="w-14 h-14 bg-violet-50 rounded-2xl flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-violet-600" /></div>
      <p className="text-sm font-bold text-gray-400">جاري تحميل الملف...</p>
    </div>
  );
  if (!trainee) return <div className="p-8 text-center"><p className="font-bold text-gray-500">حساب المتدرب غير مفعّل.</p></div>;

  const name0 = trainee.employee?.name?.split(' ')[0] || '';

  return (
    <div className="animate-in fade-in duration-400" dir="rtl">

      {/* Banner */}
      <div className="relative h-32 bg-gradient-to-l from-violet-600 to-indigo-700 overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'repeating-linear-gradient(45deg, white 0, white 1px, transparent 0, transparent 50%)', backgroundSize: '12px 12px' }} />
      </div>

      {/* Avatar overlap */}
      <div className="px-5 md:px-8 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div className="flex items-end gap-4">
            <div className="-mt-10 w-20 h-20 rounded-2xl border-4 border-white shadow-xl bg-white overflow-hidden flex items-center justify-center text-indigo-700 text-3xl font-black flex-shrink-0">
              {trainee.employee?.photo_url
                ? <img src={trainee.employee.photo_url} className="w-full h-full object-cover" alt="" />
                : name0.charAt(0)
              }
            </div>
            <div className="mb-1">
              <h2 className="text-xl font-black text-gray-800 leading-tight">د. {trainee.employee?.name}</h2>
              <p className="text-sm font-semibold text-gray-500">{trainee.employee?.specialty}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl text-xs font-black border border-indigo-100 flex items-center gap-1.5">
              <GraduationCap size={14}/> {trainee.trainee_code}
            </span>
            <span className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl text-xs font-black border border-emerald-100 flex items-center gap-1.5">
              <Activity size={14}/> السنة {trainee.current_year} من ٣
            </span>
          </div>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {[
            { icon: Calendar, label: 'تاريخ الالتحاق', val: new Date(trainee.enrollment_date).toLocaleDateString('ar-EG'), color: 'text-blue-600', bg: 'bg-blue-50' },
            { icon: CheckCircle, label: 'حالة البرنامج', val: trainee.status === 'active' ? 'نشط ✓' : 'غير نشط', color: 'text-emerald-600', bg: 'bg-emerald-50' },
            ...(trainee.employee?.phone ? [{ icon: Phone, label: 'رقم الاتصال', val: trainee.employee.phone, color: 'text-purple-600', bg: 'bg-purple-50' }] : []),
          ].map((card: any, i) => (
            <div key={i} className="bg-gray-50 rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${card.bg} ${card.color}`}><card.icon size={17} /></div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-gray-400">{card.label}</p>
                <p className="text-sm font-black text-gray-700 truncate">{card.val}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Presentations section */}
        <div>
          <h3 className="text-sm font-black text-gray-700 mb-4 flex items-center gap-2">
            <Presentation size={16} className="text-purple-600" /> المحاضرات التي قمت بإلقائها
          </h3>

          {presentations.length === 0 ? (
            <div className="p-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-center">
              <BookOpen className="mx-auto h-10 w-10 text-gray-200 mb-3" />
              <p className="text-gray-400 font-bold text-sm">لم تُلقِ أي محاضرات بعد.</p>
              <p className="text-gray-300 font-semibold text-xs mt-1">Journal Club أو دراسة حالة ستظهر هنا.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {presentations.map((p, i) => (
                <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 font-black text-sm flex items-center justify-center flex-shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-black text-gray-800 text-sm leading-tight mb-1">{p.title}</h4>
                        {p.description && <p className="text-xs font-semibold text-gray-500 line-clamp-2 leading-relaxed mb-2">{p.description}</p>}
                        <div className="flex flex-wrap gap-3 text-[10px] font-bold text-gray-400">
                          <span className="flex items-center gap-1"><Calendar size={11}/>{new Date(p.lecture_date).toLocaleDateString('ar-EG')}</span>
                          {p.location && <span className="flex items-center gap-1"><MapPin size={11}/>{p.location}</span>}
                        </div>
                      </div>
                    </div>
                    <span className="bg-purple-50 text-purple-700 text-[10px] font-black px-2.5 py-1 rounded-full border border-purple-100 flex-shrink-0">مُحاضِر</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
