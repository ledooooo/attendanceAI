import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import { 
  GraduationCap, Users, Stethoscope, Link as LinkIcon, 
  Calendar, Loader2, Plus, Trash2, CheckCircle,
  FileText, Activity, BookOpen, UserCog
} from 'lucide-react';

type Section = 'trainees' | 'trainers' | 'assignments' | 'rotations' | 'logbook_review' | 'dops_eval' | 'tar_reports';

export default function AdminFellowshipTab() {
  const [activeSection, setActiveSection] = useState<Section>('trainees');
  const [loading, setLoading] = useState(false);
  
  // --- Data States ---
  const [employees, setEmployees] = useState<any[]>([]);
  const [trainees, setTrainees] = useState<any[]>([]);
  const [trainers, setTrainers] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [rotationTypes, setRotationTypes] = useState<any[]>([]);
  const [clinicalSkills, setClinicalSkills] = useState<any[]>([]);
  const [pendingLogbooks, setPendingLogbooks] = useState<any[]>([]);

  // --- Form States ---
  const [newTrainee, setNewTrainee] = useState({ employee_id: '', trainee_code: '', enrollment_date: '' });
  const [newTrainer, setNewTrainer] = useState({ employee_id: '', trainer_code: '', title: '' });
  const [newAssignment, setNewAssignment] = useState({ trainer_id: '', trainee_id: '', start_date: '' });
  const [newRotation, setNewRotation] = useState({ trainee_id: '', rotation_type_id: '', start_date: '', end_date: '', trainer_id: '' });
  const [newDops, setNewDops] = useState({ trainee_id: '', assessor_id: '', skill_id: '', assessment_date: '', rating: 3, assessor_feedback: '' });
  const [newTar, setNewTar] = useState({ trainee_id: '', trainer_id: '', report_period_start: '', report_period_end: '', overall_rating: 3, trainer_comments: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        { data: emps }, { data: trns }, { data: trnrs }, 
        { data: asgns }, { data: rts }, { data: skills }, { data: logs }
      ] = await Promise.all([
        supabase.from('employees').select('id, name, specialty, role'),
        supabase.from('fellowship_trainees').select('*, employee:employees(name, specialty)'),
        supabase.from('fellowship_trainers').select('*, employee:employees(name, specialty)'),
        supabase.from('fellowship_trainer_trainee').select('*, trainer:fellowship_trainers(employee:employees(name)), trainee:fellowship_trainees(employee:employees(name))'),
        supabase.from('fellowship_rotation_types').select('*').order('training_year', { ascending: true }),
        supabase.from('fellowship_clinical_skills').select('*'),
        supabase.from('fellowship_logbook').select('*, trainee:fellowship_trainees(employee:employees(name))').eq('trainer_reviewed', false)
      ]);

      setEmployees(emps || []);
      setTrainees(trns || []);
      setTrainers(trnrs || []);
      setAssignments(asgns || []);
      setRotationTypes(rts || []);
      setClinicalSkills(skills || []);
      setPendingLogbooks(logs || []);
    } catch (error) {
      toast.error('حدث خطأ أثناء جلب البيانات');
    } finally {
      setLoading(false);
    }
  };

  // --- Handlers (Add Functions) ---
  const handleAdd = async (table: string, data: any, resetState: Function, successMsg: string) => {
    try {
      const { error } = await supabase.from(table).insert([data]);
      if (error) throw error;
      toast.success(successMsg);
      resetState();
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'حدث خطأ أثناء الحفظ');
    }
  };

  const handleApproveLogbook = async (id: string) => {
    try {
      const { error } = await supabase.from('fellowship_logbook').update({ trainer_reviewed: true, trainer_review_date: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      toast.success('تم اعتماد الحالة');
      fetchData();
    } catch (error) {
      toast.error('خطأ في الاعتماد');
    }
  };

  // --- UI Components ---
  const renderNavButton = (id: Section, label: string, icon: any, colorClass: string) => {
    const Icon = icon;
    const isActive = activeSection === id;
    return (
      <button 
        onClick={() => setActiveSection(id)} 
        className={`flex flex-col items-center justify-center p-3 rounded-2xl font-black text-xs transition-all w-24 text-center ${isActive ? `bg-white shadow-md ${colorClass}` : 'text-gray-500 hover:bg-white/50'}`}
      >
        <Icon size={24} className="mb-1" />
        {label}
      </button>
    );
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in" dir="rtl">
      
      {/* Header */}
      <div className="bg-gradient-to-l from-indigo-900 to-purple-800 rounded-3xl p-6 md:p-8 text-white shadow-xl flex items-center gap-4">
        <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm hidden md:block">
          <GraduationCap size={40} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-black mb-2 tracking-tight">إدارة الزمالة المصرية لطب الأسرة</h1>
          <p className="text-indigo-100 font-bold text-sm">لوحة التحكم الشاملة للتدريب، التقييم، والجداول (WPBA).</p>
        </div>
      </div>

      {/* Navigation Toolbar */}
      <div className="bg-gray-100 p-2 rounded-3xl flex overflow-x-auto no-scrollbar gap-2 shadow-inner">
        {renderNavButton('trainees', 'المتدربون', Users, 'text-indigo-700')}
        {renderNavButton('trainers', 'المدربون', Stethoscope, 'text-emerald-700')}
        {renderNavButton('assignments', 'الإسناد', LinkIcon, 'text-amber-700')}
        {renderNavButton('rotations', 'الدورات', Calendar, 'text-blue-700')}
        {renderNavButton('logbook_review', 'مراجعة السجل', BookOpen, 'text-rose-700')}
        {renderNavButton('dops_eval', 'تقييم DOPS', Activity, 'text-purple-700')}
        {renderNavButton('tar_reports', 'تقارير TAR', FileText, 'text-teal-700')}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-indigo-600" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* ========================================================= */}
          {/* LEFT COLUMN: FORMS (نموذج الإدخال حسب القسم المختار) */}
          {/* ========================================================= */}
          <div className="lg:col-span-1 bg-white p-6 rounded-3xl shadow-sm border border-gray-100 sticky top-24">
            
            {activeSection === 'trainees' && (
              <form onSubmit={e => { e.preventDefault(); handleAdd('fellowship_trainees', newTrainee, () => setNewTrainee({ employee_id: '', trainee_code: '', enrollment_date: '' }), 'تم الإضافة'); }} className="space-y-4">
                <h3 className="font-black text-indigo-900 text-lg mb-4 flex items-center gap-2"><Plus size={20}/> إضافة متدرب</h3>
                <select required value={newTrainee.employee_id} onChange={e => setNewTrainee({...newTrainee, employee_id: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl text-sm font-bold">
                  <option value="">-- اختر الموظف --</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                </select>
                <input required type="text" value={newTrainee.trainee_code} onChange={e => setNewTrainee({...newTrainee, trainee_code: e.target.value})} placeholder="كود المتدرب (مثال: TR-01)" className="w-full p-3 bg-gray-50 border rounded-xl text-sm font-bold" />
                <input required type="date" value={newTrainee.enrollment_date} onChange={e => setNewTrainee({...newTrainee, enrollment_date: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl text-sm font-bold" />
                <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black">حفظ</button>
              </form>
            )}

            {activeSection === 'trainers' && (
              <form onSubmit={e => { e.preventDefault(); handleAdd('fellowship_trainers', newTrainer, () => setNewTrainer({ employee_id: '', trainer_code: '', title: '' }), 'تم التعيين'); }} className="space-y-4">
                <h3 className="font-black text-emerald-900 text-lg mb-4 flex items-center gap-2"><Plus size={20}/> تعيين مدرب</h3>
                <select required value={newTrainer.employee_id} onChange={e => setNewTrainer({...newTrainer, employee_id: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl text-sm font-bold">
                  <option value="">-- اختر الطبيب --</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                </select>
                <input required type="text" value={newTrainer.trainer_code} onChange={e => setNewTrainer({...newTrainer, trainer_code: e.target.value})} placeholder="كود المدرب" className="w-full p-3 bg-gray-50 border rounded-xl text-sm font-bold" />
                <input required type="text" value={newTrainer.title} onChange={e => setNewTrainer({...newTrainer, title: e.target.value})} placeholder="اللقب الأكاديمي (استشاري/مؤدب)" className="w-full p-3 bg-gray-50 border rounded-xl text-sm font-bold" />
                <button type="submit" className="w-full py-3 bg-emerald-600 text-white rounded-xl font-black">تعيين</button>
              </form>
            )}

            {activeSection === 'assignments' && (
              <form onSubmit={e => { e.preventDefault(); handleAdd('fellowship_trainer_trainee', newAssignment, () => setNewAssignment({ trainer_id: '', trainee_id: '', start_date: '' }), 'تم الربط'); }} className="space-y-4">
                <h3 className="font-black text-amber-900 text-lg mb-4 flex items-center gap-2"><LinkIcon size={20}/> إسناد التدريب</h3>
                <select required value={newAssignment.trainer_id} onChange={e => setNewAssignment({...newAssignment, trainer_id: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl text-sm font-bold">
                  <option value="">-- اختر المدرب --</option>
                  {trainers.map(t => <option key={t.id} value={t.id}>{t.employee?.name}</option>)}
                </select>
                <select required value={newAssignment.trainee_id} onChange={e => setNewAssignment({...newAssignment, trainee_id: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl text-sm font-bold">
                  <option value="">-- اختر المتدرب --</option>
                  {trainees.map(t => <option key={t.id} value={t.id}>{t.employee?.name}</option>)}
                </select>
                <input required type="date" value={newAssignment.start_date} onChange={e => setNewAssignment({...newAssignment, start_date: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl text-sm font-bold" />
                <button type="submit" className="w-full py-3 bg-amber-600 text-white rounded-xl font-black">تأكيد الإسناد</button>
              </form>
            )}

            {activeSection === 'rotations' && (
              <form onSubmit={e => { e.preventDefault(); handleAdd('fellowship_trainee_rotations', newRotation, () => setNewRotation({ trainee_id: '', rotation_type_id: '', start_date: '', end_date: '', trainer_id: '' }), 'تم جدولة الدورة'); }} className="space-y-4">
                <h3 className="font-black text-blue-900 text-lg mb-4 flex items-center gap-2"><Calendar size={20}/> جدولة دورة (Rotation)</h3>
                <select required value={newRotation.trainee_id} onChange={e => setNewRotation({...newRotation, trainee_id: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl text-sm font-bold">
                  <option value="">-- المتدرب --</option>
                  {trainees.map(t => <option key={t.id} value={t.id}>{t.employee?.name}</option>)}
                </select>
                <select required value={newRotation.rotation_type_id} onChange={e => setNewRotation({...newRotation, rotation_type_id: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl text-sm font-bold">
                  <option value="">-- نوع الدورة --</option>
                  {rotationTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.name_ar} (السنة {rt.training_year})</option>)}
                </select>
                <div className="flex gap-2">
                  <input required type="date" value={newRotation.start_date} onChange={e => setNewRotation({...newRotation, start_date: e.target.value})} className="w-1/2 p-3 bg-gray-50 border rounded-xl text-sm font-bold" title="من" />
                  <input required type="date" value={newRotation.end_date} onChange={e => setNewRotation({...newRotation, end_date: e.target.value})} className="w-1/2 p-3 bg-gray-50 border rounded-xl text-sm font-bold" title="إلى" />
                </div>
                <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-xl font-black">جدولة الدورة</button>
              </form>
            )}

            {activeSection === 'dops_eval' && (
              <form onSubmit={e => { e.preventDefault(); handleAdd('fellowship_dops_assessments', newDops, () => setNewDops({ trainee_id: '', assessor_id: '', skill_id: '', assessment_date: '', rating: 3, assessor_feedback: '' }), 'تم حفظ التقييم'); }} className="space-y-4">
                <h3 className="font-black text-purple-900 text-lg mb-4 flex items-center gap-2"><Activity size={20}/> تقييم سريري (DOPS)</h3>
                <select required value={newDops.trainee_id} onChange={e => setNewDops({...newDops, trainee_id: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl text-sm font-bold">
                  <option value="">-- تقييم المتدرب --</option>
                  {trainees.map(t => <option key={t.id} value={t.id}>{t.employee?.name}</option>)}
                </select>
                <select required value={newDops.assessor_id} onChange={e => setNewDops({...newDops, assessor_id: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl text-sm font-bold">
                  <option value="">-- المدرب المقيِّم --</option>
                  {trainers.map(t => <option key={t.id} value={t.id}>{t.employee?.name}</option>)}
                </select>
                <select required value={newDops.skill_id} onChange={e => setNewDops({...newDops, skill_id: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl text-sm font-bold">
                  <option value="">-- المهارة المراد تقييمها --</option>
                  {clinicalSkills.map(s => <option key={s.id} value={s.id}>{s.name_ar}</option>)}
                </select>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">التقييم (من 1 إلى 5)</label>
                  <input type="range" min="1" max="5" required value={newDops.rating} onChange={e => setNewDops({...newDops, rating: parseInt(e.target.value)})} className="w-full" />
                  <div className="text-center text-lg font-black text-purple-600">{newDops.rating} / 5</div>
                </div>
                <textarea value={newDops.assessor_feedback} onChange={e => setNewDops({...newDops, assessor_feedback: e.target.value})} placeholder="ملاحظات المدرب (اختياري)" className="w-full p-3 bg-gray-50 border rounded-xl text-sm font-bold h-20 resize-none"></textarea>
                <input required type="date" value={newDops.assessment_date} onChange={e => setNewDops({...newDops, assessment_date: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl text-sm font-bold" />
                <button type="submit" className="w-full py-3 bg-purple-600 text-white rounded-xl font-black">حفظ التقييم</button>
              </form>
            )}

            {activeSection === 'tar_reports' && (
              <form onSubmit={e => { e.preventDefault(); handleAdd('fellowship_tar_reports', newTar, () => setNewTar({ trainee_id: '', trainer_id: '', report_period_start: '', report_period_end: '', overall_rating: 3, trainer_comments: '' }), 'تم حفظ التقرير'); }} className="space-y-4">
                <h3 className="font-black text-teal-900 text-lg mb-4 flex items-center gap-2"><FileText size={20}/> تقرير المدرب (TAR)</h3>
                <select required value={newTar.trainee_id} onChange={e => setNewTar({...newTar, trainee_id: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl text-sm font-bold">
                  <option value="">-- المتدرب --</option>
                  {trainees.map(t => <option key={t.id} value={t.id}>{t.employee?.name}</option>)}
                </select>
                <select required value={newTar.trainer_id} onChange={e => setNewTar({...newTar, trainer_id: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl text-sm font-bold">
                  <option value="">-- المدرب (كاتب التقرير) --</option>
                  {trainers.map(t => <option key={t.id} value={t.id}>{t.employee?.name}</option>)}
                </select>
                <div className="flex gap-2">
                  <input required type="date" value={newTar.report_period_start} onChange={e => setNewTar({...newTar, report_period_start: e.target.value})} className="w-1/2 p-3 bg-gray-50 border rounded-xl text-sm font-bold" title="بداية الفترة" />
                  <input required type="date" value={newTar.report_period_end} onChange={e => setNewTar({...newTar, report_period_end: e.target.value})} className="w-1/2 p-3 bg-gray-50 border rounded-xl text-sm font-bold" title="نهاية الفترة" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">التقييم العام (من 1 إلى 4)</label>
                  <input type="range" min="1" max="4" required value={newTar.overall_rating} onChange={e => setNewTar({...newTar, overall_rating: parseInt(e.target.value)})} className="w-full" />
                  <div className="text-center text-lg font-black text-teal-600">{newTar.overall_rating} / 4</div>
                </div>
                <textarea required value={newTar.trainer_comments} onChange={e => setNewTar({...newTar, trainer_comments: e.target.value})} placeholder="التقرير المفصل ومجالات التحسين..." className="w-full p-3 bg-gray-50 border rounded-xl text-sm font-bold h-24 resize-none"></textarea>
                <button type="submit" className="w-full py-3 bg-teal-600 text-white rounded-xl font-black">اعتماد التقرير</button>
              </form>
            )}

            {activeSection === 'logbook_review' && (
              <div className="text-center py-10">
                <BookOpen className="w-16 h-16 text-rose-200 mx-auto mb-4" />
                <h3 className="font-black text-gray-800 text-lg">مراجعة سجلات المتدربين</h3>
                <p className="text-xs text-gray-500 font-bold mt-2 leading-relaxed">اختر الحالات من القائمة الجانبية لقراءتها واعتمادها مباشرة.</p>
              </div>
            )}

          </div>

          {/* ========================================================= */}
          {/* RIGHT COLUMN: LISTS & DATA (عرض البيانات) */}
          {/* ========================================================= */}
          <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-gray-100 min-h-[500px]">
            
            {activeSection === 'trainees' && (
              <div className="space-y-3">
                <h3 className="font-black text-gray-800 text-lg border-b pb-2 mb-4">قائمة المتدربين ({trainees.length})</h3>
                {trainees.map(t => (
                  <div key={t.id} className="p-4 bg-gray-50 rounded-2xl border flex justify-between items-center">
                    <div>
                      <p className="font-black text-gray-800">{t.employee?.name}</p>
                      <p className="text-xs text-gray-500 font-bold mt-1">كود: {t.trainee_code} | سنة: {t.current_year}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeSection === 'trainers' && (
              <div className="space-y-3">
                <h3 className="font-black text-gray-800 text-lg border-b pb-2 mb-4">قائمة المدربين المعتمدين ({trainers.length})</h3>
                {trainers.map(t => (
                  <div key={t.id} className="p-4 bg-gray-50 rounded-2xl border flex justify-between items-center">
                    <div>
                      <p className="font-black text-gray-800">{t.employee?.name}</p>
                      <p className="text-xs text-gray-500 font-bold mt-1">{t.title} | كود: {t.trainer_code}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeSection === 'assignments' && (
              <div className="space-y-3">
                <h3 className="font-black text-gray-800 text-lg border-b pb-2 mb-4">جدول الإسناد والإشراف</h3>
                {assignments.map(a => (
                  <div key={a.id} className="p-4 bg-gray-50 rounded-2xl border flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className="text-center"><p className="text-[10px] text-gray-400">المدرب</p><p className="font-black text-sm">{a.trainer?.employee?.name}</p></div>
                      <LinkIcon size={16} className="text-amber-400" />
                      <div className="text-center"><p className="text-[10px] text-gray-400">المتدرب</p><p className="font-black text-sm">{a.trainee?.employee?.name}</p></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 🌟 سجل الحالات بانتظار المراجعة */}
            {activeSection === 'logbook_review' && (
              <div className="space-y-4">
                <h3 className="font-black text-gray-800 text-lg border-b pb-2 mb-4 flex items-center gap-2">
                  حالات بانتظار الاعتماد <span className="bg-rose-100 text-rose-600 px-2 py-0.5 rounded text-sm">{pendingLogbooks.length}</span>
                </h3>
                {pendingLogbooks.length === 0 ? (
                  <p className="text-gray-400 font-bold text-center py-10">لا توجد حالات معلقة.</p>
                ) : pendingLogbooks.map(log => (
                  <div key={log.id} className="p-5 bg-white border border-rose-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-[10px] font-black text-rose-500 bg-rose-50 px-2 py-1 rounded inline-block mb-1">متدرب: {log.trainee?.employee?.name}</p>
                        <h4 className="font-black text-gray-800 text-sm">{log.diagnosis}</h4>
                      </div>
                      <span className="text-xs font-bold text-gray-400">{new Date(log.entry_date).toLocaleDateString('ar-EG')}</span>
                    </div>
                    <p className="text-xs text-gray-600 font-bold leading-relaxed mb-4 bg-gray-50 p-3 rounded-lg border border-gray-100">{log.description}</p>
                    <button onClick={() => handleApproveLogbook(log.id)} className="w-full bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-600 py-2 rounded-xl font-black text-xs transition-colors flex justify-center items-center gap-2">
                      <CheckCircle size={16} /> اعتماد الحالة
                    </button>
                  </div>
                ))}
              </div>
            )}

            {(activeSection === 'rotations' || activeSection === 'dops_eval' || activeSection === 'tar_reports') && (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <Calendar className="w-16 h-16 mb-4 opacity-20" />
                <h3 className="font-black text-lg">البيانات المحفوظة</h3>
                <p className="text-sm font-bold mt-2">استخدم النموذج لإضافة بيانات جديدة.</p>
              </div>
            )}

          </div>

        </div>
      )}
    </div>
  );
}
