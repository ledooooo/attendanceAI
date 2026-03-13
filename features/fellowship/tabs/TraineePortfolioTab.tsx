import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import {
  FileText, Plus, Loader2, Link as LinkIcon, CheckCircle,
  Clock, X, ExternalLink, FolderOpen, BookMarked,
  FlaskConical, Mic2, AlertTriangle, User, Target
} from 'lucide-react';

const COMP_CFG: Record<string, any> = {
  'Case Study':       { icon: FileText,      color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-200' },
  'Research':         { icon: FlaskConical,  color: 'text-violet-600',  bg: 'bg-violet-50',  border: 'border-violet-200' },
  'Journal Club':     { icon: BookMarked,    color: 'text-teal-600',    bg: 'bg-teal-50',    border: 'border-teal-200' },
  'Health Education': { icon: Mic2,          color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  'Incident Report':  { icon: AlertTriangle, color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  'CV':               { icon: User,          color: 'text-rose-600',    bg: 'bg-rose-50',    border: 'border-rose-200' },
};
const getCfg = (t: string) => COMP_CFG[t] || { icon: FolderOpen, color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200' };

const REQUIRED = [
  { type: 'CV', label: 'سيرة ذاتية', req: 1 },
  { type: 'Research', label: 'بحث علمي', req: 1 },
  { type: 'Case Study', label: 'دراسة حالة', req: 4 },
  { type: 'Journal Club', label: 'نادي علمي', req: 4 },
  { type: 'Health Education', label: 'تثقيف صحي', req: 4 },
  { type: 'Incident Report', label: 'تقرير حوادث', req: 1 },
];

function ItemCard({ item }: { item: any }) {
  const cfg = getCfg(item.component_type);
  const Icon = cfg.icon;
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden ${item.supervisor_reviewed ? 'border-r-4 border-r-emerald-400' : 'border-r-4 border-r-gray-200'}`}>
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg} ${cfg.color}`}><Icon size={18} /></div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{item.component_type}</span>
              {item.supervisor_reviewed
                ? <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100"><CheckCircle size={10}/> مراجعة</span>
                : <span className="flex items-center gap-1 text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100"><Clock size={10}/> انتظار</span>
              }
            </div>
            <h4 className="font-black text-gray-800 text-sm mt-2 line-clamp-2 leading-tight">{item.title}</h4>
          </div>
        </div>
        {item.description && <p className="text-xs font-bold text-gray-500 line-clamp-2 mb-3 leading-relaxed">{item.description}</p>}
        <div className="flex items-center justify-between pt-3 border-t border-gray-50">
          <span className="text-[10px] font-bold text-gray-400">{new Date(item.submission_date).toLocaleDateString('ar-EG')}</span>
          <a href={item.file_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[11px] font-black text-indigo-600 hover:text-indigo-800 transition-colors" onClick={e => e.stopPropagation()}>
            <ExternalLink size={12}/> فتح الملف
          </a>
        </div>
      </div>
    </div>
  );
}

export default function TraineePortfolioTab({ employeeId }: { employeeId: string }) {
  const [traineeId, setTraineeId] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [formData, setFormData] = useState({
    title: '', component_type: 'Case Study', file_url: '', description: '',
    submission_date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: t } = await supabase.from('fellowship_trainees').select('id').eq('employee_id', employeeId).single();
        if (t) {
          setTraineeId(t.id);
          const { data } = await supabase.from('fellowship_portfolio_items').select('*').eq('trainee_id', t.id).order('submission_date', { ascending: false });
          setItems(data || []);
        }
      } catch {} finally { setLoading(false); }
    };
    if (employeeId) load();
  }, [employeeId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true);
    try {
      const { data, error } = await supabase.from('fellowship_portfolio_items').insert([{ ...formData, trainee_id: traineeId }]).select().single();
      if (error) throw error;
      toast.success('✅ تم رفع الملف بنجاح');
      setItems([data, ...items]); setShowForm(false);
      setFormData(f => ({ ...f, title: '', file_url: '', description: '' }));
    } catch { toast.error('حدث خطأ'); } finally { setSubmitting(false); }
  };

  const countByType = (t: string) => items.filter(i => i.component_type === t).length;
  const filtered = activeFilter === 'all' ? items : items.filter(i => i.component_type === activeFilter);
  const totalReq = REQUIRED.reduce((s, r) => s + r.req, 0);
  const totalDone = REQUIRED.reduce((s, r) => s + Math.min(countByType(r.type), r.req), 0);
  const pct = Math.round((totalDone / totalReq) * 100);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-28 gap-3">
      <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-blue-600" /></div>
      <p className="text-sm font-bold text-gray-400">جاري تحميل Portfolio...</p>
    </div>
  );
  if (!traineeId) return <div className="p-8 text-center"><p className="font-bold text-gray-500">حساب المتدرب غير مفعّل.</p></div>;

  return (
    <div className="p-4 md:p-6 space-y-5 animate-in fade-in duration-400" dir="rtl">

      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-blue-50 rounded-2xl flex items-center justify-center"><FolderOpen size={22} className="text-blue-600" /></div>
            <div>
              <h2 className="text-base font-black text-gray-800">ملف الإنجاز (Portfolio)</h2>
              <p className="text-[11px] font-semibold text-gray-400">أرفع أعمالك العلمية للمراجعة من المشرف</p>
            </div>
          </div>
          <button onClick={() => setShowForm(!showForm)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm transition-all active:scale-95 ${showForm ? 'bg-gray-100 text-gray-600' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-100'}`}>
            {showForm ? <><X size={15}/> إلغاء</> : <><Plus size={15}/> إضافة عمل</>}
          </button>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-50">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-black text-gray-600 flex items-center gap-1.5"><Target size={12} className="text-blue-500"/> اكتمال Portfolio</span>
            <span className="text-xs font-black text-blue-600">{pct}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-l from-blue-500 to-indigo-400 rounded-full transition-all duration-1000" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[10px] font-semibold text-gray-400 mt-1.5">{totalDone} من {totalReq} عنصر مطلوب</p>
        </div>
      </div>

      {/* Requirements grid */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
        <h3 className="text-xs font-black text-gray-600 mb-4 flex items-center gap-1.5"><CheckCircle size={14} className="text-emerald-500"/> متطلبات Portfolio</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
          {REQUIRED.map(r => {
            const done = countByType(r.type) >= r.req;
            const cfg = getCfg(r.type);
            const Icon = cfg.icon;
            return (
              <div key={r.type} className={`flex items-center gap-2.5 p-3 rounded-xl border ${done ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-100'}`}>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${done ? 'bg-emerald-500 text-white' : `${cfg.bg} ${cfg.color}`}`}>
                  {done ? <CheckCircle size={14}/> : <Icon size={14}/>}
                </div>
                <div className="min-w-0">
                  <p className={`text-[11px] font-black truncate ${done ? 'text-emerald-800' : 'text-gray-700'}`}>{r.label}</p>
                  <p className={`text-[10px] font-bold ${done ? 'text-emerald-600' : 'text-gray-400'}`}>{countByType(r.type)}/{r.req} {done ? '✓' : ''}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-blue-100 shadow-sm space-y-4 animate-in slide-in-from-top-3 duration-300">
          <h3 className="font-black text-gray-700 text-sm border-b pb-3">إضافة عمل جديد</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black text-gray-500 mb-1.5">نوع العمل</label>
              <select value={formData.component_type} onChange={e => setFormData(f => ({...f, component_type: e.target.value}))}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:border-blue-400">
                {Object.keys(COMP_CFG).map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-black text-gray-500 mb-1.5">تاريخ التقديم</label>
              <input type="date" required value={formData.submission_date} onChange={e => setFormData(f => ({...f, submission_date: e.target.value}))}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:border-blue-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-black text-gray-500 mb-1.5">عنوان العمل *</label>
            <input type="text" required value={formData.title} onChange={e => setFormData(f => ({...f, title: e.target.value}))}
              placeholder="مثال: بحث عن انتشار السكري"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
          </div>
          <div>
            <label className="block text-xs font-black text-gray-500 mb-1.5 flex items-center gap-1.5"><LinkIcon size={11}/> رابط الملف *</label>
            <input type="url" required value={formData.file_url} onChange={e => setFormData(f => ({...f, file_url: e.target.value}))}
              placeholder="https://drive.google.com/..."
              className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:border-blue-400 text-left" dir="ltr" />
          </div>
          <button type="submit" disabled={submitting}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-colors active:scale-[0.99] disabled:opacity-50">
            {submitting ? <Loader2 size={17} className="animate-spin"/> : <><CheckCircle size={17}/> حفظ في Portfolio</>}
          </button>
        </form>
      )}

      {/* Filter tabs */}
      {items.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <button onClick={() => setActiveFilter('all')} className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-black transition-all ${activeFilter === 'all' ? 'bg-gray-800 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
            الكل ({items.length})
          </button>
          {Object.keys(COMP_CFG).filter(k => items.some(i => i.component_type === k)).map(type => {
            const cfg = getCfg(type); const Icon = cfg.icon;
            return (
              <button key={type} onClick={() => setActiveFilter(type)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all ${activeFilter === type ? `${cfg.bg} ${cfg.color} border ${cfg.border}` : 'bg-white border border-gray-200 text-gray-600'}`}>
                <Icon size={12}/> {type} ({countByType(type)})
              </button>
            );
          })}
        </div>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white p-14 rounded-2xl border border-dashed border-gray-200 text-center">
          <FolderOpen className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p className="font-black text-gray-400 text-sm">{items.length === 0 ? 'لا يوجد محتوى بعد' : 'لا نتائج'}</p>
          {items.length === 0 && <button onClick={() => setShowForm(true)} className="mt-3 text-xs font-black text-blue-600 hover:underline flex items-center gap-1 mx-auto"><Plus size={12}/> أضف أول عمل</button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(item => <ItemCard key={item.id} item={item} />)}
        </div>
      )}
    </div>
  );
}
