import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import {
  BookOpen, Plus, FileText, CheckCircle, Clock, Stethoscope, Syringe,
  Eye, AlertCircle, Loader2, Calendar, X, Search, ChevronDown, MessageSquare
} from 'lucide-react';

interface LogbookEntry {
  id: string; entry_date: string;
  entry_type: 'case' | 'procedure' | 'skill' | 'observation';
  description: string; diagnosis: string;
  trainer_reviewed: boolean; trainer_comments: string; created_at: string;
}

const TYPE_CFG: Record<string, any> = {
  case:        { label: 'حالة مرضية',  icon: Stethoscope, color: 'text-blue-600',    bg: 'bg-blue-50',    ring: 'ring-blue-200' },
  procedure:   { label: 'إجراء طبي',   icon: Syringe,     color: 'text-rose-600',    bg: 'bg-rose-50',    ring: 'ring-rose-200' },
  skill:       { label: 'مهارة',       icon: FileText,    color: 'text-emerald-600', bg: 'bg-emerald-50', ring: 'ring-emerald-200' },
  observation: { label: 'ملاحظة',      icon: Eye,         color: 'text-purple-600',  bg: 'bg-purple-50',  ring: 'ring-purple-200' },
};

function EntryCard({ entry }: { entry: LogbookEntry }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = TYPE_CFG[entry.entry_type] || TYPE_CFG.case;
  const Icon = cfg.icon;
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden ${entry.trainer_reviewed ? 'border-r-4 border-r-emerald-400' : 'border-r-4 border-r-amber-300'}`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg} ${cfg.color}`}>
            <Icon size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h4 className="text-sm font-black text-gray-800 leading-tight line-clamp-1" dir="auto">{entry.diagnosis || '—'}</h4>
              {entry.trainer_reviewed
                ? <span className="flex-shrink-0 flex items-center gap-1 text-[10px] font-black bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-100"><CheckCircle size={10}/> معتمد</span>
                : <span className="flex-shrink-0 flex items-center gap-1 text-[10px] font-black bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full border border-amber-100"><Clock size={10}/> انتظار</span>
              }
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 flex-wrap">
              <span className={`${cfg.color} ${cfg.bg} px-2 py-0.5 rounded-full font-black`}>{cfg.label}</span>
              <span className="flex items-center gap-1"><Calendar size={10}/>{new Date(entry.entry_date).toLocaleDateString('ar-EG')}</span>
            </div>
          </div>
        </div>
        <div className="mt-3">
          <p className={`text-xs font-bold text-gray-500 leading-relaxed ${expanded ? '' : 'line-clamp-2'}`} dir="auto">{entry.description}</p>
          {entry.description?.length > 80 && (
            <button onClick={() => setExpanded(!expanded)} className="text-[11px] font-black text-indigo-500 mt-1 flex items-center gap-1 hover:text-indigo-700">
              {expanded ? 'إخفاء' : 'المزيد'} <ChevronDown size={12} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
        {entry.trainer_reviewed && entry.trainer_comments && (
          <div className="mt-3 pt-3 border-t border-gray-50 flex items-start gap-2">
            <MessageSquare size={13} className="text-indigo-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs font-bold text-indigo-700 leading-relaxed" dir="auto">"{entry.trainer_comments}"</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TraineeLogbookTab({ employeeId }: { employeeId: string }) {
  const [traineeId, setTraineeId] = useState<string | null>(null);
  const [entries, setEntries] = useState<LogbookEntry[]>([]);
  const [rotations, setRotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [formData, setFormData] = useState({
    entry_date: new Date().toISOString().split('T')[0],
    entry_type: 'case', diagnosis: '', description: '', rotation_id: '',
  });

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const { data: t } = await supabase.from('fellowship_trainees').select('id').eq('employee_id', employeeId).single();
        if (!t) { setLoading(false); return; }
        setTraineeId(t.id);
        const [{ data: logs }, { data: rots }] = await Promise.all([
          supabase.from('fellowship_logbook').select('*').eq('trainee_id', t.id).order('entry_date', { ascending: false }),
          supabase.from('fellowship_trainee_rotations').select('id, start_date, rotation_type:fellowship_rotation_types(name_ar, training_year)').eq('trainee_id', t.id).order('start_date', { ascending: false }),
        ]);
        setEntries(logs || []); setRotations(rots || []);
      } catch { toast.error('خطأ في التحميل'); }
      finally { setLoading(false); }
    };
    if (employeeId) fetch();
  }, [employeeId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!traineeId) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.from('fellowship_logbook')
        .insert({ ...formData, trainee_id: traineeId, rotation_id: formData.rotation_id || null })
        .select().single();
      if (error) throw error;
      toast.success('✅ تم تسجيل الحالة! بانتظار اعتماد المدرب.');
      setEntries([data, ...entries]);
      setShowForm(false);
      setFormData(f => ({ ...f, diagnosis: '', description: '', rotation_id: '' }));
    } catch { toast.error('حدث خطأ'); }
    finally { setSubmitting(false); }
  };

  const filtered = useMemo(() => entries.filter(e => {
    const s = !search || e.diagnosis?.toLowerCase().includes(search.toLowerCase()) || e.description?.toLowerCase().includes(search.toLowerCase());
    const t = filterType === 'all' || e.entry_type === filterType;
    const st = filterStatus === 'all' || (filterStatus === 'approved' ? e.trainer_reviewed : !e.trainer_reviewed);
    return s && t && st;
  }), [entries, search, filterType, filterStatus]);

  const approved = entries.filter(e => e.trainer_reviewed).length;
  const pending  = entries.length - approved;

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-28 gap-3">
      <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-emerald-600" /></div>
      <p className="text-sm font-bold text-gray-400">جاري تحميل السجل...</p>
    </div>
  );
  if (!traineeId) return (
    <div className="p-8 text-center">
      <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-orange-400"><AlertCircle size={28} /></div>
      <p className="font-bold text-gray-500">حساب المتدرب غير مفعّل.</p>
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-5 animate-in fade-in duration-400" dir="rtl">

      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-emerald-50 rounded-2xl flex items-center justify-center"><BookOpen size={22} className="text-emerald-600" /></div>
            <div>
              <h2 className="text-base font-black text-gray-800">سجل الحالات (Logbook)</h2>
              <p className="text-[11px] font-semibold text-gray-400">سجّل يومياتك الطبية ليتم اعتمادها من المدرب</p>
            </div>
          </div>
          <button onClick={() => setShowForm(!showForm)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm transition-all active:scale-95 ${showForm ? 'bg-gray-100 text-gray-600' : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-100'}`}>
            {showForm ? <><X size={15}/> إلغاء</> : <><Plus size={15}/> إضافة حالة</>}
          </button>
        </div>
        {/* mini stats */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-50">
          <span className="text-[11px] font-black bg-gray-100 text-gray-600 px-3 py-1 rounded-full">الكل: {entries.length}</span>
          <span className="text-[11px] font-black bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full border border-emerald-100">✓ معتمد: {approved}</span>
          <span className="text-[11px] font-black bg-amber-50 text-amber-600 px-3 py-1 rounded-full border border-amber-100">⏳ انتظار: {pending}</span>
          <span className="text-[11px] font-black bg-blue-50 text-blue-600 px-3 py-1 rounded-full border border-blue-100">
            نسبة الاعتماد: {entries.length > 0 ? Math.round((approved/entries.length)*100) : 0}%
          </span>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-sm space-y-4 animate-in slide-in-from-top-3 duration-300">
          <h3 className="font-black text-gray-700 text-sm border-b pb-3 flex items-center gap-2"><Plus size={15} className="text-emerald-500"/> إضافة إدخال جديد</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: '📅 التاريخ', type: 'date', val: formData.entry_date, set: (v: string) => setFormData(f => ({...f, entry_date: v})), required: true },
            ].map((f, i) => (
              <div key={i}>
                <label className="block text-xs font-black text-gray-500 mb-1.5">{f.label}</label>
                <input type={f.type} required={f.required} value={f.val} onChange={e => f.set(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50" />
              </div>
            ))}
            <div>
              <label className="block text-xs font-black text-gray-500 mb-1.5">🔖 النوع</label>
              <select value={formData.entry_type} onChange={e => setFormData(f => ({...f, entry_type: e.target.value}))}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:border-emerald-400">
                <option value="case">حالة مرضية</option><option value="procedure">إجراء طبي</option>
                <option value="skill">مهارة</option><option value="observation">ملاحظة</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-black text-gray-500 mb-1.5">🔄 الدورة (اختياري)</label>
              <select value={formData.rotation_id} onChange={e => setFormData(f => ({...f, rotation_id: e.target.value}))}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:border-emerald-400">
                <option value="">-- اختياري --</option>
                {rotations.map(r => <option key={r.id} value={r.id}>{r.rotation_type?.name_ar} · سنة {r.rotation_type?.training_year}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-black text-gray-500 mb-1.5">🩺 التشخيص *</label>
            <input type="text" required value={formData.diagnosis} onChange={e => setFormData(f => ({...f, diagnosis: e.target.value}))}
              placeholder="مثال: Acute Pharyngitis / ارتفاع ضغط الدم"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50" dir="auto" />
          </div>
          <div>
            <label className="block text-xs font-black text-gray-500 mb-1.5">📝 وصف الحالة *</label>
            <textarea required rows={3} value={formData.description} onChange={e => setFormData(f => ({...f, description: e.target.value}))}
              placeholder="صِف الأعراض والإجراءات التي قمت بها..."
              className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:border-emerald-400 resize-none" dir="auto" />
          </div>
          <button type="submit" disabled={submitting}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-colors active:scale-[0.99] disabled:opacity-50">
            {submitting ? <Loader2 size={17} className="animate-spin" /> : <><CheckCircle size={17}/> حفظ في السجل</>}
          </button>
        </form>
      )}

      {/* Filter bar */}
      {entries.length > 0 && (
        <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث في التشخيص..."
              className="w-full pr-9 pl-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold outline-none focus:border-indigo-300" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-black outline-none">
              <option value="all">كل الأنواع</option><option value="case">حالة</option>
              <option value="procedure">إجراء</option><option value="skill">مهارة</option><option value="observation">ملاحظة</option>
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-black outline-none">
              <option value="all">كل الحالات</option><option value="approved">معتمد</option><option value="pending">انتظار</option>
            </select>
          </div>
        </div>
      )}

      {/* Entries */}
      <div>
        {entries.length > 0 && <p className="text-xs font-black text-gray-400 mb-3 px-1">عرض {filtered.length} من {entries.length}</p>}
        {filtered.length === 0 ? (
          <div className="bg-white p-14 rounded-2xl border border-dashed border-gray-200 text-center">
            <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-200" />
            <p className="font-black text-gray-400 text-sm">{entries.length === 0 ? 'لم تضف أي حالات بعد' : 'لا نتائج تطابق البحث'}</p>
            {entries.length === 0 && (
              <button onClick={() => setShowForm(true)} className="mt-3 text-xs font-black text-emerald-600 hover:underline flex items-center gap-1 mx-auto"><Plus size={12}/> أضف أول حالة الآن</button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map(e => <EntryCard key={e.id} entry={e} />)}
          </div>
        )}
      </div>
    </div>
  );
}
