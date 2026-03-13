import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import {
  Presentation, CheckCircle, PlayCircle, Loader2, Calendar,
  Clock, MapPin, Award, X, ChevronRight, BookOpen, BarChart2
} from 'lucide-react';

export default function TraineeLecturesTab({ employeeId }: { employeeId: string }) {
  const [traineeId, setTraineeId] = useState<string | null>(null);
  const [lectures, setLectures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLecture, setActiveLecture] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; passed: boolean } | null>(null);

  const fetchLectures = async () => {
    setLoading(true);
    try {
      const { data: t } = await supabase.from('fellowship_trainees').select('id').eq('employee_id', employeeId).single();
      if (!t) return;
      setTraineeId(t.id);
      const { data: lecs } = await supabase
        .from('fellowship_lectures')
        .select('*, attendance:fellowship_lecture_attendance(*)')
        .order('lecture_date', { ascending: false });
      setLectures((lecs || []).map(l => ({
        ...l,
        myAttendance: l.attendance?.find((a: any) => a.trainee_id === t.id) || null,
      })));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (employeeId) fetchLectures(); }, [employeeId]);

  const handleAttendance = async (lectureId: string) => {
    try {
      await supabase.from('fellowship_lecture_attendance').insert({ lecture_id: lectureId, trainee_id: traineeId, attended: true });
      toast.success('✅ تم إثبات الحضور');
      fetchLectures();
    } catch { toast.error('حدث خطأ'); }
  };

  const handleQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLecture?.quiz_questions) return;
    setSubmitting(true);
    let score = 0;
    activeLecture.quiz_questions.forEach((q: any, i: number) => { if (answers[i] === q.correct_answer) score++; });
    const pct = Math.round((score / activeLecture.quiz_questions.length) * 100);
    const passed = pct >= 60;
    try {
      await supabase.from('fellowship_lecture_attendance')
        .update({ quiz_score: pct, passed })
        .eq('lecture_id', activeLecture.id).eq('trainee_id', traineeId);
      setResult({ score: pct, passed });
      fetchLectures();
    } catch { toast.error('حدث خطأ'); }
    finally { setSubmitting(false); }
  };

  const attendedCount = lectures.filter(l => l.myAttendance).length;
  const passedCount   = lectures.filter(l => l.myAttendance?.passed).length;

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-28 gap-3">
      <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-blue-600" /></div>
      <p className="text-sm font-bold text-gray-400">جاري تحميل المحاضرات...</p>
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-5 animate-in fade-in duration-400" dir="rtl">

      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 bg-blue-50 rounded-2xl flex items-center justify-center"><Presentation size={22} className="text-blue-600" /></div>
          <div>
            <h2 className="text-base font-black text-gray-800">قاعة المحاضرات (Scientific Activities)</h2>
            <p className="text-[11px] font-semibold text-gray-400">سجّل حضورك وأجب على الاختبارات المرفقة بكل محاضرة</p>
          </div>
        </div>
        {lectures.length > 0 && (
          <div className="grid grid-cols-3 gap-2 pt-4 border-t border-gray-50">
            {[
              { label: 'إجمالي المحاضرات', val: lectures.length, cl: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'حضرتها', val: attendedCount, cl: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'اجتزت اختباراتها', val: passedCount, cl: 'text-amber-600', bg: 'bg-amber-50' },
            ].map(s => (
              <div key={s.label} className={`${s.bg} p-3 rounded-xl text-center`}>
                <p className={`text-xl font-black ${s.cl}`}>{s.val}</p>
                <p className="text-[9px] font-bold text-gray-500 mt-0.5 leading-tight">{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lectures */}
      {lectures.length === 0 ? (
        <div className="bg-white p-14 rounded-2xl border border-dashed border-gray-200 text-center">
          <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p className="font-black text-gray-400 text-sm">لا توجد محاضرات مضافة بعد</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {lectures.map(lec => {
            const attended = !!lec.myAttendance;
            const passed   = lec.myAttendance?.passed;
            const hasQuiz  = lec.quiz_questions?.length > 0;
            return (
              <div key={lec.id} className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all overflow-hidden ${attended ? 'border-emerald-200' : 'border-gray-100'}`}>
                {/* Top colored band */}
                <div className={`h-1 ${attended ? (passed ? 'bg-amber-400' : 'bg-emerald-400') : 'bg-gray-200'}`} />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-black text-gray-800 text-sm leading-tight flex-1">{lec.title}</h3>
                    {attended && (
                      <span className="text-[10px] font-black bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1 flex-shrink-0">
                        <CheckCircle size={10}/> حضر
                      </span>
                    )}
                  </div>
                  {lec.description && <p className="text-xs font-semibold text-gray-500 mb-3 line-clamp-2">{lec.description}</p>}

                  <div className="flex flex-wrap gap-3 text-[10px] font-bold text-gray-500 bg-gray-50 px-3 py-2.5 rounded-xl mb-4">
                    <span className="flex items-center gap-1.5"><Calendar size={11}/>{new Date(lec.lecture_date).toLocaleDateString('ar-EG')}</span>
                    {lec.lecture_time && <span className="flex items-center gap-1.5"><Clock size={11}/>{lec.lecture_time}</span>}
                    {lec.location && <span className="flex items-center gap-1.5"><MapPin size={11}/>{lec.location}</span>}
                    {hasQuiz && <span className="flex items-center gap-1.5 text-orange-500 font-black"><BarChart2 size={11}/>{lec.quiz_questions.length} أسئلة</span>}
                  </div>

                  {/* Actions */}
                  {!attended ? (
                    <button onClick={() => handleAttendance(lec.id)}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-black text-sm transition-colors active:scale-[0.99] flex items-center justify-center gap-2">
                      <CheckCircle size={16}/> تسجيل الحضور
                    </button>
                  ) : (
                    <div className="space-y-2">
                      {hasQuiz && !passed && (
                        <button onClick={() => { setActiveLecture(lec); setAnswers({}); setResult(null); }}
                          className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-colors active:scale-[0.99] shadow-md shadow-orange-100">
                          <PlayCircle size={16}/> بدء الاختبار
                        </button>
                      )}
                      {passed && (
                        <div className="flex items-center justify-center gap-2 bg-amber-50 text-amber-700 py-2.5 rounded-xl text-sm font-black border border-amber-100">
                          <Award size={16}/> اجتزت بنسبة {lec.myAttendance.quiz_score}%
                        </div>
                      )}
                      {hasQuiz && !passed && lec.myAttendance.quiz_score != null && (
                        <p className="text-center text-xs font-black text-rose-500">آخر محاولة: {lec.myAttendance.quiz_score}% — لم تجتز</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quiz Modal */}
      {activeLecture && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-200">

            {/* Modal header */}
            <div className="p-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <div>
                <p className="text-[10px] font-bold text-gray-400 mb-0.5">اختبار المحاضرة</p>
                <h2 className="text-base font-black text-gray-800 line-clamp-1">{activeLecture.title}</h2>
              </div>
              {!result && (
                <button onClick={() => setActiveLecture(null)}
                  className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full hover:bg-red-50 hover:text-red-500 text-gray-500 transition-colors">
                  <X size={16}/>
                </button>
              )}
            </div>

            {/* Result screen */}
            {result ? (
              <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
                <div className={`w-24 h-24 rounded-3xl flex items-center justify-center mb-5 shadow-xl text-white text-3xl font-black ${result.passed ? 'bg-emerald-500 shadow-emerald-200' : 'bg-rose-500 shadow-rose-200'}`}>
                  {result.passed ? '🎉' : '😔'}
                </div>
                <h3 className="text-2xl font-black text-gray-800 mb-2">{result.passed ? 'مبروك! اجتزت الاختبار' : 'لم تجتز هذه المرة'}</h3>
                <p className="text-lg font-bold text-gray-500 mb-6">نسبتك: <span className={`font-black text-2xl ${result.passed ? 'text-emerald-600' : 'text-rose-600'}`}>{result.score}%</span></p>
                <p className="text-xs font-semibold text-gray-400 mb-6">{result.passed ? 'تم حفظ نتيجتك بنجاح.' : 'يمكنك إعادة المحاولة لاحقاً.'}</p>
                <button onClick={() => { setActiveLecture(null); setResult(null); }}
                  className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-black text-sm hover:bg-indigo-700 transition-colors active:scale-95">
                  إغلاق
                </button>
              </div>
            ) : (
              <form onSubmit={handleQuiz} className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="p-5 space-y-5">
                  {activeLecture.quiz_questions.map((q: any, qi: number) => (
                    <div key={qi} className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                      <h4 className="font-black text-gray-800 text-sm mb-3 flex items-start gap-2">
                        <span className="w-6 h-6 bg-indigo-600 text-white rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5">{qi+1}</span>
                        {q.question}
                      </h4>
                      <div className="space-y-2">
                        {q.options.map((opt: string, oi: number) => (
                          <label key={oi}
                            className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-all ${answers[qi] === opt ? 'bg-indigo-50 border-indigo-300 shadow-sm' : 'bg-white border-gray-100 hover:border-gray-200'}`}>
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${answers[qi] === opt ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'}`}>
                              {answers[qi] === opt && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                            <input type="radio" name={`q-${qi}`} value={opt} required className="sr-only"
                              onChange={() => setAnswers(a => ({...a, [qi]: opt}))} />
                            <span className="text-sm font-bold text-gray-700">{opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-5 border-t border-gray-100 flex gap-3 flex-shrink-0 sticky bottom-0 bg-white">
                  <button type="button" onClick={() => setActiveLecture(null)} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-black text-sm hover:bg-gray-200">إلغاء</button>
                  <button type="submit" disabled={submitting || Object.keys(answers).length < activeLecture.quiz_questions.length}
                    className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 active:scale-[0.99]">
                    {submitting ? <Loader2 size={17} className="animate-spin"/> : <><ChevronRight size={17}/> تسليم الاختبار</>}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
