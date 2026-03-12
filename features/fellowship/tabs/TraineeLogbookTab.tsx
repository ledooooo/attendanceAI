import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import { 
  BookOpen, Plus, FileText, CheckCircle, Clock, 
  Stethoscope, Syringe, Eye, AlertCircle, Loader2, Calendar
} from 'lucide-react';

interface LogbookEntry {
  id: string;
  entry_date: string;
  entry_type: 'case' | 'procedure' | 'skill' | 'observation';
  description: string;
  diagnosis: string;
  trainer_reviewed: boolean;
  trainer_comments: string;
  created_at: string;
}

export default function TraineeLogbookTab({ employeeId }: { employeeId: string }) {
  const [traineeId, setTraineeId] = useState<string | null>(null);
  const [entries, setEntries] = useState<LogbookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    entry_date: new Date().toISOString().split('T')[0],
    entry_type: 'case',
    diagnosis: '',
    description: ''
  });

  // 1. جلب بيانات المتدرب وسجل الحالات
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // أولاً: البحث عن رقم المتدرب (Trainee ID) المرتبط بهذا الموظف
        const { data: traineeData, error: traineeError } = await supabase
          .from('fellowship_trainees')
          .select('id')
          .eq('employee_id', employeeId)
          .single();

        if (traineeError || !traineeData) {
          console.warn("Trainee profile not found");
          setLoading(false);
          return;
        }

        setTraineeId(traineeData.id);

        // ثانياً: جلب سجل الحالات الخاص به
        const { data: logbookData, error: logbookError } = await supabase
          .from('fellowship_logbook')
          .select('*')
          .eq('trainee_id', traineeData.id)
          .order('entry_date', { ascending: false });

        if (logbookError) throw logbookError;
        setEntries(logbookData || []);

      } catch (error) {
        console.error('Error fetching logbook:', error);
        toast.error('حدث خطأ أثناء تحميل السجل');
      } finally {
        setLoading(false);
      }
    };

    if (employeeId) fetchData();
  }, [employeeId]);

  // 2. دالة إرسال حالة جديدة
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!traineeId) {
      toast.error('ملفك كمتدرب غير مكتمل، يرجى مراجعة الإدارة.');
      return;
    }

    setSubmitting(true);
    try {
      const newEntry = {
        trainee_id: traineeId,
        entry_date: formData.entry_date,
        entry_type: formData.entry_type,
        diagnosis: formData.diagnosis,
        description: formData.description,
      };

      const { data, error } = await supabase
        .from('fellowship_logbook')
        .insert(newEntry)
        .select()
        .single();

      if (error) throw error;

      toast.success('تم تسجيل الحالة بنجاح بانتظار مراجعة المدرب!');
      setEntries([data, ...entries]);
      setShowForm(false); // إخفاء النموذج بعد النجاح
      setFormData({ ...formData, diagnosis: '', description: '' }); // تفريغ الحقول

    } catch (error) {
      console.error('Error adding entry:', error);
      toast.error('حدث خطأ أثناء حفظ الحالة');
    } finally {
      setSubmitting(false);
    }
  };

  // دالة مساعدة لاختيار الأيقونة واللون حسب نوع الإدخال
  const getTypeConfig = (type: string) => {
    switch (type) {
      case 'case': return { label: 'حالة مرضية', icon: Stethoscope, color: 'text-blue-600', bg: 'bg-blue-50' };
      case 'procedure': return { label: 'إجراء طبي', icon: Syringe, color: 'text-rose-600', bg: 'bg-rose-50' };
      case 'skill': return { label: 'تطبيق مهارة', icon: FileText, color: 'text-emerald-600', bg: 'bg-emerald-50' };
      case 'observation': return { label: 'ملاحظة', icon: Eye, color: 'text-purple-600', bg: 'bg-purple-50' };
      default: return { label: 'أخرى', icon: FileText, color: 'text-gray-600', bg: 'bg-gray-50' };
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-indigo-600">
        <Loader2 className="w-10 h-10 animate-spin mb-4" />
        <p className="font-bold text-sm">جاري تحميل سجل الحالات...</p>
      </div>
    );
  }

  // إذا لم يكن مسجلاً في جدول المتدربين
  if (!traineeId && !loading) {
    return (
      <div className="p-6 text-center animate-in fade-in">
        <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4 text-orange-500">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-black text-gray-800 mb-2">ملف المتدرب غير مفعل</h2>
        <p className="text-sm font-bold text-gray-500 max-w-sm mx-auto">
          حسابك كموظف يعمل بنجاح، لكن لم يتم تسجيل بياناتك كمتدرب زمالة في قاعدة البيانات بعد. يرجى التواصل مع إدارة التدريب لإضافة كود الزمالة الخاص بك.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6 animate-in fade-in">
      
      {/* الهيدر وزر الإضافة */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
            <BookOpen className="text-emerald-600" /> سجل الحالات (Logbook)
          </h2>
          <p className="text-xs font-bold text-gray-500 mt-1">سجل يومياتك الطبية والإجراءات التي قمت بها ليتم تقييمها.</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 hover:bg-emerald-700 transition-colors w-full sm:w-auto justify-center"
        >
          {showForm ? <><X size={18}/> إلغاء</> : <><Plus size={18}/> إضافة حالة جديدة</>}
        </button>
      </div>

      {/* نموذج الإضافة */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-3xl shadow-sm border border-emerald-100 animate-in slide-in-from-top-4 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">تاريخ الحالة *</label>
              <div className="relative">
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="date" required
                  value={formData.entry_date} 
                  onChange={e => setFormData({...formData, entry_date: e.target.value})}
                  className="w-full pl-4 pr-10 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-emerald-500 text-sm font-bold"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">نوع الإدخال *</label>
              <select 
                value={formData.entry_type} 
                onChange={e => setFormData({...formData, entry_type: e.target.value as any})}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-emerald-500 text-sm font-bold"
              >
                <option value="case">حالة مرضية (Case)</option>
                <option value="procedure">إجراء طبي (Procedure)</option>
                <option value="skill">تطبيق مهارة (Skill)</option>
                <option value="observation">ملاحظة (Observation)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5">التشخيص (Diagnosis) *</label>
            <input 
              type="text" required placeholder="مثال: Acute Pharyngitis"
              value={formData.diagnosis} 
              onChange={e => setFormData({...formData, diagnosis: e.target.value})}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-emerald-500 text-sm font-bold"
              dir="auto"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5">وصف الحالة أو الإجراء (Description) *</label>
            <textarea 
              required placeholder="اكتب ملخصاً للحالة، الأعراض، والإجراءات التي قمت بها..."
              value={formData.description} 
              onChange={e => setFormData({...formData, description: e.target.value})}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-emerald-500 text-sm font-bold h-24 resize-none"
              dir="auto"
            />
          </div>

          <button 
            type="submit" disabled={submitting}
            className="w-full py-3 bg-emerald-600 text-white rounded-xl font-black text-sm hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting ? <Loader2 size={18} className="animate-spin"/> : <><CheckCircle size={18}/> حفظ في السجل</>}
          </button>
        </form>
      )}

      {/* قائمة السجلات */}
      <div className="space-y-4">
        <h3 className="font-black text-gray-800 text-lg px-2">سجلاتي السابقة ({entries.length})</h3>
        
        {entries.length === 0 ? (
          <div className="bg-white p-10 rounded-3xl shadow-sm border border-gray-100 text-center text-gray-400">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-bold text-sm">لم تقم بإضافة أي حالات بعد.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {entries.map(entry => {
              const typeConfig = getTypeConfig(entry.entry_type);
              const Icon = typeConfig.icon;
              
              return (
                <div key={entry.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:border-gray-200 transition-all flex flex-col">
                  
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${typeConfig.bg} ${typeConfig.color}`}>
                        <Icon size={18} />
                      </div>
                      <div>
                        <p className={`text-[10px] font-black ${typeConfig.color}`}>{typeConfig.label}</p>
                        <p className="text-xs font-bold text-gray-500 mt-0.5">{new Date(entry.entry_date).toLocaleDateString('ar-EG')}</p>
                      </div>
                    </div>
                    
                    {/* حالة المراجعة */}
                    {entry.trainer_reviewed ? (
                      <span className="flex items-center gap-1 text-[10px] font-black bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-md border border-emerald-100">
                        <CheckCircle size={12} /> تم الاعتماد
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-black bg-amber-50 text-amber-600 px-2.5 py-1 rounded-md border border-amber-100">
                        <Clock size={12} /> بانتظار المراجعة
                      </span>
                    )}
                  </div>

                  <h4 className="font-black text-gray-800 text-sm mb-2 line-clamp-1" dir="auto">{entry.diagnosis}</h4>
                  <p className="text-xs text-gray-500 font-bold leading-relaxed line-clamp-2 mb-4 flex-1" dir="auto">
                    {entry.description}
                  </p>

                  {/* تعليق المدرب (إن وجد) */}
                  {entry.trainer_reviewed && entry.trainer_comments && (
                    <div className="mt-auto bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <p className="text-[10px] font-black text-gray-400 mb-1">تعليق المدرب:</p>
                      <p className="text-xs font-bold text-indigo-700 leading-relaxed" dir="auto">"{entry.trainer_comments}"</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
