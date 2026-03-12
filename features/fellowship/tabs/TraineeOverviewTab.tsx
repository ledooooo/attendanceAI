import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { GraduationCap, BookOpen, FileText, CheckCircle, Loader2, AlertCircle, TrendingUp, Calendar } from 'lucide-react';

export default function TraineeOverviewTab({ employeeId }: { employeeId: string }) {
  const [loading, setLoading] = useState(true);
  const [traineeData, setTraineeData] = useState<any>(null);
  const [stats, setStats] = useState({ logbooks: 0, approvedLogbooks: 0, portfolio: 0, dops: 0 });

  useEffect(() => {
    const fetchOverview = async () => {
      setLoading(true);
      try {
        // جلب بيانات المتدرب
        const { data: trainee } = await supabase
          .from('fellowship_trainees')
          .select('*, employee:employees(name, specialty)')
          .eq('employee_id', employeeId)
          .single();

        if (!trainee) {
          setLoading(false);
          return;
        }
        setTraineeData(trainee);

        // جلب الإحصائيات
        const [
          { count: logsCount }, { count: approvedLogsCount }, 
          { count: portCount }, { count: dopsCount }
        ] = await Promise.all([
          supabase.from('fellowship_logbook').select('*', { count: 'exact', head: true }).eq('trainee_id', trainee.id),
          supabase.from('fellowship_logbook').select('*', { count: 'exact', head: true }).eq('trainee_id', trainee.id).eq('trainer_reviewed', true),
          supabase.from('fellowship_portfolio_items').select('*', { count: 'exact', head: true }).eq('trainee_id', trainee.id),
          supabase.from('fellowship_dops_assessments').select('*', { count: 'exact', head: true }).eq('trainee_id', trainee.id)
        ]);

        setStats({
          logbooks: logsCount || 0,
          approvedLogbooks: approvedLogsCount || 0,
          portfolio: portCount || 0,
          dops: dopsCount || 0
        });

      } catch (error) {
        console.error("Error fetching overview", error);
      } finally {
        setLoading(false);
      }
    };

    if (employeeId) fetchOverview();
  }, [employeeId]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-indigo-600" /></div>;
  if (!traineeData) return (
    <div className="p-6 text-center animate-in fade-in">
      <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4 text-orange-500"><AlertCircle size={32} /></div>
      <h2 className="text-xl font-black text-gray-800">ملف المتدرب غير مفعل</h2>
    </div>
  );

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6 animate-in fade-in" dir="rtl">
      
      {/* بطاقة الترحيب */}
      <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
            <GraduationCap size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-800">مرحباً بك، د. {traineeData.employee?.name}</h2>
            <p className="text-sm font-bold text-gray-500 mt-1">كود الزمالة: {traineeData.trainee_code} | السنة التدريبية: {traineeData.current_year}</p>
          </div>
        </div>
        <div className="bg-gray-50 px-6 py-3 rounded-2xl border border-gray-100 text-center w-full md:w-auto">
          <p className="text-xs font-bold text-gray-400 mb-1">تاريخ الالتحاق</p>
          <p className="text-sm font-black text-gray-800 flex items-center justify-center gap-2">
            <Calendar size={16} className="text-indigo-500"/> {new Date(traineeData.enrollment_date).toLocaleDateString('ar-EG')}
          </p>
        </div>
      </div>

      {/* الإحصائيات (Stats) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="إجمالي الحالات (Logbook)" value={stats.logbooks} icon={BookOpen} color="text-blue-600" bg="bg-blue-50" />
        <StatCard title="الحالات المعتمدة" value={stats.approvedLogbooks} icon={CheckCircle} color="text-emerald-600" bg="bg-emerald-50" />
        <StatCard title="ملفات الإنجاز (Portfolio)" value={stats.portfolio} icon={FileText} color="text-amber-600" bg="bg-amber-50" />
        <StatCard title="تقييمات المهارات (DOPS)" value={stats.dops} icon={TrendingUp} color="text-purple-600" bg="bg-purple-50" />
      </div>

    </div>
  );
}

const StatCard = ({ title, value, icon: Icon, color, bg }: any) => (
  <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4">
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${bg} ${color}`}><Icon size={24} /></div>
    <div>
      <p className="text-xs font-bold text-gray-500">{title}</p>
      <h3 className="text-2xl font-black text-gray-800 mt-1">{value}</h3>
    </div>
  </div>
);
