import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import {
  GraduationCap, Users, Stethoscope, Link as LinkIcon,
  Calendar, Loader2, Plus, Trash2, CheckCircle, CheckCircle2,
  FileText, Activity, BookOpen, UserCog, Presentation,
  X, ChevronDown, Search, MessageSquare, Star, Clock,
  AlertTriangle, BarChart2, Eye, RefreshCw
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────
type Section = 'overview' | 'trainees' | 'trainers' | 'assignments' | 'rotations'
             | 'logbook_review' | 'dops_eval' | 'tar_reports' | 'lectures';

// ─── Nav config ────────────────────────────────────────────────────────────────
const ALL_NAV_ITEMS: { id: Section; label: string; icon: any; color: string; bg: string; adminOnly?: boolean }[] = [
  { id: 'overview',       label: 'نظرة عامة',    icon: BarChart2,    color: 'text-indigo-700',  bg: 'bg-indigo-50'                 },
  { id: 'trainees',       label: 'المتدربون',    icon: Users,        color: 'text-blue-700',    bg: 'bg-blue-50',   adminOnly: true },
  { id: 'trainers',       label: 'المدربون',     icon: Stethoscope,  color: 'text-emerald-700', bg: 'bg-emerald-50',adminOnly: true },
  { id: 'assignments',    label: 'الإسناد',      icon: LinkIcon,     color: 'text-amber-700',   bg: 'bg-amber-50',  adminOnly: true },
  { id: 'lectures',       label: 'المحاضرات',   icon: Presentation, color: 'text-orange-700',  bg: 'bg-orange-50'                 },
  { id: 'rotations',      label: 'الدورات',     icon: Calendar,     color: 'text-cyan-700',    bg: 'bg-cyan-50',   adminOnly: true },
  { id: 'logbook_review', label: 'اعتماد السجل', icon: BookOpen,     color: 'text-rose-700',    bg: 'bg-rose-50'                   },
  { id: 'dops_eval',      label: 'تقييم DOPS',  icon: Activity,     color: 'text-purple-700',  bg: 'bg-purple-50'                 },
  { id: 'tar_reports',    label: 'تقارير TAR',   icon: FileText,     color: 'text-teal-700',    bg: 'bg-teal-50'                   },
];

// ─── Small helpers ─────────────────────────────────────────────────────────────
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-[11px] font-black text-gray-500 mb-1.5">{label}</label>
    {children}
  </div>
);
const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...props} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all" />
);
const Select = ({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) => (
  <select {...props} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:border-indigo-400">
    {children}
  </select>
);
const Textarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...props} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:border-indigo-400 resize-none" />
);
const SaveBtn = ({ loading, label = 'حفظ', color = 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100' }: { loading?: boolean; label?: string; color?: string }) => (
  <button type="submit" disabled={loading}
    className={`w-full py-3 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.99] shadow-lg disabled:opacity-50 ${color}`}>
    {loading ? <Loader2 size={16} className="animate-spin" /> : <><CheckCircle2 size={16} /> {label}</>}
  </button>
);

// ─── Stat card for overview ────────────────────────────────────────────────────
const StatCard = ({ label, value, icon: Icon, color, bg, sub }: any) => (
  <div className={`${bg} rounded-2xl p-4 border border-gray-100 flex items-center gap-3 hover:-translate-y-0.5 transition-transform`}>
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color} bg-white shadow-sm flex-shrink-0`}>
      <Icon size={20} />
    </div>
    <div>
      <p className="text-2xl font-black text-gray-800 leading-none">{value}</p>
      <p className="text-[11px] font-bold text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] font-semibold text-gray-400">{sub}</p>}
    </div>
  </div>
);

// ══════════════════════════════════════════════════════════════════════════════
interface AdminFellowshipTabProps {
  trainerMode?: boolean;        // true = لوحة المدرب
  trainerEmployeeId?: string;   // employee.id للمدرب الحالي
}

export default function AdminFellowshipTab({
  trainerMode = false,
  trainerEmployeeId,
}: AdminFellowshipTabProps) {
  const [activeSection, setActiveSection] = useState<Section>('overview');
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [reviewId, setReviewId]     = useState<string | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [myTrainerId, setMyTrainerId] = useState<string | null>(null); // fellowship_trainers.id

  // ── Nav items filtered by mode ─────────────────────────────────────────
  const NAV_ITEMS = ALL_NAV_ITEMS.filter(n => !trainerMode || !n.adminOnly);

  // ── Data ──────────────────────────────────────────────────────────────────
  const [employees, setEmployees]         = useState<any[]>([]);
  const [trainees, setTrainees]           = useState<any[]>([]);
  const [trainers, setTrainers]           = useState<any[]>([]);
  const [assignments, setAssignments]     = useState<any[]>([]);
  const [rotationTypes, setRotationTypes] = useState<any[]>([]);
  const [clinicalSkills, setClinicalSkills] = useState<any[]>([]);
  const [pendingLogbooks, setPendingLogbooks] = useState<any[]>([]);
  const [lectures, setLectures]           = useState<any[]>([]);
  const [tarList, setTarList]             = useState<any[]>([]);
  const [logSearch, setLogSearch]         = useState('');

  // ── Question Bank states ───────────────────────────────────────────────────
  const [bankQuestions, setBankQuestions]     = useState<any[]>([]);
  const [bankSearch, setBankSearch]           = useState('');
  const [bankSubject, setBankSubject]         = useState('');
  const [selectedQIds, setSelectedQIds]       = useState<Set<string>>(new Set());
  const [quizMode, setQuizMode]               = useState<'manual' | 'bank'>('manual');

  // ── Forms ─────────────────────────────────────────────────────────────────
  const [newTrainee,    setNewTrainee]    = useState({ employee_id: '', trainee_code: '', enrollment_date: '', expected_graduation: '' });
  const [newTrainer,    setNewTrainer]    = useState({ employee_id: '', trainer_code: '', title: '', is_scientific_supervisor: false });
  const [newAssignment, setNewAssignment] = useState({ trainer_id: '', trainee_id: '', start_date: '', is_primary: true });
  const [newRotation,   setNewRotation]   = useState({ trainee_id: '', rotation_type_id: '', start_date: '', end_date: '', trainer_id: '', status: 'scheduled' });
  const [newDops, setNewDops] = useState({ trainee_id: '', assessor_id: '', skill_id: '', assessment_date: new Date().toISOString().split('T')[0], rating: 3, assessor_feedback: '', strengths: '', areas_for_development: '' });
  const [newTar,  setNewTar]  = useState({ trainee_id: '', trainer_id: '', report_period_start: '', report_period_end: '', overall_rating: 3, trainer_comments: '' });
  const [newLecture, setNewLecture] = useState({ title: '', description: '', lecture_date: '', lecture_time: '', location: '', presenter_type: 'trainer', presenter_trainee_id: '', presenter_name: '' });
  const [quizQuestions, setQuizQuestions] = useState([{ question: '', options: ['', '', '', ''], correct_answer: '' }]);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = async () => {
    setLoading(true);
    try {
      // في trainerMode: أول حاجة نجيب fellowship_trainers.id للمدرب الحالي
      let trainerId: string | null = myTrainerId;
      if (trainerMode && trainerEmployeeId && !trainerId) {
        const { data: trainerRow } = await supabase
          .from('fellowship_trainers')
          .select('id')
          .eq('employee_id', trainerEmployeeId)
          .single();
        trainerId = trainerRow?.id || null;
        setMyTrainerId(trainerId);
        // في trainerMode أنت بتقيّم بنفسك — سبق الـ DOPS form يتملأ تلقائياً
        setNewDops(prev => ({ ...prev, assessor_id: trainerId || '' }));
        setNewTar(prev => ({ ...prev, trainer_id: trainerId || '' }));
      }

      // جيب IDs المتدربين المسندين للمدرب ده فقط (في trainerMode)
      let assignedTraineeIds: string[] = [];
      if (trainerMode && trainerId) {
        const { data: asgn } = await supabase
          .from('fellowship_trainer_trainee')
          .select('trainee_id')
          .eq('trainer_id', trainerId);
        assignedTraineeIds = (asgn || []).map(a => a.trainee_id);
      }

      // Logbook query — في trainerMode: بس المتدربين المسندين
      let logbookQuery = supabase
        .from('fellowship_logbook')
        .select('*, trainee:fellowship_trainees(employee:employees(name))')
        .eq('trainer_reviewed', false)
        .order('created_at', { ascending: false });
      if (trainerMode && assignedTraineeIds.length > 0) {
        logbookQuery = logbookQuery.in('trainee_id', assignedTraineeIds);
      } else if (trainerMode && assignedTraineeIds.length === 0) {
        // مفيش متدربين مسندين — نرجع فاضي
        setLoading(false);
        return;
      }

      // TAR query — في trainerMode: بس التقارير اللي المدرب ده كتبها
      let tarQuery = supabase
        .from('fellowship_tar_reports')
        .select('*, trainer:fellowship_trainers(employee:employees(name)), trainee:fellowship_trainees(employee:employees(name))')
        .order('created_at', { ascending: false });
      if (trainerMode && trainerId) {
        tarQuery = tarQuery.eq('trainer_id', trainerId);
      }

      const [
        { data: emps }, { data: trns }, { data: trnrs },
        { data: asgns }, { data: rts }, { data: skills },
        { data: logs }, { data: lecs }, { data: tars },
      ] = await Promise.all([
        supabase.from('employees').select('id, name, specialty, role').order('name'),
        trainerMode && assignedTraineeIds.length > 0
          ? supabase.from('fellowship_trainees').select('*, employee:employees(name, specialty, photo_url)').in('id', assignedTraineeIds)
          : supabase.from('fellowship_trainees').select('*, employee:employees(name, specialty, photo_url)').order('created_at', { ascending: false }),
        supabase.from('fellowship_trainers').select('*, employee:employees(name, specialty)').order('created_at', { ascending: false }),
        supabase.from('fellowship_trainer_trainee').select('*, trainer:fellowship_trainers(employee:employees(name)), trainee:fellowship_trainees(employee:employees(name))'),
        supabase.from('fellowship_rotation_types').select('*').order('training_year').order('sort_order'),
        supabase.from('fellowship_clinical_skills').select('*').order('skill_number'),
        logbookQuery,
        supabase.from('fellowship_lectures').select('*, presenter_trainee:fellowship_trainees(employee:employees(name))').order('lecture_date', { ascending: false }),
        tarQuery,
      ]);
      setEmployees(emps || []);  setTrainees(trns || []);  setTrainers(trnrs || []);
      setAssignments(asgns || []); setRotationTypes(rts || []); setClinicalSkills(skills || []);
      setPendingLogbooks(logs || []); setLectures(lecs || []); setTarList(tars || []);
    } catch { toast.error('حدث خطأ أثناء جلب البيانات'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  // ── Fetch question bank ────────────────────────────────────────────────────
  const fetchBankQuestions = async (subject?: string, search?: string) => {
    let query = supabase.from('fellowship_questions').select('id, subject, topic, difficulty, stem, option_a, option_b, option_c, option_d, option_e, correct_answer, explanation').order('subject').order('topic');
    if (subject) query = query.eq('subject', subject);
    if (search)  query = query.ilike('stem', `%${search}%`);
    const { data } = await query.limit(60);
    setBankQuestions(data || []);
  };

  useEffect(() => { if (quizMode === 'bank') fetchBankQuestions(bankSubject, bankSearch); }, [quizMode, bankSubject, bankSearch]);

  // ── Generic add ───────────────────────────────────────────────────────────
  const handleAdd = async (table: string, data: any, reset: () => void, msg: string) => {
    setSaving(true);
    try {
      const { error } = await supabase.from(table).insert([data]);
      if (error) throw error;
      toast.success(msg); reset(); fetchData();
    } catch (e: any) { toast.error(e.message || 'حدث خطأ'); }
    finally { setSaving(false); }
  };

  // ── Approve logbook with optional comment ─────────────────────────────────
  const handleApproveLogbook = async (id: string) => {
    setSaving(true);
    try {
      const { error } = await supabase.from('fellowship_logbook').update({
        trainer_reviewed: true,
        trainer_review_date: new Date().toISOString(),
        ...(reviewComment ? { trainer_comments: reviewComment } : {}),
      }).eq('id', id);
      if (error) throw error;
      toast.success('✅ تم اعتماد الحالة');
      setReviewId(null); setReviewComment(''); fetchData();
    } catch { toast.error('خطأ في الاعتماد'); }
    finally { setSaving(false); }
  };

  // ── Lecture submit ─────────────────────────────────────────────────────────
  const handleAddLecture = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);

    // في manual mode: استخدم الأسئلة اليدوية
    // في bank mode: اجلب الأسئلة المختارة من البنك وحوّلها لنفس format
    let finalQuestions: any[] = [];

    if (quizMode === 'manual') {
      finalQuestions = quizQuestions.filter(q => q.question && q.correct_answer && q.options.every(o => o));
    } else {
      // اجلب الأسئلة المختارة من البنك
      const chosen = bankQuestions.filter(q => selectedQIds.has(q.id));
      finalQuestions = chosen.map(q => ({
        question:       q.stem,
        options:        [q.option_a, q.option_b, q.option_c, q.option_d, ...(q.option_e ? [q.option_e] : [])],
        correct_answer: q.correct_answer === 'A' ? q.option_a :
                        q.correct_answer === 'B' ? q.option_b :
                        q.correct_answer === 'C' ? q.option_c :
                        q.correct_answer === 'D' ? q.option_d : q.option_e,
        explanation:    q.explanation,
        bank_question_id: q.id,  // مرجع للسؤال الأصلي
      }));
    }

    const payload = {
      ...newLecture,
      presenter_trainee_id: newLecture.presenter_type === 'trainee' ? newLecture.presenter_trainee_id : null,
      presenter_name: newLecture.presenter_type !== 'trainee' ? newLecture.presenter_name : null,
      quiz_questions: finalQuestions.length > 0 ? finalQuestions : null,
    };
    try {
      const { error } = await supabase.from('fellowship_lectures').insert(payload);
      if (error) throw error;
      toast.success('✅ تم نشر المحاضرة');
      setNewLecture({ title: '', description: '', lecture_date: '', lecture_time: '', location: '', presenter_type: 'trainer', presenter_trainee_id: '', presenter_name: '' });
      setQuizQuestions([{ question: '', options: ['', '', '', ''], correct_answer: '' }]);
      setSelectedQIds(new Set());
      setQuizMode('manual');
      fetchData();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleQChange = (i: number, field: string, val: string, oi?: number) => {
    const q = [...quizQuestions];
    if (field === 'options' && oi !== undefined) q[i].options[oi] = val;
    else (q[i] as any)[field] = val;
    setQuizQuestions(q);
  };

  // ── Filtered logbooks ──────────────────────────────────────────────────────
  const filteredLogs = useMemo(() =>
    pendingLogbooks.filter(l =>
      !logSearch ||
      l.trainee?.employee?.name?.includes(logSearch) ||
      l.diagnosis?.includes(logSearch)
    ), [pendingLogbooks, logSearch]);

  // ── Overview stats ─────────────────────────────────────────────────────────
  const activeTrainees  = trainees.filter(t => t.status === 'active').length;
  const pendingCount    = pendingLogbooks.length;
  const unsignedTar     = tarList.filter(t => !t.trainee_acknowledged).length;

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5 animate-in fade-in duration-300" dir="rtl">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className={`relative rounded-3xl p-6 md:p-8 text-white overflow-hidden ${
        trainerMode
          ? 'bg-gradient-to-br from-emerald-700 via-teal-700 to-cyan-800'
          : 'bg-gradient-to-br from-indigo-700 via-indigo-800 to-violet-900'
      }`}>
        <div className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: 'radial-gradient(circle, white 1.5px, transparent 1.5px)', backgroundSize: '24px 24px' }} />
        <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-white/5 rounded-full" />
        <div className="relative flex items-center gap-5">
          <div className="w-16 h-16 bg-white/15 rounded-2xl flex items-center justify-center border border-white/20 flex-shrink-0">
            {trainerMode ? <Stethoscope size={34} className="text-white" /> : <GraduationCap size={34} className="text-white" />}
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight">
              {trainerMode ? 'لوحة المدرب — زمالة طب الأسرة' : 'إدارة الزمالة المصرية لطب الأسرة'}
            </h1>
            <p className={`font-bold text-xs mt-1 ${trainerMode ? 'text-emerald-200' : 'text-indigo-200'}`}>
              {trainerMode
                ? `متدربوك: ${trainees.length} · يمكنك اعتماد السجلات وإضافة التقييمات`
                : 'لوحة التحكم الشاملة للتدريب والتقييم (WPBA)'}
            </p>
          </div>
          <div className="mr-auto hidden md:flex items-center gap-3">
            {pendingCount > 0 && (
              <button onClick={() => setActiveSection('logbook_review')}
                className="flex items-center gap-2 bg-rose-500/90 hover:bg-rose-500 text-white px-4 py-2 rounded-xl text-xs font-black transition-colors border border-rose-400/30">
                <BookOpen size={14} /> {pendingCount} حالة انتظار
              </button>
            )}
            {unsignedTar > 0 && (
              <button onClick={() => setActiveSection('tar_reports')}
                className="flex items-center gap-2 bg-amber-500/90 hover:bg-amber-500 text-white px-4 py-2 rounded-xl text-xs font-black transition-colors border border-amber-400/30">
                <FileText size={14} /> {unsignedTar} TAR غير موقّع
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Navigation ────────────────────────────────────────────────────── */}
      <div className="bg-gray-100/80 p-1.5 rounded-2xl flex overflow-x-auto gap-1 custom-scrollbar">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const active = activeSection === item.id;
          return (
            <button key={item.id} onClick={() => setActiveSection(item.id)}
              className={`flex flex-col items-center justify-center px-4 py-2.5 rounded-xl font-black text-[11px] transition-all shrink-0 gap-1 min-w-[80px] ${
                active ? `bg-white shadow-md ${item.color}` : 'text-gray-500 hover:bg-white/60'
              }`}>
              <Icon size={18} />
              {item.label}
              {item.id === 'logbook_review' && pendingCount > 0 && (
                <span className="text-[9px] bg-rose-500 text-white px-1.5 rounded-full font-black -mt-0.5">{pendingCount}</span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-28 gap-3">
          <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center">
            <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
          </div>
          <p className="text-sm font-bold text-gray-400">جاري تحميل البيانات...</p>
        </div>
      ) : (

        /* ── OVERVIEW ─────────────────────────────────────────────────────── */
        activeSection === 'overview' ? (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label={trainerMode ? 'متدربوك' : 'متدربون نشطون'} value={trainerMode ? trainees.length : activeTrainees} icon={Users}        color="text-blue-600"    bg="bg-blue-50"    />
              <StatCard label="مدربون مسجلون"   value={trainers.length}   icon={Stethoscope} color="text-emerald-600" bg="bg-emerald-50" />
              <StatCard label="حالات انتظار"    value={pendingCount}      icon={BookOpen}    color="text-rose-600"    bg="bg-rose-50"    sub="بانتظار الاعتماد" />
              <StatCard label="محاضرات مجدولة" value={lectures.length}   icon={Presentation}color="text-orange-600"  bg="bg-orange-50"  />
            </div>

            {/* Trainees progress table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-black text-gray-700 flex items-center gap-2"><Users size={16} className="text-indigo-500"/> حالة المتدربين</h3>
                <button onClick={() => setActiveSection('trainees')} className="text-xs font-black text-indigo-600 hover:underline">عرض الكل</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 font-black">
                      <td className="px-4 py-2.5">المتدرب</td>
                      <td className="px-4 py-2.5 text-center">الكود</td>
                      <td className="px-4 py-2.5 text-center">السنة</td>
                      <td className="px-4 py-2.5 text-center">الحالة</td>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {trainees.slice(0,6).map(t => (
                      <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 font-black text-gray-800">{t.employee?.name}</td>
                        <td className="px-4 py-3 text-center text-gray-500 font-bold">{t.trainee_code}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="bg-indigo-50 text-indigo-700 font-black px-2 py-0.5 rounded-full">{t.current_year}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-black px-2 py-0.5 rounded-full text-[10px] ${t.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                            {t.status === 'active' ? 'نشط' : t.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pending logbooks quick view */}
            {pendingCount > 0 && (
              <div className="bg-rose-50 rounded-2xl border border-rose-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-black text-rose-800 flex items-center gap-2"><AlertTriangle size={15}/> حالات تنتظر اعتمادك ({pendingCount})</h3>
                  <button onClick={() => setActiveSection('logbook_review')} className="text-xs font-black text-rose-600 hover:underline">مراجعة الكل</button>
                </div>
                <div className="space-y-2">
                  {pendingLogbooks.slice(0,3).map(l => (
                    <div key={l.id} className="bg-white rounded-xl px-4 py-2.5 flex items-center justify-between border border-rose-100">
                      <div>
                        <p className="text-xs font-black text-gray-800">{l.diagnosis || 'بدون تشخيص'}</p>
                        <p className="text-[10px] font-bold text-gray-400">{l.trainee?.employee?.name}</p>
                      </div>
                      <button onClick={() => handleApproveLogbook(l.id)}
                        className="text-[10px] font-black bg-emerald-500 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-600 transition-colors flex items-center gap-1">
                        <CheckCircle2 size={11}/> اعتماد
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        ) : (
          /* ── SECTIONS ───────────────────────────────────────────────────── */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

            {/* ── LEFT: Form ──────────────────────────────────────────────── */}
            <div className={`lg:col-span-1 bg-white p-5 rounded-3xl shadow-sm border border-gray-100 ${activeSection !== 'lectures' ? 'lg:sticky lg:top-24' : ''}`}>

              {/* TRAINEES form — admin only */}
              {activeSection === 'trainees' && !trainerMode && (
                <form onSubmit={e => { e.preventDefault(); handleAdd('fellowship_trainees', { ...newTrainee, current_year: 1 }, () => setNewTrainee({ employee_id: '', trainee_code: '', enrollment_date: '', expected_graduation: '' }), '✅ تم إضافة المتدرب'); }} className="space-y-4">
                  <SectionHeader icon={Users} title="إضافة متدرب جديد" color="text-blue-600" bg="bg-blue-50" />
                  <Field label="الموظف">
                    <Select required value={newTrainee.employee_id} onChange={e => setNewTrainee({...newTrainee, employee_id: e.target.value})}>
                      <option value="">-- اختر الموظف --</option>
                      {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name} — {emp.specialty}</option>)}
                    </Select>
                  </Field>
                  <Field label="كود المتدرب"><Input required placeholder="مثال: TR-001" value={newTrainee.trainee_code} onChange={e => setNewTrainee({...newTrainee, trainee_code: e.target.value})} /></Field>
                  <Field label="تاريخ الالتحاق"><Input required type="date" value={newTrainee.enrollment_date} onChange={e => setNewTrainee({...newTrainee, enrollment_date: e.target.value})} /></Field>
                  <Field label="تاريخ التخرج المتوقع"><Input type="date" value={newTrainee.expected_graduation} onChange={e => setNewTrainee({...newTrainee, expected_graduation: e.target.value})} /></Field>
                  <SaveBtn loading={saving} label="إضافة متدرب" color="bg-blue-600 hover:bg-blue-700 shadow-blue-100" />
                </form>
              )}

              {/* TRAINERS form — admin only */}
              {activeSection === 'trainers' && !trainerMode && (
                <form onSubmit={e => { e.preventDefault(); handleAdd('fellowship_trainers', newTrainer, () => setNewTrainer({ employee_id: '', trainer_code: '', title: '', is_scientific_supervisor: false }), '✅ تم إضافة المدرب'); }} className="space-y-4">
                  <SectionHeader icon={Stethoscope} title="إضافة مدرب جديد" color="text-emerald-600" bg="bg-emerald-50" />
                  <Field label="الموظف">
                    <Select required value={newTrainer.employee_id} onChange={e => setNewTrainer({...newTrainer, employee_id: e.target.value})}>
                      <option value="">-- اختر الموظف --</option>
                      {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                    </Select>
                  </Field>
                  <Field label="كود المدرب"><Input required placeholder="مثال: SP-001" value={newTrainer.trainer_code} onChange={e => setNewTrainer({...newTrainer, trainer_code: e.target.value})} /></Field>
                  <Field label="اللقب العلمي">
                    <Select value={newTrainer.title} onChange={e => setNewTrainer({...newTrainer, title: e.target.value})}>
                      <option value="">-- اختياري --</option>
                      <option value="أستاذ">أستاذ</option>
                      <option value="أستاذ مشارك">أستاذ مشارك</option>
                      <option value="استشاري">استشاري</option>
                      <option value="أخصائي">أخصائي</option>
                    </Select>
                  </Field>
                  <label className="flex items-center gap-3 cursor-pointer bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <input type="checkbox" checked={newTrainer.is_scientific_supervisor} onChange={e => setNewTrainer({...newTrainer, is_scientific_supervisor: e.target.checked})} className="w-4 h-4 accent-emerald-600" />
                    <span className="text-xs font-black text-gray-700">مشرف علمي</span>
                  </label>
                  <SaveBtn loading={saving} label="إضافة مدرب" color="bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100" />
                </form>
              )}

              {/* ASSIGNMENTS form — admin only */}
              {activeSection === 'assignments' && !trainerMode && (
                <form onSubmit={e => { e.preventDefault(); handleAdd('fellowship_trainer_trainee', newAssignment, () => setNewAssignment({ trainer_id: '', trainee_id: '', start_date: '', is_primary: true }), '✅ تم الإسناد'); }} className="space-y-4">
                  <SectionHeader icon={LinkIcon} title="إسناد مدرب لمتدرب" color="text-amber-600" bg="bg-amber-50" />
                  <Field label="المدرب">
                    <Select required value={newAssignment.trainer_id} onChange={e => setNewAssignment({...newAssignment, trainer_id: e.target.value})}>
                      <option value="">-- اختر المدرب --</option>
                      {trainers.map(t => <option key={t.id} value={t.id}>{t.employee?.name}</option>)}
                    </Select>
                  </Field>
                  <Field label="المتدرب">
                    <Select required value={newAssignment.trainee_id} onChange={e => setNewAssignment({...newAssignment, trainee_id: e.target.value})}>
                      <option value="">-- اختر المتدرب --</option>
                      {trainees.map(t => <option key={t.id} value={t.id}>{t.employee?.name}</option>)}
                    </Select>
                  </Field>
                  <Field label="تاريخ البدء"><Input required type="date" value={newAssignment.start_date} onChange={e => setNewAssignment({...newAssignment, start_date: e.target.value})} /></Field>
                  <label className="flex items-center gap-3 cursor-pointer bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <input type="checkbox" checked={newAssignment.is_primary} onChange={e => setNewAssignment({...newAssignment, is_primary: e.target.checked})} className="w-4 h-4 accent-amber-600" />
                    <span className="text-xs font-black text-gray-700">مشرف رئيسي</span>
                  </label>
                  <SaveBtn loading={saving} label="حفظ الإسناد" color="bg-amber-600 hover:bg-amber-700 shadow-amber-100" />
                </form>
              )}

              {/* ROTATIONS form — admin only */}
              {activeSection === 'rotations' && !trainerMode && (
                <form onSubmit={e => { e.preventDefault(); handleAdd('fellowship_trainee_rotations', { trainee_id: newRotation.trainee_id, rotation_type_id: newRotation.rotation_type_id, start_date: newRotation.start_date, end_date: newRotation.end_date, trainer_id: newRotation.trainer_id || null, status: newRotation.status }, () => setNewRotation({ trainee_id: '', rotation_type_id: '', start_date: '', end_date: '', trainer_id: '', status: 'scheduled' }), '✅ تم جدولة الدورة'); }} className="space-y-4">
                  <SectionHeader icon={Calendar} title="جدولة دورة تدريبية" color="text-cyan-600" bg="bg-cyan-50" />
                  <Field label="المتدرب">
                    <Select required value={newRotation.trainee_id} onChange={e => setNewRotation({...newRotation, trainee_id: e.target.value})}>
                      <option value="">-- اختر --</option>
                      {trainees.map(t => <option key={t.id} value={t.id}>{t.employee?.name}</option>)}
                    </Select>
                  </Field>
                  <Field label="نوع الدورة">
                    <Select required value={newRotation.rotation_type_id} onChange={e => setNewRotation({...newRotation, rotation_type_id: e.target.value})}>
                      <option value="">-- اختر --</option>
                      {[1,2,3].map(yr => (
                        <optgroup key={yr} label={`السنة ${yr}`}>
                          {rotationTypes.filter(r => r.training_year === yr).map(r => (
                            <option key={r.id} value={r.id}>{r.name_ar} ({r.duration_months} أشهر)</option>
                          ))}
                        </optgroup>
                      ))}
                    </Select>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="تاريخ البدء"><Input required type="date" value={newRotation.start_date} onChange={e => setNewRotation({...newRotation, start_date: e.target.value})} /></Field>
                    <Field label="تاريخ الانتهاء"><Input required type="date" value={newRotation.end_date} onChange={e => setNewRotation({...newRotation, end_date: e.target.value})} /></Field>
                  </div>
                  <Field label="المشرف (اختياري)">
                    <Select value={newRotation.trainer_id} onChange={e => setNewRotation({...newRotation, trainer_id: e.target.value})}>
                      <option value="">-- لا يوجد --</option>
                      {trainers.map(t => <option key={t.id} value={t.id}>{t.employee?.name}</option>)}
                    </Select>
                  </Field>
                  <Field label="الحالة">
                    <Select value={newRotation.status} onChange={e => setNewRotation({...newRotation, status: e.target.value})}>
                      <option value="scheduled">مجدولة</option>
                      <option value="ongoing">جارية</option>
                      <option value="completed">مكتملة</option>
                    </Select>
                  </Field>
                  <SaveBtn loading={saving} label="جدولة الدورة" color="bg-cyan-600 hover:bg-cyan-700 shadow-cyan-100" />
                </form>
              )}

              {/* DOPS form */}
              {activeSection === 'dops_eval' && (
                <form onSubmit={e => { e.preventDefault(); handleAdd('fellowship_dops_assessments', { trainee_id: newDops.trainee_id, assessor_id: newDops.assessor_id, skill_id: newDops.skill_id, assessment_date: newDops.assessment_date, rating: Number(newDops.rating), assessor_feedback: newDops.assessor_feedback, strengths: newDops.strengths, areas_for_development: newDops.areas_for_development }, () => setNewDops({ trainee_id: '', assessor_id: myTrainerId || '', skill_id: '', assessment_date: new Date().toISOString().split('T')[0], rating: 3, assessor_feedback: '', strengths: '', areas_for_development: '' }), '✅ تم حفظ تقييم DOPS'); }} className="space-y-4">
                  <SectionHeader icon={Activity} title="تقييم DOPS جديد" color="text-purple-600" bg="bg-purple-50" />
                  <Field label="المتدرب">
                    <Select required value={newDops.trainee_id} onChange={e => setNewDops({...newDops, trainee_id: e.target.value})}>
                      <option value="">-- اختر --</option>
                      {trainees.map(t => <option key={t.id} value={t.id}>{t.employee?.name}</option>)}
                    </Select>
                  </Field>
                  {/* في trainerMode المدرب هو المقيّم تلقائياً — نخفي الـ select */}
                  {!trainerMode && (
                    <Field label="المقيِّم">
                      <Select required value={newDops.assessor_id} onChange={e => setNewDops({...newDops, assessor_id: e.target.value})}>
                        <option value="">-- اختر المدرب --</option>
                        {trainers.map(t => <option key={t.id} value={t.id}>{t.employee?.name}</option>)}
                      </Select>
                    </Field>
                  )}
                  {trainerMode && (
                    <div className="flex items-center gap-2 bg-emerald-50 rounded-xl px-3 py-2 border border-emerald-100">
                      <Stethoscope size={14} className="text-emerald-600"/>
                      <p className="text-xs font-black text-emerald-700">أنت المقيِّم لهذا التقييم</p>
                    </div>
                  )}
                  <Field label="المهارة">
                    <Select required value={newDops.skill_id} onChange={e => setNewDops({...newDops, skill_id: e.target.value})}>
                      <option value="">-- اختر المهارة --</option>
                      {clinicalSkills.map(s => <option key={s.id} value={s.id}>{s.skill_number}. {s.name_ar}</option>)}
                    </Select>
                  </Field>
                  <Field label="تاريخ التقييم"><Input required type="date" value={newDops.assessment_date} onChange={e => setNewDops({...newDops, assessment_date: e.target.value})} /></Field>
                  <Field label={`التقييم: ${['','يحتاج تدريباً','دون المتوقع','المستوى المطلوب','فوق المتوقع','خبير'][newDops.rating]}`}>
                    <div className="flex gap-1">
                      {[1,2,3,4,5].map(r => (
                        <button key={r} type="button" onClick={() => setNewDops({...newDops, rating: r})}
                          className="flex-1 py-2.5 rounded-xl text-sm font-black transition-all">
                          <Star size={16} className={`mx-auto ${r <= newDops.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="نقاط القوة"><Textarea rows={2} placeholder="ما أجاده المتدرب..." value={newDops.strengths} onChange={e => setNewDops({...newDops, strengths: e.target.value})} /></Field>
                  <Field label="مجالات التطوير"><Textarea rows={2} placeholder="ما يحتاج تحسيناً..." value={newDops.areas_for_development} onChange={e => setNewDops({...newDops, areas_for_development: e.target.value})} /></Field>
                  <Field label="ملاحظات عامة"><Textarea rows={2} value={newDops.assessor_feedback} onChange={e => setNewDops({...newDops, assessor_feedback: e.target.value})} /></Field>
                  <SaveBtn loading={saving} label="حفظ تقييم DOPS" color="bg-purple-600 hover:bg-purple-700 shadow-purple-100" />
                </form>
              )}

              {/* TAR form */}
              {activeSection === 'tar_reports' && (
                <form onSubmit={e => { e.preventDefault(); handleAdd('fellowship_tar_reports', { ...newTar, overall_rating: Number(newTar.overall_rating) }, () => setNewTar({ trainee_id: '', trainer_id: myTrainerId || '', report_period_start: '', report_period_end: '', overall_rating: 3, trainer_comments: '' }), '✅ تم حفظ تقرير TAR'); }} className="space-y-4">
                  <SectionHeader icon={FileText} title="تقرير TAR جديد" color="text-teal-600" bg="bg-teal-50" />
                  <Field label="المتدرب">
                    <Select required value={newTar.trainee_id} onChange={e => setNewTar({...newTar, trainee_id: e.target.value})}>
                      <option value="">-- اختر --</option>
                      {trainees.map(t => <option key={t.id} value={t.id}>{t.employee?.name}</option>)}
                    </Select>
                  </Field>
                  {/* في trainerMode المدرب هو الكاتب تلقائياً */}
                  {!trainerMode && (
                    <Field label="المدرب">
                      <Select required value={newTar.trainer_id} onChange={e => setNewTar({...newTar, trainer_id: e.target.value})}>
                        <option value="">-- اختر --</option>
                        {trainers.map(t => <option key={t.id} value={t.id}>{t.employee?.name}</option>)}
                      </Select>
                    </Field>
                  )}
                  {trainerMode && (
                    <div className="flex items-center gap-2 bg-teal-50 rounded-xl px-3 py-2 border border-teal-100">
                      <Stethoscope size={14} className="text-teal-600"/>
                      <p className="text-xs font-black text-teal-700">أنت كاتب هذا التقرير</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="من"><Input required type="date" value={newTar.report_period_start} onChange={e => setNewTar({...newTar, report_period_start: e.target.value})} /></Field>
                    <Field label="إلى"><Input required type="date" value={newTar.report_period_end} onChange={e => setNewTar({...newTar, report_period_end: e.target.value})} /></Field>
                  </div>
                  <Field label="التقييم الكلي">
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { v: 1, label: 'دون المتوقع', cl: 'rose' },
                        { v: 2, label: 'يلبي التوقعات', cl: 'amber' },
                        { v: 3, label: 'فوق المتوقع', cl: 'blue' },
                        { v: 4, label: 'متميز', cl: 'emerald' },
                      ].map(o => (
                        <button key={o.v} type="button" onClick={() => setNewTar({...newTar, overall_rating: o.v})}
                          className={`py-2 rounded-xl text-[10px] font-black transition-all border ${Number(newTar.overall_rating) === o.v ? `bg-${o.cl}-500 text-white border-${o.cl}-500` : 'bg-gray-50 text-gray-600 border-gray-100 hover:border-gray-200'}`}>
                          {o.v}<br/>{o.label}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="تعليقات المدرب"><Textarea rows={3} required value={newTar.trainer_comments} onChange={e => setNewTar({...newTar, trainer_comments: e.target.value})} /></Field>
                  <SaveBtn loading={saving} label="حفظ تقرير TAR" color="bg-teal-600 hover:bg-teal-700 shadow-teal-100" />
                </form>
              )}

              {/* LECTURES form */}
              {activeSection === 'lectures' && (
                <form onSubmit={handleAddLecture} className="space-y-4">
                  <SectionHeader icon={Presentation} title="إنشاء محاضرة علمية" color="text-orange-600" bg="bg-orange-50" />
                  <Field label="عنوان المحاضرة"><Input required value={newLecture.title} onChange={e => setNewLecture({...newLecture, title: e.target.value})} placeholder="مثال: إدارة ارتفاع ضغط الدم" /></Field>
                  <Field label="وصف المحاور"><Textarea rows={2} value={newLecture.description} onChange={e => setNewLecture({...newLecture, description: e.target.value})} placeholder="محاور المحاضرة..." /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="التاريخ"><Input required type="date" value={newLecture.lecture_date} onChange={e => setNewLecture({...newLecture, lecture_date: e.target.value})} /></Field>
                    <Field label="الوقت"><Input required type="time" value={newLecture.lecture_time} onChange={e => setNewLecture({...newLecture, lecture_time: e.target.value})} /></Field>
                  </div>
                  <Field label="المكان / الرابط"><Input required value={newLecture.location} onChange={e => setNewLecture({...newLecture, location: e.target.value})} placeholder="قاعة أ أو رابط Zoom" /></Field>
                  <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 space-y-3">
                    <Field label="المحاضر">
                      <Select required value={newLecture.presenter_type} onChange={e => setNewLecture({...newLecture, presenter_type: e.target.value})}>
                        <option value="trainer">مدرب / استشاري</option>
                        <option value="trainee">متدرب (Case / Journal Club)</option>
                        <option value="external">محاضر خارجي</option>
                      </Select>
                    </Field>
                    {newLecture.presenter_type === 'trainee' ? (
                      <Field label="اختر المتدرب">
                        <Select required value={newLecture.presenter_trainee_id} onChange={e => setNewLecture({...newLecture, presenter_trainee_id: e.target.value})}>
                          <option value="">-- اختر --</option>
                          {trainees.map(t => <option key={t.id} value={t.id}>{t.employee?.name}</option>)}
                        </Select>
                      </Field>
                    ) : (
                      <Field label="اسم المحاضر"><Input required value={newLecture.presenter_name} onChange={e => setNewLecture({...newLecture, presenter_name: e.target.value})} placeholder="د. فلان" /></Field>
                    )}
                  </div>
                  {/* ── Quiz: Manual or Bank ── */}
                  <div className="border-t pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black text-gray-700">أسئلة الاختبار</p>
                      {/* Toggle manual / bank */}
                      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
                        {(['manual','bank'] as const).map(m => (
                          <button key={m} type="button" onClick={() => setQuizMode(m)}
                            className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all ${quizMode === m ? 'bg-white shadow-sm text-orange-700' : 'text-gray-500'}`}>
                            {m === 'manual' ? '✏️ يدوي' : '🗃️ من البنك'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* MANUAL MODE */}
                    {quizMode === 'manual' && (
                      <div className="space-y-3">
                        <button type="button"
                          onClick={() => setQuizQuestions([...quizQuestions, { question: '', options: ['','','',''], correct_answer: '' }])}
                          className="text-[10px] font-black bg-orange-100 text-orange-700 px-3 py-1.5 rounded-lg hover:bg-orange-200 transition-colors w-full">
                          + إضافة سؤال يدوي
                        </button>
                        {quizQuestions.map((q, i) => (
                          <div key={i} className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-2 relative">
                            {quizQuestions.length > 1 && (
                              <button type="button" onClick={() => setQuizQuestions(quizQuestions.filter((_,j) => j !== i))}
                                className="absolute top-2 left-2 w-6 h-6 bg-red-100 text-red-500 rounded-full flex items-center justify-center hover:bg-red-200">
                                <X size={12}/>
                              </button>
                            )}
                            <input value={q.question} onChange={e => handleQChange(i,'question',e.target.value)}
                              placeholder={`السؤال ${i+1}`}
                              className="w-full px-3 py-2 bg-white border border-gray-100 rounded-lg text-xs font-bold outline-none focus:border-orange-300" />
                            <div className="grid grid-cols-2 gap-1.5">
                              {q.options.map((opt, oi) => (
                                <input key={oi} value={opt} onChange={e => handleQChange(i,'options',e.target.value,oi)}
                                  placeholder={`خيار ${oi+1}`}
                                  className="px-3 py-2 bg-white border border-gray-100 rounded-lg text-xs font-bold outline-none focus:border-orange-300" />
                              ))}
                            </div>
                            <input value={q.correct_answer} onChange={e => handleQChange(i,'correct_answer',e.target.value)}
                              placeholder="الإجابة الصحيحة (اكتبها حرفياً)"
                              className="w-full px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-bold outline-none focus:border-emerald-400" />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* BANK MODE */}
                    {quizMode === 'bank' && (
                      <div className="space-y-3">
                        {/* Filters */}
                        <div className="flex gap-2">
                          <select value={bankSubject} onChange={e => setBankSubject(e.target.value)}
                            className="flex-1 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold outline-none focus:border-orange-300">
                            <option value="">كل المواد</option>
                            {[...new Set(bankQuestions.map(q => q.subject))].concat(
                              ['الباطنة وطب المسنين','طب الأطفال','النساء والتوليد','الطب النفسي','طب المجتمع','الجلدية','أنف وأذن وحنجرة','طب العيون','الجراحة']
                            ).filter((v,i,a) => a.indexOf(v) === i).map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                          <div className="relative flex-1">
                            <Search size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input value={bankSearch} onChange={e => setBankSearch(e.target.value)}
                              placeholder="بحث في الأسئلة..."
                              className="w-full pr-8 pl-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold outline-none focus:border-orange-300" />
                          </div>
                        </div>

                        {/* Selected count */}
                        {selectedQIds.size > 0 && (
                          <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-xl px-3 py-2">
                            <span className="text-xs font-black text-orange-700">✓ {selectedQIds.size} سؤال محدد</span>
                            <button type="button" onClick={() => setSelectedQIds(new Set())}
                              className="text-[10px] font-black text-orange-500 hover:text-red-500">مسح الكل</button>
                          </div>
                        )}

                        {/* Questions list */}
                        <div className="max-h-72 overflow-y-auto space-y-2 custom-scrollbar">
                          {bankQuestions.length === 0 ? (
                            <p className="text-xs font-bold text-gray-400 text-center py-6">
                              {bankSubject || bankSearch ? 'لا توجد نتائج' : 'اختر مادة أو ابحث لعرض الأسئلة'}
                            </p>
                          ) : bankQuestions.map(q => {
                            const checked = selectedQIds.has(q.id);
                            const diffColor = q.difficulty === 'easy' ? 'text-emerald-600 bg-emerald-50' : q.difficulty === 'hard' ? 'text-rose-600 bg-rose-50' : 'text-amber-600 bg-amber-50';
                            return (
                              <div key={q.id}
                                onClick={() => setSelectedQIds(prev => {
                                  const s = new Set(prev);
                                  s.has(q.id) ? s.delete(q.id) : s.add(q.id);
                                  return s;
                                })}
                                className={`p-3 rounded-xl border cursor-pointer transition-all ${checked ? 'bg-orange-50 border-orange-300 shadow-sm' : 'bg-white border-gray-100 hover:border-gray-200'}`}>
                                <div className="flex items-start gap-2">
                                  {/* Checkbox */}
                                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${checked ? 'bg-orange-500 border-orange-500' : 'border-gray-300'}`}>
                                    {checked && <CheckCircle2 size={12} className="text-white" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-black text-gray-800 leading-snug line-clamp-2">{q.stem}</p>
                                    <div className="flex items-center gap-2 mt-1.5">
                                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${diffColor}`}>
                                        {q.difficulty === 'easy' ? 'سهل' : q.difficulty === 'hard' ? 'صعب' : 'متوسط'}
                                      </span>
                                      <span className="text-[9px] font-bold text-gray-400">{q.topic}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                  <SaveBtn loading={saving} label="نشر المحاضرة" color="bg-orange-600 hover:bg-orange-700 shadow-orange-100" />
                </form>
              )}

              {/* LOGBOOK: no form needed, filter instead */}
              {activeSection === 'logbook_review' && (
                <div className="space-y-4">
                  <SectionHeader icon={BookOpen} title="فلترة السجلات" color="text-rose-600" bg="bg-rose-50" />
                  {trainerMode && (
                    <div className="flex items-center gap-2 bg-emerald-50 rounded-xl px-3 py-2 border border-emerald-100">
                      <CheckCircle2 size={14} className="text-emerald-600"/>
                      <p className="text-xs font-black text-emerald-700">تعرض فقط حالات متدربيك</p>
                    </div>
                  )}
                  <div className="relative">
                    <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={logSearch} onChange={e => setLogSearch(e.target.value)} placeholder="ابحث بالاسم أو التشخيص..."
                      className="w-full pr-9 pl-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:border-rose-300" />
                  </div>
                  <div className="bg-rose-50 rounded-xl border border-rose-100 p-4 text-center">
                    <p className="text-3xl font-black text-rose-600">{pendingLogbooks.length}</p>
                    <p className="text-xs font-bold text-rose-500 mt-1">حالة تنتظر اعتمادك</p>
                  </div>
                </div>
              )}

            </div>

            {/* ── RIGHT: Data list ─────────────────────────────────────────── */}
            <div className="lg:col-span-2 bg-white p-5 rounded-3xl shadow-sm border border-gray-100 min-h-[400px]">

              {/* TRAINEES list */}
              {activeSection === 'trainees' && (
                <DataSection title="قائمة المتدربين" count={trainees.length} icon={Users} color="text-blue-600">
                  {trainees.map(t => (
                    <DataRow key={t.id}
                      avatar={t.employee?.photo_url} initials={t.employee?.name?.charAt(0)}
                      title={t.employee?.name} sub={`${t.trainee_code} · ${t.employee?.specialty}`}
                      right={<>
                        <span className="bg-indigo-50 text-indigo-700 font-black px-2.5 py-1 rounded-full text-[10px]">سنة {t.current_year}</span>
                        <span className={`font-black px-2.5 py-1 rounded-full text-[10px] ${t.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                          {t.status === 'active' ? 'نشط' : t.status}
                        </span>
                      </>}
                    />
                  ))}
                </DataSection>
              )}

              {/* TRAINERS list */}
              {activeSection === 'trainers' && (
                <DataSection title="قائمة المدربين" count={trainers.length} icon={Stethoscope} color="text-emerald-600">
                  {trainers.map(t => (
                    <DataRow key={t.id} initials={t.employee?.name?.charAt(0)}
                      title={t.employee?.name} sub={`${t.trainer_code} · ${t.title || 'مدرب'}`}
                      right={t.is_scientific_supervisor && <span className="text-[10px] font-black bg-purple-50 text-purple-700 px-2.5 py-1 rounded-full">مشرف علمي</span>}
                    />
                  ))}
                </DataSection>
              )}

              {/* ASSIGNMENTS list */}
              {activeSection === 'assignments' && (
                <DataSection title="توزيع المدربين والمتدربين" count={assignments.length} icon={LinkIcon} color="text-amber-600">
                  {assignments.map(a => (
                    <DataRow key={a.id} initials="→"
                      title={`${a.trainer?.employee?.name || '—'}  →  ${a.trainee?.employee?.name || '—'}`}
                      sub={`بدء: ${new Date(a.start_date).toLocaleDateString('ar-EG')}`}
                      right={a.is_primary && <span className="text-[10px] font-black bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full">رئيسي</span>}
                    />
                  ))}
                </DataSection>
              )}

              {/* LECTURES list */}
              {activeSection === 'lectures' && (
                <DataSection title="أجندة المحاضرات" count={lectures.length} icon={Presentation} color="text-orange-600">
                  {lectures.map(l => (
                    <div key={l.id} className="flex items-start gap-3 p-4 rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all">
                      <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0 text-orange-600"><Presentation size={18}/></div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-gray-800 text-sm">{l.title}</p>
                        <p className="text-xs font-bold text-gray-500 mt-0.5 line-clamp-1">{l.description}</p>
                        <div className="flex flex-wrap gap-2 mt-2 text-[10px] font-bold text-gray-400">
                          <span className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full">{l.presenter_type === 'trainee' ? l.presenter_trainee?.employee?.name : l.presenter_name}</span>
                          <span className="flex items-center gap-1"><Calendar size={10}/>{new Date(l.lecture_date).toLocaleDateString('ar-EG')} {l.lecture_time}</span>
                          {l.quiz_questions && <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{l.quiz_questions.length} سؤال</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </DataSection>
              )}

              {/* ROTATIONS list */}
              {activeSection === 'rotations' && (
                <DataSection title="الدورات المجدولة" count={trainees.length} icon={Calendar} color="text-cyan-600">
                  {trainees.map(t => (
                    <DataRow key={t.id} initials={t.employee?.name?.charAt(0)} title={t.employee?.name} sub={t.trainee_code}
                      right={<button onClick={() => toast('افتح TraineeRotationsTab للتفاصيل')} className="text-[10px] font-black text-cyan-600 flex items-center gap-1 hover:underline"><Eye size={11}/> التفاصيل</button>}
                    />
                  ))}
                </DataSection>
              )}

              {/* LOGBOOK REVIEW */}
              {activeSection === 'logbook_review' && (
                <DataSection title="حالات بانتظار الاعتماد" count={filteredLogs.length} icon={BookOpen} color="text-rose-600">
                  {filteredLogs.length === 0 ? (
                    <div className="text-center py-12">
                      <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-300 mb-3" />
                      <p className="font-black text-gray-400 text-sm">لا توجد حالات معلقة 🎉</p>
                    </div>
                  ) : filteredLogs.map(log => (
                    <div key={log.id} className="p-4 bg-white rounded-2xl border border-rose-100 shadow-sm hover:shadow-md transition-all">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <span className="text-[10px] font-black bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full">{log.trainee?.employee?.name}</span>
                          <h4 className="font-black text-gray-800 text-sm mt-1.5">{log.diagnosis || 'بدون تشخيص'}</h4>
                          <span className="text-[10px] font-bold text-gray-400">{new Date(log.entry_date).toLocaleDateString('ar-EG')}</span>
                        </div>
                        <span className="text-[10px] font-black bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{log.entry_type}</span>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 p-3 rounded-xl border border-gray-100 mb-3 line-clamp-3">{log.description}</p>
                      {/* Quick comment + approve */}
                      {reviewId === log.id ? (
                        <div className="space-y-2">
                          <Textarea rows={2} value={reviewComment} onChange={e => setReviewComment(e.target.value)} placeholder="تعليق اختياري للمتدرب..." />
                          <div className="flex gap-2">
                            <button onClick={() => { setReviewId(null); setReviewComment(''); }} className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-black hover:bg-gray-200">إلغاء</button>
                            <button onClick={() => handleApproveLogbook(log.id)} disabled={saving}
                              className="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black hover:bg-emerald-700 flex items-center justify-center gap-1">
                              {saving ? <Loader2 size={13} className="animate-spin"/> : <><CheckCircle2 size={13}/> اعتماد</>}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button onClick={() => setReviewId(log.id)} className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-xl text-xs font-black hover:bg-gray-50 flex items-center justify-center gap-1">
                            <MessageSquare size={12}/> إضافة تعليق
                          </button>
                          <button onClick={() => handleApproveLogbook(log.id)} disabled={saving}
                            className="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black hover:bg-emerald-700 flex items-center justify-center gap-1 transition-colors">
                            {saving ? <Loader2 size={13} className="animate-spin"/> : <><CheckCircle2 size={13}/> اعتماد الحالة</>}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </DataSection>
              )}

              {/* DOPS list */}
              {activeSection === 'dops_eval' && (
                <DataSection title="تقييمات DOPS المضافة" count={0} icon={Activity} color="text-purple-600">
                  <p className="text-xs font-bold text-gray-400 text-center py-8">التقييمات المضافة تظهر في ملف كل متدرب</p>
                </DataSection>
              )}

              {/* TAR list */}
              {activeSection === 'tar_reports' && (
                <DataSection title="تقارير التقييم الدوري" count={tarList.length} icon={FileText} color="text-teal-600">
                  {tarList.map(r => {
                    const rl = [,{e:'😟',c:'rose'},{e:'😐',c:'amber'},{e:'😊',c:'blue'},{e:'🌟',c:'emerald'}][r.overall_rating] || {e:'😐',c:'gray'};
                    return (
                      <DataRow key={r.id} initials={rl.e}
                        title={`${r.trainee?.employee?.name || '—'}  ←  ${r.trainer?.employee?.name || '—'}`}
                        sub={`${new Date(r.report_period_start).toLocaleDateString('ar-EG')} – ${new Date(r.report_period_end).toLocaleDateString('ar-EG')}`}
                        right={<>
                          <span className={`text-[10px] font-black bg-${rl.c}-50 text-${rl.c}-700 px-2 py-0.5 rounded-full`}>{r.overall_rating}/4</span>
                          {!r.trainee_acknowledged && <span className="text-[10px] font-black bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full flex items-center gap-1"><Clock size={9}/>انتظار</span>}
                        </>}
                      />
                    );
                  })}
                </DataSection>
              )}

            </div>
          </div>
        )
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, color, bg }: any) {
  return (
    <div className={`flex items-center gap-3 mb-5 pb-4 border-b border-gray-100`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${bg} ${color}`}><Icon size={18}/></div>
      <h3 className="font-black text-gray-800 text-sm">{title}</h3>
    </div>
  );
}

function DataSection({ title, count, icon: Icon, color, children }: any) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
        <h3 className={`text-sm font-black text-gray-700 flex items-center gap-2`}>
          <Icon size={16} className={color} /> {title}
        </h3>
        <span className="text-xs font-black text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">{count}</span>
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function DataRow({ avatar, initials, title, sub, right }: any) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50/50 transition-all">
      <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center text-sm font-black flex-shrink-0 overflow-hidden">
        {avatar ? <img src={avatar} className="w-full h-full object-cover" alt="" /> : initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-black text-gray-800 text-xs truncate">{title}</p>
        <p className="text-[10px] font-semibold text-gray-400 truncate">{sub}</p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">{right}</div>
    </div>
  );
}
