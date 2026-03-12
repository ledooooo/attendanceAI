import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { User, Calendar, Award, BookOpen, Loader2, Presentation, CheckCircle } from 'lucide-react';

export default function TraineeProfileTab({ employeeId }: { employeeId: string }) {
  const [trainee, setTrainee] = useState<any>(null);
  const [myPresentations, setMyPresentations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        // جلب بيانات المتدرب
        const { data: traineeData } = await supabase
          .from('fellowship_trainees')
          .select('*, employee:employees(name, specialty, phone, photo_url)')
          .eq('employee_id', employeeId)
          .single();

        if (traineeData) {
          setTrainee(traineeData);
          
          // جلب المحاضرات التي قام هذا المتدرب بشرحها
          const { data: presentations } = await supabase
            .from('fellowship_lectures')
            .select('*')
            .eq('presenter_trainee_id', traineeData.id)
            .order('lecture_date', { ascending: false });
            
          setMyPresentations(presentations || []);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    if (employeeId) fetchProfile();
  }, [employeeId]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-600" /></div>;
  if (!trainee) return <div className="text-center py-20 font-bold text-gray-500">حساب المتدرب غير مفعل.</div>;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6 animate-in fade-in" dir="rtl">
      
      {/* بطاقة البروفايل */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="h-32 bg-gradient-to-r from-indigo-600 to-purple-600"></div>
        <div className="px-6 pb-6 relative">
          <div className="w-24 h-24 bg-white rounded-full border-4 border-white shadow-md absolute -top-12 flex items-center justify-center text-3xl font-black text-indigo-600 overflow-hidden">
            {trainee.employee?.photo_url ? <img src={trainee.employee.photo_url} className="w-full h-full object-cover"/> : trainee.employee?.name.charAt(0)}
          </div>
          <div className="mt-14 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-gray-800">د. {trainee.employee?.name}</h2>
              <p className="text-sm font-bold text-gray-500">{trainee.employee?.specialty}</p>
            </div>
            <div className="flex gap-2">
              <span className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl text-sm font-black border border-indigo-100">
                كود الزمالة: {trainee.trainee_code}
              </span>
              <span className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl text-sm font-black border border-emerald-100">
                السنة: {trainee.current_year}
              </span>
            </div>
          </div>
        </div>
        <div className="bg-gray-50 px-6 py-4 border-t flex flex-wrap gap-6 text-sm font-bold text-gray-600">
          <div className="flex items-center gap-2"><Calendar className="text-gray-400" size={18}/> تاريخ الالتحاق: {new Date(trainee.enrollment_date).toLocaleDateString('ar-EG')}</div>
          <div className="flex items-center gap-2"><CheckCircle className="text-gray-400" size={18}/> الحالة: {trainee.status === 'active' ? 'نشط' : 'غير نشط'}</div>
        </div>
      </div>

      {/* المحاضرات التي ألقاها */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
          <Presentation className="text-purple-600" /> سجل المحاضرات العلمية التي قمت بإلقائها
        </h3>
        
        {myPresentations.length === 0 ? (
          <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <BookOpen className="mx-auto h-12 w-12 text-gray-300 mb-3" />
            <p className="text-gray-500 font-bold text-sm">لم تقم بشرح أي محاضرات علمية (Journal Club / Case) حتى الآن.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myPresentations.map(pres => (
              <div key={pres.id} className="p-4 bg-purple-50 rounded-2xl border border-purple-100">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-black text-purple-900 text-sm">{pres.title}</h4>
                  <span className="bg-white text-purple-600 px-2 py-1 rounded text-[10px] font-black shadow-sm">مُحاضِر</span>
                </div>
                <p className="text-xs text-gray-600 font-bold mb-3">{pres.description}</p>
                <div className="flex items-center justify-between text-xs font-bold text-gray-500">
                  <span>التاريخ: {new Date(pres.lecture_date).toLocaleDateString('ar-EG')}</span>
                  <span>المكان: {pres.location}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
