import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import {
  BookOpen, FileText, Activity, CheckCircle2, Loader2,
  ChevronRight, Calendar, Stethoscope, Tag, AlignLeft,
  Link as LinkIcon, User, Star, Send, Sparkles, ClipboardList,
  FlaskConical, BookMarked, Mic2, AlertTriangle, ArrowRight
} from 'lucide-react';

// ─── Tab config ────────────────────────────────────────────────────────────────
const TABS = [
  {
    id: 'logbook',
    label: 'سجل الحالات',
    sublabel: 'Logbook',
    icon: BookOpen,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    grad: 'from-blue-600 to-indigo-600',
  },
  {
    id: 'portfolio',
    label: 'ملف الإنجاز',
    sublabel: 'Portfolio',
    icon: FileText,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    grad: 'from-amber-500 to-orange-600',
  },
  {
    id: 'dops',
    label: 'طلب تقييم',
    sublabel: 'DOPS Request',
    icon: Activity,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    grad: 'from-purple-600 to-violet-600',
  },
] as const;

type TabId = typeof TABS[number]['id'];

// ─── Logbook entry types ───────────────────────────────────────────────────────
const ENTRY_TYPES = [
  { value: 'case',        label: 'حالة مرضية',    icon: Stethoscope, color: 'text-blue-600',   bg: 'bg-blue-50'   },
  { value: 'procedure',   label: 'إجراء طبي',     icon: Activity,    color: 'text-rose-600',   bg: 'bg-rose-50'   },
  { value: 'skill',       label: 'مهارة سريرية',  icon: Star,        color: 'text-amber-600',  bg: 'bg-amber-50'  },
  { value: 'observation', label: 'ملاحظة تعليمية',icon: BookOpen,    color: 'text-teal-600',   bg: 'bg-teal-50'   },
];

// ─── Portfolio component types ─────────────────────────────────────────────────
const PORTFOLIO_TYPES = [
  { value: 'CV',               label: 'السيرة الذاتية',     icon: User,         required: 1,  color: 'text-slate-600',  bg: 'bg-slate-50'  },
  { value: 'Research',         label: 'بحث علمي',           icon: FlaskConical, required: 1,  color: 'text-blue-600',   bg: 'bg-blue-50'   },
  { value: 'Case Study',       label: 'دراسة حالة',         icon: BookMarked,   required: 4,  color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { value: 'Journal Club',     label: 'نادي علمي',          icon: BookOpen,     required: 4,  color: 'text-violet-600', bg: 'bg-violet-50' },
  { value: 'Health Education', label: 'تثقيف صحي',          icon: Mic2,         required: 4,  color: 'text-emerald-600',bg: 'bg-emerald-50'},
  { value: 'Incident Report',  label: 'تقرير حادثة',        icon: AlertTriangle,required: 1,  color: 'text-rose-600',   bg: 'bg-rose-50'   },
];

// ─── Small helpers ─────────────────────────────────────────────────────────────
const Label = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[11px] font-black text-gray-500 mb-1.5 flex items-center gap-1">{children}</p>
);
const inputCls = "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold outline-none focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-50 transition-all placeholder:text-gray-300";
const textareaCls = `${inputCls} resize-none`;

// ─── Step indicator ────────────────────────────────────────────────────────────
function StepDot({ n, active, done }: { n: number; active: boolean; done: boolean }) {
  return (
    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all ${
      done   ? 'bg-emerald-500 text-white' :
      active ? 'bg-indigo-600 text-white ring-4 ring-indigo-100' :
               'bg-gray-100 text-gray-400'
    }`}>
      {done ? <CheckCircle2 size={14}/> : n}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
export default function TraineeDataEntryPage({ employeeId }: { employeeId: string }) {
  const [activeTab, setActiveTab]   = useState<TabId>('logbook');
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [traineeId, setTraineeId]   = useState<string | null>(null);
  const [traineeName, setTraineeName] = useState('');
  const [rotations, setRotations]   = useState<any[]>([]);
  const [trainers, setTrainers]     = useState<any[]>([]);
  const [skills, setSkills]         = useState<any[]>([]);
  const [successAnim, setSuccessAnim] = useState(false);

  // ── Logbook form ──────────────────────────────────────────────────────────
  const [log, setLog] = useState({
    entry_date: new Date().toISOString().split('T')[0],
    entry_type: 'case',
    diagnosis: '',
    description: '',
    rotation_id: '',
  });

  // ── Portfolio form ────────────────────────────────────────────────────────
  const [port, setPort] = useState({
    component_type: 'Case Study',
    title: '',
    description: '',
    file_url: '',
    submission_date: new Date().toISOString().split('T')[0],
  });

  // ── DOPS request form ─────────────────────────────────────────────────────
  const [dopsReq, setDopsReq] = useState({
    skill_id: '',
    preferred_trainer_id: '',
    note: '',          // ملاحظة للمدرب — تُرسل كـ notification
    preferred_date: '',
  });

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: t } = await supabase
          .from('fellowship_trainees')
          .select('id, employee:employees(name)')
          .eq('employee_id', employeeId)
          .single();
        if (!t) { setLoading(false); return; }
        setTraineeId(t.id);
        setTraineeName((t.employee as any)?.name || '');

        const [{ data: rots }, { data: trnrs }, { data: skls }] = await Promise.all([
          supabase.from('fellowship_trainee_rotations')
            .select('id, start_date, end_date, status, rotation_type:fellowship_rotation_types(name_ar)')
            .eq('trainee_id', t.id)
            .in('status', ['ongoing', 'completed'])
            .order('start_date', { ascending: false }),
          supabase.from('fellowship_trainers')
            .select('id, employee:employees(name), title'),
          supabase.from('fellowship_clinical_skills')
            .select('id, skill_number, name_ar, category')
            .order('skill_number'),
        ]);

        setRotations(rots || []);
        setTrainers(trnrs || []);
        setSkills(skls || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    if (employeeId) load();
  }, [employeeId]);

  // ── Success animation ──────────────────────────────────────────────────────
  const triggerSuccess = () => {
    setSuccessAnim(true);
    setTimeout(() => setSuccessAnim(false), 2000);
  };

  // ── Submit Logbook ─────────────────────────────────────────────────────────
  const submitLogbook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!traineeId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('fellowship_logbook').insert({
        trainee_id: traineeId,
        entry_date: log.entry_date,
        entry_type: log.entry_type,
        diagnosis: log.diagnosis || null,
        description: log.description,
        rotation_id: log.rotation_id || null,
        trainer_reviewed: false,
      });
      if (error) throw error;
      toast.success('✅ تم حفظ الحالة في السجل الطبي');
      triggerSuccess();
      setLog({ entry_date: new Date().toISOString().split('T')[0], entry_type: 'case', diagnosis: '', description: '', rotation_id: '' });
    } catch (err: any) { toast.error(err.message || 'خطأ في الحفظ'); }
    finally { setSaving(false); }
  };

  // ── Submit Portfolio ───────────────────────────────────────────────────────
  const submitPortfolio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!traineeId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('fellowship_portfolio_items').insert({
        trainee_id: traineeId,
        component_type: port.component_type,
        title: port.title,
        description: port.description || null,
        file_url: port.file_url || null,
        submission_date: port.submission_date,
        supervisor_reviewed: false,
        status: 'submitted',
      });
      if (error) throw error;
      toast.success('✅ تم إضافة العنصر لملف الإنجاز');
      triggerSuccess();
      setPort({ component_type: 'Case Study', title: '', description: '', file_url: '', submission_date: new Date().toISOString().split('T')[0] });
    } catch (err: any) { toast.error(err.message || 'خطأ في الحفظ'); }
    finally { setSaving(false); }
  };

  // ── Submit DOPS Request ────────────────────────────────────────────────────
  // بترسل notification للمدرب المختار بدل ما تضيف تقييم مباشرة
  const submitDopsRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!traineeId) return;
    setSaving(true);
    try {
      // ابحث عن trainer employee_id عشان نبعتله notification
      const chosenTrainer = trainers.find(t => t.id === dopsReq.preferred_trainer_id);
      const skillName     = skills.find(s => s.id === dopsReq.skill_id)?.name_ar || '';

      // أضف notification للمدرب المختار
      if (chosenTrainer) {
        await supabase.from('notifications').insert({
          user_id: chosenTrainer.id,   // trainer's employee_id if available
          title: 'طلب تقييم DOPS',
          message: `🔬 ${traineeName} يطلب تقييم مهارة "${skillName}"${dopsReq.preferred_date ? ` بتاريخ ${new Date(dopsReq.preferred_date).toLocaleDateString('ar-EG')}` : ''}${dopsReq.note ? ` — "${dopsReq.note}"` : ''}`,
          notif_type: 'dops_request',
          is_read: false,
        });
      }

      toast.success('✅ تم إرسال طلب التقييم للمدرب');
      triggerSuccess();
      setDopsReq({ skill_id: '', preferred_trainer_id: '', note: '', preferred_date: '' });
    } catch (err: any) { toast.error(err.message || 'خطأ في الإرسال'); }
    finally { setSaving(false); }
  };

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex flex-col items-center justify-center py-28 gap-3">
      <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
      </div>
      <p className="text-sm font-bold text-gray-400">جاري تحميل نماذج التسجيل...</p>
    </div>
  );

  if (!traineeId) return (
    <div className="p-8 text-center">
      <ClipboardList className="w-12 h-12 mx-auto text-gray-200 mb-3" />
      <p className="font-bold text-gray-400">حساب المتدرب غير مفعّل.</p>
    </div>
  );

  const activeTabCfg = TABS.find(t => t.id === activeTab)!;

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="p-4 md:p-6 space-y-5 animate-in fade-in duration-300" dir="rtl">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className={`relative bg-gradient-to-br ${activeTabCfg.grad} rounded-3xl p-5 md:p-7 overflow-hidden transition-all duration-500`}>
        <div className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: 'repeating-linear-gradient(45deg, white 0, white 1px, transparent 0, transparent 50%)', backgroundSize: '12px 12px' }} />
        <div className="relative flex items-center gap-4">
          <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center border border-white/20 flex-shrink-0">
            <activeTabCfg.icon className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-white/60 text-xs font-semibold">تسجيل بيانات المنهج</p>
            <h2 className="text-lg font-black text-white leading-tight">{activeTabCfg.label}</h2>
          </div>
          {/* Success pulse */}
          {successAnim && (
            <div className="flex items-center gap-2 bg-white/20 backdrop-blur border border-white/30 rounded-2xl px-4 py-2 animate-in zoom-in-90 duration-300">
              <CheckCircle2 size={16} className="text-white" />
              <span className="text-xs font-black text-white">تم الحفظ!</span>
            </div>
          )}
        </div>

        {/* Tab switcher inside hero */}
        <div className="relative mt-5 flex gap-2">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = tab.id === activeTab;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-2xl text-[11px] font-black transition-all ${
                  active
                    ? 'bg-white text-gray-800 shadow-lg'
                    : 'bg-white/15 text-white/80 hover:bg-white/25'
                }`}>
                <Icon size={16} className={active ? activeTabCfg.color : ''} />
                <span className="hidden sm:block">{tab.label}</span>
                <span className="block sm:hidden">{tab.sublabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* LOGBOOK FORM                                                       */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'logbook' && (
        <form onSubmit={submitLogbook} className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">

          {/* Entry type selector */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
            <Label><Tag size={12}/> نوع الإدخال</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {ENTRY_TYPES.map(et => (
                <button key={et.value} type="button"
                  onClick={() => setLog({ ...log, entry_type: et.value })}
                  className={`flex items-center gap-2.5 p-3 rounded-2xl border-2 text-xs font-black transition-all active:scale-95 ${
                    log.entry_type === et.value
                      ? `${et.bg} ${et.color} border-current shadow-sm`
                      : 'bg-gray-50 text-gray-500 border-transparent hover:border-gray-200'
                  }`}>
                  <et.icon size={15} />
                  {et.label}
                </button>
              ))}
            </div>
          </div>

          {/* Main fields */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 space-y-4">
            <Label><Calendar size={12}/> تاريخ الحالة</Label>
            <input type="date" required value={log.entry_date}
              onChange={e => setLog({ ...log, entry_date: e.target.value })}
              className={inputCls} />

            <Label><Stethoscope size={12}/> التشخيص / اسم الإجراء</Label>
            <input type="text" placeholder="مثال: ارتفاع ضغط الدم غير المنضبط"
              value={log.diagnosis} onChange={e => setLog({ ...log, diagnosis: e.target.value })}
              className={inputCls} />

            <Label><AlignLeft size={12}/> وصف تفصيلي للحالة <span className="text-rose-500">*</span></Label>
            <textarea required rows={4}
              placeholder="اكتب ملخصاً للحالة: الأعراض، الفحص، التشخيص، الخطة العلاجية، ونقاط التعلم..."
              value={log.description} onChange={e => setLog({ ...log, description: e.target.value })}
              className={textareaCls} />

            <Label><ArrowRight size={12}/> الدورة التدريبية (اختياري)</Label>
            <select value={log.rotation_id} onChange={e => setLog({ ...log, rotation_id: e.target.value })}
              className={inputCls}>
              <option value="">-- اختر الدورة الحالية --</option>
              {rotations.map(r => (
                <option key={r.id} value={r.id}>
                  {r.rotation_type?.name_ar} ({new Date(r.start_date).toLocaleDateString('ar-EG')})
                  {r.status === 'ongoing' ? ' 🔵' : ' ✅'}
                </option>
              ))}
            </select>
          </div>

          {/* Tip */}
          <div className="bg-blue-50 rounded-2xl border border-blue-100 px-4 py-3 flex items-start gap-2">
            <Sparkles size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] font-bold text-blue-700 leading-relaxed">
              الحالة ستُرسل تلقائياً لمدربك للاعتماد. حاول تكتب وصفاً تعليمياً يعكس ما تعلمته من هذه الحالة.
            </p>
          </div>

          <SubmitBtn saving={saving} label="حفظ في السجل الطبي" color="bg-blue-600 hover:bg-blue-700" />
        </form>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* PORTFOLIO FORM                                                     */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'portfolio' && (
        <form onSubmit={submitPortfolio} className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">

          {/* Component type grid */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
            <Label><Tag size={12}/> نوع العنصر</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
              {PORTFOLIO_TYPES.map(pt => {
                const Icon = pt.icon;
                const selected = port.component_type === pt.value;
                return (
                  <button key={pt.value} type="button"
                    onClick={() => setPort({ ...port, component_type: pt.value })}
                    className={`flex flex-col items-start gap-1.5 p-3 rounded-2xl border-2 text-right transition-all active:scale-95 ${
                      selected
                        ? `${pt.bg} ${pt.color} border-current shadow-sm`
                        : 'bg-gray-50 text-gray-500 border-transparent hover:border-gray-200'
                    }`}>
                    <Icon size={16} className={selected ? '' : 'opacity-50'} />
                    <span className="text-[11px] font-black leading-tight">{pt.label}</span>
                    <span className="text-[9px] font-bold opacity-60">مطلوب {pt.required}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fields */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 space-y-4">
            <Label><AlignLeft size={12}/> العنوان <span className="text-rose-500">*</span></Label>
            <input required type="text"
              placeholder={
                port.component_type === 'CV'               ? 'السيرة الذاتية — د. اسمك' :
                port.component_type === 'Research'         ? 'عنوان البحث العلمي' :
                port.component_type === 'Case Study'       ? 'عنوان دراسة الحالة' :
                port.component_type === 'Journal Club'     ? 'عنوان المقالة العلمية التي ناقشتها' :
                port.component_type === 'Health Education' ? 'موضوع التثقيف الصحي' :
                                                             'عنوان تقرير الحادثة'
              }
              value={port.title} onChange={e => setPort({ ...port, title: e.target.value })}
              className={inputCls} />

            <Label><AlignLeft size={12}/> وصف / ملخص (اختياري)</Label>
            <textarea rows={3}
              placeholder="ملخص قصير لمحتوى العنصر ونقاط التعلم الرئيسية..."
              value={port.description} onChange={e => setPort({ ...port, description: e.target.value })}
              className={textareaCls} />

            <Label><LinkIcon size={12}/> رابط الملف (Google Drive أو غيره)</Label>
            <input type="url" placeholder="https://drive.google.com/..."
              value={port.file_url} onChange={e => setPort({ ...port, file_url: e.target.value })}
              className={inputCls} />

            <Label><Calendar size={12}/> تاريخ التقديم</Label>
            <input required type="date" value={port.submission_date}
              onChange={e => setPort({ ...port, submission_date: e.target.value })}
              className={inputCls} />
          </div>

          {/* Requirements reminder */}
          <div className="bg-amber-50 rounded-2xl border border-amber-100 px-4 py-3 flex items-start gap-2">
            <Sparkles size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-black text-amber-800 mb-1">متطلبات ملف الإنجاز</p>
              <p className="text-[10px] font-bold text-amber-700 leading-relaxed">
                4 دراسة حالة · 4 نادي علمي · 4 تثقيف صحي · 1 بحث · 1 CV · 1 تقرير حادثة
              </p>
            </div>
          </div>

          <SubmitBtn saving={saving} label="إضافة لملف الإنجاز" color="bg-amber-600 hover:bg-amber-700" />
        </form>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* DOPS REQUEST FORM                                                  */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'dops' && (
        <form onSubmit={submitDopsRequest} className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">

          {/* Skill selector */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 space-y-4">
            <Label><Activity size={12}/> المهارة المطلوب تقييمها <span className="text-rose-500">*</span></Label>

            {/* Category groups */}
            {['diagnostic','therapeutic','emergency','administrative'].map(cat => {
              const catSkills = skills.filter(s => s.category === cat);
              if (!catSkills.length) return null;
              const catLabel: Record<string,string> = {
                diagnostic: 'تشخيصية', therapeutic: 'علاجية وإجرائية',
                emergency: 'طوارئ وإنعاش', administrative: 'إدارية',
              };
              return (
                <div key={cat}>
                  <p className="text-[10px] font-black text-gray-400 mb-2 px-1">{catLabel[cat]}</p>
                  <div className="space-y-1.5">
                    {catSkills.map(s => (
                      <button key={s.id} type="button"
                        onClick={() => setDopsReq({ ...dopsReq, skill_id: s.id })}
                        className={`w-full flex items-center gap-3 p-3 rounded-2xl border-2 text-right transition-all active:scale-[0.99] ${
                          dopsReq.skill_id === s.id
                            ? 'bg-purple-50 border-purple-300 text-purple-800'
                            : 'bg-gray-50 border-transparent text-gray-700 hover:border-gray-200'
                        }`}>
                        <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-[10px] font-black flex-shrink-0 ${
                          dopsReq.skill_id === s.id ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-600'
                        }`}>{s.skill_number}</span>
                        <span className="text-xs font-black flex-1 leading-tight text-right">{s.name_ar}</span>
                        {dopsReq.skill_id === s.id && <CheckCircle2 size={16} className="text-purple-500 flex-shrink-0"/>}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Trainer + date + note */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 space-y-4">
            <Label><User size={12}/> المدرب المطلوب التقييم منه <span className="text-rose-500">*</span></Label>
            <select required value={dopsReq.preferred_trainer_id}
              onChange={e => setDopsReq({ ...dopsReq, preferred_trainer_id: e.target.value })}
              className={inputCls}>
              <option value="">-- اختر المدرب --</option>
              {trainers.map(t => (
                <option key={t.id} value={t.id}>
                  {t.title ? `${t.title} ` : ''}{t.employee?.name}
                </option>
              ))}
            </select>

            <Label><Calendar size={12}/> التاريخ المقترح للتقييم (اختياري)</Label>
            <input type="date" value={dopsReq.preferred_date}
              min={new Date().toISOString().split('T')[0]}
              onChange={e => setDopsReq({ ...dopsReq, preferred_date: e.target.value })}
              className={inputCls} />

            <Label><AlignLeft size={12}/> ملاحظة للمدرب (اختياري)</Label>
            <textarea rows={2}
              placeholder="مثال: أحتاج تقييم هذه المهارة بعد ممارستها في دورة النساء..."
              value={dopsReq.note} onChange={e => setDopsReq({ ...dopsReq, note: e.target.value })}
              className={textareaCls} />
          </div>

          {/* Info */}
          <div className="bg-purple-50 rounded-2xl border border-purple-100 px-4 py-3 flex items-start gap-2">
            <Sparkles size={14} className="text-purple-500 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] font-bold text-purple-700 leading-relaxed">
              سيصل إشعار فوري للمدرب المختار بطلب التقييم. المدرب هو المسؤول عن إضافة نتيجة التقييم في النظام.
            </p>
          </div>

          <SubmitBtn saving={saving} label="إرسال طلب التقييم" color="bg-purple-600 hover:bg-purple-700" icon={Send} />
        </form>
      )}

    </div>
  );
}

// ─── Submit button ─────────────────────────────────────────────────────────────
function SubmitBtn({ saving, label, color, icon: Icon = CheckCircle2 }: {
  saving: boolean; label: string; color: string; icon?: any;
}) {
  return (
    <button type="submit" disabled={saving}
      className={`w-full py-4 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2.5 transition-all active:scale-[0.99] shadow-lg disabled:opacity-50 ${color}`}>
      {saving
        ? <><Loader2 size={16} className="animate-spin" /> جاري الحفظ...</>
        : <><Icon size={16} /> {label}</>
      }
    </button>
  );
}
