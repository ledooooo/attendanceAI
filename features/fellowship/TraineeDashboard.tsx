import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';
import { 
  GraduationCap, Users, Stethoscope, Link as LinkIcon, 
  Calendar, Loader2, Plus, Trash2, CheckCircle,
  FileText, Activity, BookOpen, UserCog, Presentation
} from 'lucide-react';

type Section = 'trainees' | 'trainers' | 'assignments' | 'rotations' | 'logbook_review' | 'dops_eval' | 'tar_reports' | 'lectures';

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
  const [lectures, setLectures] = useState<any[]>([]);

  // --- Form States ---
  const [newTrainee, setNewTrainee] = useState({ employee_id: '', trainee_code: '', enrollment_date: '' });
  const [newTrainer, setNewTrainer] = useState({ employee_id: '', trainer_code: '', title: '' });
  const [newAssignment, setNewAssignment] = useState({ trainer_id: '', trainee_id: '', start_date: '' });
  const [newRotation, setNewRotation] = useState({ trainee_id: '', rotation_type_id: '', start_date: '', end_date: '', trainer_id: '' });
  const [newDops, setNewDops] = useState({ trainee_id: '', assessor_id: '', skill_id: '', assessment_date: '', rating: 3, assessor_feedback: '' });
  const [newTar, setNewTar] = useState({ trainee_id: '', trainer_id: '', report_period_start: '', report_period_end: '', overall_rating: 3, trainer_comments: '' });

  // --- Lecture Form States ---
  const [newLecture, setNewLecture] = useState({
    title: '', description: '', lecture_date: '', lecture_time: '', location: '', presenter_type: 'trainer', presenter_trainee_id: '', presenter_name: ''
  });
  const [quizQuestions, setQuizQuestions] = useState([{ question: '', options: ['', '', '', ''], correct_answer: '' }]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        { data: emps }, { data: trns }, { data: trnrs }, 
        { data: asgns }, { data: rts }, { data: skills }, { data: logs }, { data: lecs }
      ] = await Promise.all([
        supabase.from('employees').select('id, name, specialty, role'),
        supabase.from('fellowship_trainees').select('*, employee:employees(name, specialty)'),
        supabase.from('fellowship_trainers').select('*, employee:employees(name, specialty)'),
        supabase.from('fellowship_trainer_trainee').select('*, trainer:fellowship_trainers(employee:employees(name)), trainee:fellowship_trainees(employee:employees(name))'),
        supabase.from('fellowship_rotation_types').select('*').order('training_year', { ascending: true }),
        supabase.from('fellowship_clinical_skills').select('*'),
        supabase.from('fellowship_logbook').select('*, trainee:fellowship_trainees(employee:employees(name))').eq('trainer_reviewed', false),
        supabase.from('fellowship_lectures').select('*, presenter_trainee:fellowship_trainees(employee:employees(name))').order('lecture_date', { ascending: false })
      ]);

      setEmployees(emps || []);
      setTrainees(trns || []);
      setTrainers(trnrs || []);
      setAssignments(asgns || []);
      setRotationTypes(rts || []);
      setClinicalSkills(skills || []);
      setPendingLogbooks(logs || []);
      setLectures(lecs || []);
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

  // --- Lecture Submit ---
  const handleAddLecture = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // التحقق من صحة أسئلة الاختبار
    const validQuestions = quizQuestions.filter(q => q.question && q.correct_answer && q.options.every(opt => opt));
    
    const payload = {
        ...newLecture,
        presenter_trainee_id: newLecture.presenter_type === 'trainee' ? newLecture.presenter_trainee_id : null,
        presenter_name: newLecture.presenter_type !== 'trainee' ? newLecture.presenter_name : null,
        quiz_questions: validQuestions.length > 0 ? validQuestions : null
    };

    try {
      const { error } = await supabase.from('fellowship_lectures').insert(payload);
      if (error) throw error;
      toast.success('تم إنشاء المحاضرة بنجاح');
      
      setNewLecture({ title: '', description: '', lecture_date: '', lecture_time: '', location: '', presenter_type: 'trainer', presenter_trainee_id: '', presenter_name: '' });
      setQuizQuestions([{ question: '', options: ['', '', '', ''], correct_answer: '' }]);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'خطأ في إنشاء المحاضرة');
    }
  };

  const handleQuestionChange = (index: number, field: string, value: string, optionIndex?: number) => {
    const updatedQuestions = [...quizQuestions];
    if (field === 'options' && optionIndex !== undefined) {
      updatedQuestions[index].options[optionIndex] = value;
    } else {
      (updatedQuestions[index] as any)[field] = value;
    }
    setQuizQuestions(updatedQuestions);
  };

  const addQuestion = () => setQuizQuestions([...quizQuestions, { question: '', options: ['', '', '', ''], correct_answer: '' }]);
  const removeQuestion = (index: number) => setQuizQuestions(quizQuestions.filter((_, i) => i !== index));


  // --- UI Components ---
  const renderNavButton = (id: Section, label: string, icon: any, colorClass: string) => {
    const Icon = icon;
    const isActive = activeSection === id;
    return (
      <button 
        onClick={() => setActiveSection(id)} 
        className={`flex flex-col items-center justify-center p-3 rounded-2xl font-black text-xs transition-all min-w-[90px] text-center shrink-0 ${isActive ? `bg-white shadow-md ${colorClass}` : 'text-gray-500 hover:bg-white/50'}`}
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
      <div className="bg-gray-100 p-2 rounded-3xl flex overflow-x-auto custom-scrollbar gap-2 shadow-inner">
        {renderNavButton('trainees', 'المتدربون', Users, 'text-indigo-700')}
        {renderNavButton('trainers', 'المدربون', Stethoscope, 'text-emerald-700')}
        {renderNavButton('assignments', 'الإسناد', LinkIcon, 'text-amber-700')}
        {renderNavButton('lectures', 'المحاضرات', Presentation, 'text-orange-700')}
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
          <div className={`lg:col-span-1 bg-white p-6 rounded-3xl shadow-sm border border-gray-100 ${activeSection !== 'lectures' ? 'sticky top-24' : ''}`}>
            
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

            {/* ... (باقي النماذج السابقة لم تتغير) ... */}
            
            {/* 🌟 نموذج إضافة محاضرة واختبار */}
            {activeSection === 'lectures' && (
              <form onSubmit={handleAddLecture} className="space-y-5">
                <h3 className="font-black text-orange-900 text-lg mb-2 flex items-center gap-2"><Presentation size={20}/> إنشاء محاضرة علمية</h3>
                
                <input required type="text" value={newLecture.title} onChange={e => setNewLecture({...newLecture, title: e.target.value})} placeholder="عنوان المحاضرة / الموضوع" className="w-full p-3 bg-gray-50 border rounded-xl text-sm font-bold" />
                <textarea required value={newLecture.description} onChange={e => setNewLecture({...newLecture, description: e.target.value})} placeholder="وصف قصير ومحاور المحاضرة" className="w-full p-3 bg-gray-50 border rounded-xl text-sm font-bold resize-none h-20" />
                
                <div className="grid grid-cols-2 gap-2">
                    <input required type="date" value={newLecture.lecture_date} onChange={e => setNewLecture({...newLecture, lecture_date: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl text-sm font-bold" />
                    <input required type="time" value={newLecture.lecture_time} onChange={e => setNewLecture({...newLecture, lecture_time: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl text-sm font-bold" />
                </div>
                
                <input required type="text" value={newLecture.location} onChange={e => setNewLecture({...newLecture, location: e.target.value})} placeholder="المكان (قاعة أ، أو رابط زووم)" className="w-full p-3 bg-gray-50 border rounded-xl text-sm font-bold" />

                <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                    <label className="block text-xs font-black text-orange-800 mb-2">من سيقوم بإلقاء المحاضرة؟</label>
                    <select required value={newLecture.presenter_type} onChange={e => setNewLecture({...newLecture, presenter_type: e.target.value})} className="w-full p-3 bg-white border rounded-xl text-sm font-bold mb-2">
                        <option value="trainer">مدرب / استشاري</option>
                        <option value="trainee">متدرب (Case Presentation / Journal Club)</option>
                        <option value="external">محاضر خارجي</option>
                    </select>

                    {newLecture.presenter_type === 'trainee' ? (
                        <select required value={newLecture.presenter_trainee_id} onChange={e => setNewLecture({...newLecture, presenter_trainee_id: e.target.value})} className="w-full p-3 bg-white border rounded-xl text-sm font-bold">
                            <option value="">-- اختر المتدرب --</option>
                            {trainees.map(t => <option key={t.id} value={t.id}>{t.employee?.name}</option>)}
                        </select>
                    ) : (
                        <input required type="text" value={newLecture.presenter_name} onChange={e => setNewLecture({...newLecture, presenter_name: e.target.value})} placeholder="اسم المحاضر (د. فلان)" className="w-full p-3 bg-white border rounded-xl text-sm font-bold" />
                    )}
                </div>

                <div className="border-t pt-4">
                    <div className="flex justify-between items-center mb-3">
                        <label className="block text-xs font-black text-gray-800">أسئلة الاختبار (اختياري)</label>
                        <button type="button" onClick={addQuestion} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded font-bold hover:bg-gray-200">+ إضافة سؤال</button>
                    </div>

                    {quizQuestions.map((q, index) => (
                        <div key={index} className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-3 relative">
                            {quizQuestions.length > 1 && (
                                <button type="button" onClick={() => removeQuestion(index)} className="absolute top-2 right-2 text-red-500 bg-red-50 p-1 rounded-full"><Trash2 size={12}/></button>
                            )}
                            <input type="text" value={q.question} onChange={e => handleQuestionChange(index, 'question', e.target.value)} placeholder={`السؤال ${index + 1}`} className="w-full p-2 mb-2 bg-white border rounded text-xs font-bold" />
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                {q.options.map((opt, optIndex) => (
                                    <input key={optIndex} type="text" value={opt} onChange={e => handleQuestionChange(index, 'options', e.target.value, optIndex)} placeholder={`خيار ${optIndex + 1}`} className="w-full p-2 bg-white border rounded text-xs font-bold" />
                                ))}
                            </div>
                            <input type="text" value={q.correct_answer} onChange={e => handleQuestionChange(index, 'correct_answer', e.target.value)} placeholder="الإجابة الصحيحة (اكتب الخيار حرفياً)" className="w-full p-2 bg-white border border-emerald-200 rounded text-xs font-bold focus:border-emerald-500 outline-none" />
                        </div>
                    ))}
                </div>

                <button type="submit" className="w-full py-3 bg-orange-600 text-white rounded-xl font-black">إنشاء المحاضرة ونشرها</button>
              </form>
            )}

          </div>

          {/* ========================================================= */}
          {/* RIGHT COLUMN: LISTS & DATA (عرض البيانات) */}
          {/* ========================================================= */}
          <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-gray-100 min-h-[500px]">
            
            {/* ... (الجداول السابقة) ... */}

            {/* 🌟 قائمة المحاضرات */}
            {activeSection === 'lectures' && (
              <div className="space-y-4">
                <h3 className="font-black text-gray-800 text-lg border-b pb-2 mb-4">أجندة المحاضرات العلمية</h3>
                {lectures.length === 0 ? <p className="text-gray-400 text-sm font-bold text-center py-10">لا توجد محاضرات مجدولة</p> : lectures.map(lec => (
                  <div key={lec.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex justify-between items-start">
                    <div>
                      <h4 className="font-black text-gray-800 text-sm mb-1">{lec.title}</h4>
                      <p className="text-xs text-gray-500 font-bold mb-2">{lec.description}</p>
                      <div className="flex gap-3 text-[10px] font-bold text-orange-700 bg-orange-50 px-3 py-1 rounded-lg w-fit">
                        <span>المحاضر: {lec.presenter_type === 'trainee' ? lec.presenter_trainee?.employee?.name : lec.presenter_name}</span>
                        <span>|</span>
                        <span>أسئلة الاختبار: {lec.quiz_questions ? lec.quiz_questions.length : 0}</span>
                      </div>
                    </div>
                    <div className="text-left shrink-0 ml-2">
                        <span className="block text-xs font-black text-gray-700">{new Date(lec.lecture_date).toLocaleDateString('ar-EG')}</span>
                        <span className="block text-[10px] text-gray-400 mt-0.5">{lec.lecture_time}</span>
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

          </div>

        </div>
      )}
    </div>
  );
}
