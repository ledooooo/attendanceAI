import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import { FileText, Plus, Loader2, Link as LinkIcon, CheckCircle, Clock, AlertCircle } from 'lucide-react';

export default function TraineePortfolioTab({ employeeId }: { employeeId: string }) {
  const [traineeId, setTraineeId] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    component_type: 'Case Study',
    file_url: '',
    description: '',
    submission_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: trainee } = await supabase.from('fellowship_trainees').select('id').eq('employee_id', employeeId).single();
        if (trainee) {
          setTraineeId(trainee.id);
          const { data: portfolio } = await supabase.from('fellowship_portfolio_items').select('*').eq('trainee_id', trainee.id).order('submission_date', { ascending: false });
          setItems(portfolio || []);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    if (employeeId) fetchData();
  }, [employeeId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data, error } = await supabase.from('fellowship_portfolio_items').insert([{ ...formData, trainee_id: traineeId }]).select().single();
      if (error) throw error;
      toast.success('تم رفع الملف بنجاح');
      setItems([data, ...items]);
      setShowForm(false);
      setFormData({ ...formData, title: '', file_url: '', description: '' });
    } catch (error) {
      toast.error('حدث خطأ أثناء الحفظ');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" /></div>;
  if (!traineeId) return <div className="text-center py-20 font-bold text-gray-500">حساب المتدرب غير مفعل.</div>;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6 animate-in fade-in" dir="rtl">
      
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-xl font-black text-gray-800 flex items-center gap-2"><FileText className="text-blue-600"/> ملف الإنجاز (Portfolio)</h2>
          <p className="text-xs font-bold text-gray-500 mt-1">أضف روابط لأبحاثك، دراسات الحالة، والعروض التقديمية.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-black flex items-center gap-2">
          {showForm ? 'إلغاء' : <><Plus size={18}/> إضافة عمل جديد</>}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-3xl shadow-sm border border-blue-100 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">نوع العمل</label>
              <select value={formData.component_type} onChange={e => setFormData({...formData, component_type: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl outline-none font-bold text-sm">
                <option value="Case Study">دراسة حالة (Case Study)</option>
                <option value="Research">بحث علمي (Research)</option>
                <option value="Journal Club">نادي علمي (Journal Club)</option>
                <option value="Health Education">تثقيف صحي (Health Education)</option>
                <option value="Incident Report">تقرير حوادث (Incident Report)</option>
                <option value="CV">سيرة ذاتية (CV)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">تاريخ التقديم</label>
              <input type="date" required value={formData.submission_date} onChange={e => setFormData({...formData, submission_date: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl outline-none font-bold text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">عنوان العمل</label>
            <input type="text" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="مثال: بحث عن انتشار السكري" className="w-full p-3 bg-gray-50 border rounded-xl outline-none font-bold text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">رابط الملف (Google Drive / OneDrive)</label>
            <div className="relative">
              <LinkIcon className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
              <input type="url" required value={formData.file_url} onChange={e => setFormData({...formData, file_url: e.target.value})} placeholder="https://..." className="w-full pl-4 pr-10 py-3 bg-gray-50 border rounded-xl outline-none font-bold text-sm text-left" dir="ltr" />
            </div>
          </div>
          <button type="submit" disabled={submitting} className="w-full bg-blue-600 text-white py-3 rounded-xl font-black">{submitting ? 'جاري الحفظ...' : 'حفظ في ملف الإنجاز'}</button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map(item => (
          <div key={item.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
            <div className="flex justify-between items-start mb-2">
              <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-lg text-[10px] font-black">{item.component_type}</span>
              {item.supervisor_reviewed ? (
                <span className="text-emerald-500 flex items-center gap-1 text-[10px] font-black"><CheckCircle size={14}/> تمت المراجعة</span>
              ) : (
                <span className="text-amber-500 flex items-center gap-1 text-[10px] font-black"><Clock size={14}/> قيد المراجعة</span>
              )}
            </div>
            <h4 className="font-black text-gray-800 text-sm mb-3 line-clamp-1">{item.title}</h4>
            <a href={item.file_url} target="_blank" rel="noopener noreferrer" className="mt-auto flex items-center justify-center gap-2 bg-gray-50 hover:bg-gray-100 text-gray-600 py-2 rounded-xl text-xs font-bold transition-colors">
              <LinkIcon size={14} /> فتح الملف الخارجي
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
