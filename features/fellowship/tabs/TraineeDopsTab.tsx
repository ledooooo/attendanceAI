import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Activity, Star, Loader2, User, Calendar } from 'lucide-react';

export default function TraineeDopsTab({ employeeId }: { employeeId: string }) {
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: trainee } = await supabase.from('fellowship_trainees').select('id').eq('employee_id', employeeId).single();
        if (trainee) {
          const { data } = await supabase
            .from('fellowship_dops_assessments')
            .select(`
              *,
              skill:fellowship_clinical_skills(name_ar),
              assessor:fellowship_trainers(employee:employees(name))
            `)
            .eq('trainee_id', trainee.id)
            .order('assessment_date', { ascending: false });
          setAssessments(data || []);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    if (employeeId) fetchData();
  }, [employeeId]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-purple-600" /></div>;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6 animate-in fade-in" dir="rtl">
      
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-3">
        <Activity className="text-purple-600 w-8 h-8" />
        <div>
          <h2 className="text-xl font-black text-gray-800">التقييم العملي للمهارات (DOPS)</h2>
          <p className="text-xs font-bold text-gray-500 mt-1">يتم إضافة هذه التقييمات من قبل المدربين أثناء ملاحظتهم لأدائك المباشر.</p>
        </div>
      </div>

      {assessments.length === 0 ? (
        <div className="text-center py-20 text-gray-400 font-bold bg-white rounded-3xl border border-dashed">
          لا توجد تقييمات مسجلة لك حتى الآن.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {assessments.map(item => (
            <div key={item.id} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-2 h-full bg-purple-500"></div>
              
              <h3 className="font-black text-gray-800 text-base mb-2">{item.skill?.name_ar || 'مهارة إكلينيكية'}</h3>
              
              <div className="flex items-center gap-1 mb-4">
                {[1, 2, 3, 4, 5].map(star => (
                  <Star key={star} size={18} className={star <= item.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'} />
                ))}
                <span className="text-xs font-black text-gray-500 mr-2">({item.rating}/5)</span>
              </div>

              <div className="flex items-center justify-between text-xs font-bold text-gray-500 bg-gray-50 p-3 rounded-xl border border-gray-100">
                <span className="flex items-center gap-1"><User size={14}/> {item.assessor?.employee?.name || 'مدرب'}</span>
                <span className="flex items-center gap-1"><Calendar size={14}/> {new Date(item.assessment_date).toLocaleDateString('ar-EG')}</span>
              </div>

              {item.assessor_feedback && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-[10px] font-black text-gray-400 mb-1">ملاحظات المدرب:</p>
                  <p className="text-sm font-bold text-purple-800 leading-relaxed">"{item.assessor_feedback}"</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
