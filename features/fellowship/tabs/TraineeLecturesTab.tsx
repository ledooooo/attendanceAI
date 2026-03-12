import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import { Presentation, CheckCircle, PlayCircle, Loader2, Calendar, Clock, MapPin, Award } from 'lucide-react';

export default function TraineeLecturesTab({ employeeId }: { employeeId: string }) {
  const [traineeId, setTraineeId] = useState<string | null>(null);
  const [lectures, setLectures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // حالة الاختبار
  const [activeLecture, setActiveLecture] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchLectures();
  }, [employeeId]);

  const fetchLectures = async () => {
    setLoading(true);
    try {
      const { data: trainee } = await supabase.from('fellowship_trainees').select('id').eq('employee_id', employeeId).single();
      if (!trainee) return;
      setTraineeId(trainee.id);

      // جلب المحاضرات + حالة حضور المتدرب الحالي
      const { data: lecs } = await supabase
        .from('fellowship_lectures')
        .select('*, attendance:fellowship_lecture_attendance(*)')
        .order('lecture_date', { ascending: false });

      // تصفية الحضور ليظهر فقط حضور المتدرب الحالي
      const formattedLecs = lecs?.map(l => ({
        ...l,
        myAttendance: l.attendance?.find((a: any) => a.trainee_id === trainee.id) || null
      }));

      setLectures(formattedLecs || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // إثبات الحضور
  const handleMarkAttendance = async (lectureId: string) => {
    try {
      const { error } = await supabase.from('fellowship_lecture_attendance').insert({
        lecture_id: lectureId,
        trainee_id: traineeId,
        attended: true
      });
      if (error) throw error;
      toast.success('تم إثبات الحضور بنجاح');
      fetchLectures();
    } catch (error) {
      toast.error('حدث خطأ في التسجيل');
    }
  };

  // تسليم الاختبار
  const handleSubmitQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLecture || !activeLecture.quiz_questions) return;
    
    setSubmitting(true);
    let score = 0;
    const questions = activeLecture.quiz_questions;

    // حساب النتيجة
    questions.forEach((q: any, index: number) => {
      if (answers[index] === q.correct_answer) score += 1;
    });

    const percentage = (score / questions.length) * 100;
    const passed = percentage >= 60; // نسبة النجاح 60%

    try {
      const { error } = await supabase
        .from('fellowship_lecture_attendance')
        .update({ quiz_score: percentage, passed: passed })
        .eq('lecture_id', activeLecture.id)
        .eq('trainee_id', traineeId);

      if (error) throw error;

      if (passed) {
        toast.success(`مبروك! اجتزت الاختبار بنسبة ${percentage}%`);
      } else {
        toast.error(`للأسف لم تجتز الاختبار. نسبتك ${percentage}%`);
      }
      
      setActiveLecture(null);
      setAnswers({});
      fetchLectures();

    } catch (error) {
      toast.error('حدث خطأ أثناء حفظ النتيجة');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6 animate-in fade-in" dir="rtl">
      
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-3">
        <Presentation className="text-blue-600 w-8 h-8" />
        <div>
          <h2 className="text-xl font-black text-gray-800">قاعة المحاضرات (Scientific Activities)</h2>
          <p className="text-xs font-bold text-gray-500 mt-1">سجل حضورك في المحاضرات وأجب على الاختبارات المرفقة.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {lectures.map(lec => (
          <div key={lec.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative">
            <h3 className="font-black text-gray-800 text-lg mb-2">{lec.title}</h3>
            <p className="text-xs font-bold text-gray-500 mb-4">{lec.description}</p>
            
            <div className="flex flex-wrap gap-3 mb-4 text-xs font-bold text-gray-600 bg-gray-50 p-3 rounded-xl">
              <span className="flex items-center gap-1"><Calendar size={14}/> {new Date(lec.lecture_date).toLocaleDateString('ar-EG')}</span>
              <span className="flex items-center gap-1"><Clock size={14}/> {lec.lecture_time}</span>
              <span className="flex items-center gap-1"><MapPin size={14}/> {lec.location}</span>
            </div>

            {/* أزرار الإجراءات */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              {!lec.myAttendance ? (
                <button onClick={() => handleMarkAttendance(lec.id)} className="w-full bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white py-2.5 rounded-xl font-black text-sm transition-colors">
                  تسجيل الحضور
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2 text-emerald-600 bg-emerald-50 py-2 rounded-xl text-sm font-black border border-emerald-100">
                    <CheckCircle size={18}/> تم إثبات الحضور
                  </div>
                  
                  {lec.quiz_questions && lec.quiz_questions.length > 0 && !lec.myAttendance.passed && (
                    <button onClick={() => setActiveLecture(lec)} className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl font-black text-sm transition-colors flex items-center justify-center gap-2 shadow-md">
                      <PlayCircle size={18}/> بدء الاختبار (Quiz)
                    </button>
                  )}

                  {lec.myAttendance.passed && (
                    <div className="flex items-center justify-center gap-2 text-amber-600 bg-amber-50 py-2 rounded-xl text-sm font-black border border-amber-100">
                      <Award size={18}/> اجتزت الاختبار ({lec.myAttendance.quiz_score}%)
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* نافذة الاختبار المنبثقة (Modal) */}
      {activeLecture && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl p-6 md:p-8 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-black text-gray-800 mb-6 border-b pb-4">اختبار: {activeLecture.title}</h2>
            
            <form onSubmit={handleSubmitQuiz} className="space-y-6">
              {activeLecture.quiz_questions.map((q: any, qIndex: number) => (
                <div key={qIndex} className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                  <h4 className="font-black text-gray-800 text-sm mb-4">{qIndex + 1}. {q.question}</h4>
                  <div className="space-y-2">
                    {q.options.map((opt: string, optIndex: number) => (
                      <label key={optIndex} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-colors ${answers[qIndex] === opt ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                        <input 
                          type="radio" name={`q-${qIndex}`} value={opt} required
                          onChange={() => setAnswers({...answers, [qIndex]: opt})}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm font-bold text-gray-700">{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setActiveLecture(null)} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-black hover:bg-gray-200">إلغاء</button>
                <button type="submit" disabled={submitting} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black hover:bg-blue-700 flex justify-center items-center">
                  {submitting ? <Loader2 className="animate-spin" /> : 'تسليم الاختبار'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
