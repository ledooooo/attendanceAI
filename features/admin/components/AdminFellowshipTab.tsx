import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import { 
  GraduationCap, Users, Stethoscope, Link as LinkIcon, 
  Calendar, Loader2, Plus, Trash2, CheckCircle 
} from 'lucide-react';

export default function AdminFellowshipTab() {
  const [activeSection, setActiveSection] = useState<'trainees' | 'trainers' | 'assignments'>('trainees');
  const [loading, setLoading] = useState(false);
  
  // البيانات
  const [employees, setEmployees] = useState<any[]>([]);
  const [trainees, setTrainees] = useState<any[]>([]);
  const [trainers, setTrainers] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);

  // حالات النماذج (Forms)
  const [newTrainee, setNewTrainee] = useState({ employee_id: '', trainee_code: '', enrollment_date: '' });
  const [newTrainer, setNewTrainer] = useState({ employee_id: '', trainer_code: '', title: '' });
  const [newAssignment, setNewAssignment] = useState({ trainer_id: '', trainee_id: '', start_date: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // جلب جميع الموظفين (لاختيارهم في القوائم)
      const { data: emps } = await supabase.from('employees').select('id, name, specialty, role');
      setEmployees(emps || []);

      // جلب المتدربين مع بياناتهم من جدول الموظفين
      const { data: trns } = await supabase
        .from('fellowship_trainees')
        .select('*, employee:employees(name, specialty)');
      setTrainees(trns || []);

      // جلب المدربين
      const { data: trnrs } = await supabase
        .from('fellowship_trainers')
        .select('*, employee:employees(name, specialty)');
      setTrainers(trnrs || []);

      // جلب الإسناد
      const { data: asgns } = await supabase
        .from('fellowship_trainer_trainee')
        .select('*, trainer:fellowship_trainers(employee:employees(name)), trainee:fellowship_trainees(employee:employees(name))');
      setAssignments(asgns || []);

    } catch (error) {
      toast.error('حدث خطأ أثناء جلب البيانات');
    } finally {
      setLoading(false);
    }
  };

  // --- دوال الإضافة ---
  const handleAddTrainee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('fellowship_trainees').insert([newTrainee]);
      if (error) throw error;
      toast.success('تم إضافة المتدرب بنجاح');
      setNewTrainee({ employee_id: '', trainee_code: '', enrollment_date: '' });
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'خطأ في الإضافة');
    }
  };

  const handleAddTrainer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('fellowship_trainers').insert([newTrainer]);
      if (error) throw error;
      toast.success('تم تعيين المدرب بنجاح');
      setNewTrainer({ employee_id: '', trainer_code: '', title: '' });
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'خطأ في الإضافة');
    }
  };

  const handleAddAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('fellowship_trainer_trainee').insert([newAssignment]);
      if (error) throw error;
      toast.success('تم ربط المتدرب بالمدرب بنجاح');
      setNewAssignment({ trainer_id: '', trainee_id: '', start_date: '' });
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'خطأ في الإسناد');
    }
  };

  // --- واجهة المستخدم (UI) ---
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 animate-in fade-in" dir="rtl">
      
      {/* هيدر الصفحة */}
      <div className="bg-gradient-to-l from-indigo-900 to-indigo-700 rounded-3xl p-8 text-white shadow-xl flex items-center gap-4">
        <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm">
          <GraduationCap size={40} className="text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-black mb-2 tracking-tight">إدارة أكاديمية الزمالة</h1>
          <p className="text-indigo-100 font-bold text-sm">تحكم كامل في المتدربين، المدربين، والإسناد الأكاديمي.</p>
        </div>
      </div>

      {/* أزرار التنقل بين الأقسام */}
      <div className="flex bg-white p-2 rounded-2xl shadow-sm border border-gray-100 w-fit">
        <button onClick={() => setActiveSection('trainees')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm transition-all ${activeSection === 'trainees' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}>
          <Users size={18} /> المتدربون ({trainees.length})
        </button>
        <button onClick={() => setActiveSection('trainers')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm transition-all ${activeSection === 'trainers' ? 'bg-emerald-50 text-emerald-700' : 'text-gray-500 hover:bg-gray-50'}`}>
          <Stethoscope size={18} /> المدربون ({trainers.length})
        </button>
        <button onClick={() => setActiveSection('assignments')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm transition-all ${activeSection === 'assignments' ? 'bg-amber-50 text-amber-700' : 'text-gray-500 hover:bg-gray-50'}`}>
          <LinkIcon size={18} /> الإسناد والربط
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-indigo-600" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* قسم إضافة جديد (فورم) */}
          <div className="lg:col-span-1">
            
            {activeSection === 'trainees' && (
              <form onSubmit={handleAddTrainee} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
                <h3 className="font-black text-indigo-900 text-lg mb-4 flex items-center gap-2"><Plus size={20}/> إضافة متدرب جديد</h3>
                
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">اختر الموظف (الطبيب)</label>
                  <select required value={newTrainee.employee_id} onChange={e => setNewTrainee({...newTrainee, employee_id: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none">
                    <option value="">-- اختر من القائمة --</option>
                    {employees.filter(e => !trainees.some(t => t.employee_id === e.id)).map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.specialty})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">كود الزمالة</label>
                  <input required type="text" value={newTrainee.trainee_code} onChange={e => setNewTrainee({...newTrainee, trainee_code: e.target.value})} placeholder="TR-001" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none" dir="ltr" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">تاريخ الالتحاق</label>
                  <input required type="date" value={newTrainee.enrollment_date} onChange={e => setNewTrainee({...newTrainee, enrollment_date: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none" />
                </div>

                <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black flex justify-center items-center gap-2 hover:bg-indigo-700 transition-colors">
                  حفظ المتدرب
                </button>
              </form>
            )}

            {activeSection === 'trainers' && (
              <form onSubmit={handleAddTrainer} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
                <h3 className="font-black text-emerald-900 text-lg mb-4 flex items-center gap-2"><Plus size={20}/> تعيين مدرب جديد</h3>
                
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">اختر الموظف (الطبيب/المدير)</label>
                  <select required value={newTrainer.employee_id} onChange={e => setNewTrainer({...newTrainer, employee_id: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none">
                    <option value="">-- اختر من القائمة --</option>
                    {employees.filter(e => !trainers.some(t => t.employee_id === e.id)).map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">كود المدرب</label>
                  <input required type="text" value={newTrainer.trainer_code} onChange={e => setNewTrainer({...newTrainer, trainer_code: e.target.value})} placeholder="TRN-001" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none" dir="ltr" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">اللقب الأكاديمي</label>
                  <input required type="text" value={newTrainer.title} onChange={e => setNewTrainer({...newTrainer, title: e.target.value})} placeholder="مؤدب / استشاري / مدير" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none" />
                </div>

                <button type="submit" className="w-full py-3 bg-emerald-600 text-white rounded-xl font-black flex justify-center items-center gap-2 hover:bg-emerald-700 transition-colors">
                  تعيين كمدرب
                </button>
              </form>
            )}

            {activeSection === 'assignments' && (
              <form onSubmit={handleAddAssignment} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
                <h3 className="font-black text-amber-900 text-lg mb-4 flex items-center gap-2"><LinkIcon size={20}/> ربط متدرب بمدرب</h3>
                
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">المدرب (المشرف)</label>
                  <select required value={newAssignment.trainer_id} onChange={e => setNewAssignment({...newAssignment, trainer_id: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none">
                    <option value="">-- اختر المدرب --</option>
                    {trainers.map(t => <option key={t.id} value={t.id}>{t.employee?.name} ({t.title})</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">المتدرب</label>
                  <select required value={newAssignment.trainee_id} onChange={e => setNewAssignment({...newAssignment, trainee_id: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none">
                    <option value="">-- اختر المتدرب --</option>
                    {trainees.map(t => <option key={t.id} value={t.id}>{t.employee?.name} ({t.trainee_code})</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">تاريخ بداية الإشراف</label>
                  <input required type="date" value={newAssignment.start_date} onChange={e => setNewAssignment({...newAssignment, start_date: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none" />
                </div>

                <button type="submit" className="w-full py-3 bg-amber-600 text-white rounded-xl font-black flex justify-center items-center gap-2 hover:bg-amber-700 transition-colors">
                  تأكيد الإسناد
                </button>
              </form>
            )}

          </div>

          {/* قسم العرض (الجداول/القوائم) */}
          <div className="lg:col-span-2">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 min-h-[400px]">
              
              {activeSection === 'trainees' && (
                <div className="space-y-3">
                  <h3 className="font-black text-gray-800 text-lg border-b pb-2 mb-4">قائمة المتدربين المسجلين</h3>
                  {trainees.length === 0 ? <p className="text-gray-400 text-sm font-bold text-center py-10">لا يوجد متدربين</p> : trainees.map(t => (
                    <div key={t.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-indigo-200 transition-colors">
                      <div>
                        <p className="font-black text-gray-800 text-sm">{t.employee?.name}</p>
                        <div className="flex gap-3 text-xs text-gray-500 font-bold mt-1">
                          <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">{t.trainee_code}</span>
                          <span>السنة: {t.current_year}</span>
                          <span>الالتحاق: {new Date(t.enrollment_date).toLocaleDateString('en-GB')}</span>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-lg text-xs font-black ${t.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {t.status === 'active' ? 'نشط' : 'موقوف'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {activeSection === 'trainers' && (
                <div className="space-y-3">
                  <h3 className="font-black text-gray-800 text-lg border-b pb-2 mb-4">قائمة المدربين المعتمدين</h3>
                  {trainers.length === 0 ? <p className="text-gray-400 text-sm font-bold text-center py-10">لا يوجد مدربين</p> : trainers.map(t => (
                    <div key={t.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-emerald-200 transition-colors">
                      <div>
                        <p className="font-black text-gray-800 text-sm">{t.employee?.name}</p>
                        <div className="flex gap-3 text-xs text-gray-500 font-bold mt-1">
                          <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">{t.trainer_code}</span>
                          <span>{t.title}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeSection === 'assignments' && (
                <div className="space-y-3">
                  <h3 className="font-black text-gray-800 text-lg border-b pb-2 mb-4">سجل الإشراف (من يدرب من؟)</h3>
                  {assignments.length === 0 ? <p className="text-gray-400 text-sm font-bold text-center py-10">لا توجد سجلات إسناد</p> : assignments.map(a => (
                    <div key={a.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-amber-200 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <p className="text-[10px] text-gray-400 font-bold">المدرب</p>
                          <p className="font-black text-gray-800 text-sm">{a.trainer?.employee?.name}</p>
                        </div>
                        <LinkIcon size={16} className="text-amber-400" />
                        <div className="text-center">
                          <p className="text-[10px] text-gray-400 font-bold">المتدرب</p>
                          <p className="font-black text-gray-800 text-sm">{a.trainee?.employee?.name}</p>
                        </div>
                      </div>
                      <div className="text-xs font-bold text-gray-500 bg-white px-3 py-1 rounded-lg border border-gray-200">
                        بدأ: {new Date(a.start_date).toLocaleDateString('ar-EG')}
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>
          </div>

        </div>
      )}
    </div>
  );
}
