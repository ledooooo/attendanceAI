'use client';

import React, { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { useAuth } from '../../../context/AuthContext';
import toast from 'react-hot-toast';
import { 
  User, Activity, FileText, Heart, Users, Home, 
  ArrowRight, ArrowLeft, CheckCircle2, Loader2, AlertCircle 
} from 'lucide-react';

const FAMILY_HISTORY_OPTIONS = ['قلب', 'ضغط', 'سكر', 'أورام', 'أمراض وراثية', 'كلى', 'كبد', 'أمراض دم', 'صرع', 'أزمة ربوية'];

export default function MedicalProfileWizard({ onComplete }: { onComplete: () => void }) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // 1. حالة النموذج (تطابق تماماً قاعدة بيانات SQL)
  const [formData, setFormData] = useState({
    // Step 1: البيانات الشخصية
    full_name: user?.user_metadata?.full_name || '',
    phone: '',
    national_id: '',
    address: '',
    marital_status: 'أعزب', // أعزب، متزوج، مطلق، أرمل
    gender: 'ذكر', // ذكر، أنثى
    is_head_of_family: false,
    birth_date: '',
    
    // Step 2: القياسات الحيوية
    blood_group: 'غير معروف',
    weight: '',
    height: '',
    
    // Step 3: التاريخ المرضي (الجزء الأول)
    has_chronic_diseases: false, chronic_diseases_notes: '',
    has_tumors: false, tumors_notes: '',
    has_current_medications: false, current_medications_notes: '',
    past_surgeries: '',
    
    // Step 4: التاريخ المرضي (الجزء الثاني)
    is_pregnant_or_lactating: false, pregnancy_lactation_notes: '',
    is_smoking: false, smoking_notes: '',
    has_drug_allergies: false, drug_allergies_notes: '',
    has_food_allergies: false, food_allergies_notes: '',
    has_physical_disability: false, disability_notes: '',
    has_psychiatric_illness: false, psychiatric_illness_notes: '',
    
    // Step 5: التاريخ العائلي
    has_family_history: false,
    family_history_details: [] as string[],
    
    // Step 6: المحددات الاجتماعية والصحية
    has_comprehensive_insurance: false,
    has_fixed_income: false,
    breeds_pets: false,
    breeds_livestock: false,
    has_good_ventilation: false,
    has_sewage_system: false,
  });

  const totalSteps = 6;
  const progress = (currentStep / totalSteps) * 100;

  // التعامل مع إدخال النصوص والأرقام
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // التعامل مع الـ Checkboxes (نعم/لا)
  const handleToggle = (name: string) => {
    setFormData(prev => ({ ...prev, [name]: !(prev as any)[name] }));
  };

  // التعامل مع مصفوفة التاريخ العائلي (JSONB)
  const toggleFamilyHistoryItem = (item: string) => {
    setFormData(prev => {
      const current = prev.family_history_details;
      const updated = current.includes(item) 
        ? current.filter(i => i !== item) 
        : [...current, item];
      return { ...prev, family_history_details: updated };
    });
  };

  // إرسال البيانات لقاعدة البيانات
  const handleSubmit = async () => {
    if (!user?.id) return;
    setLoading(true);
    
    try {
      const { error } = await supabase.from('patients').insert({
        user_id: user.id,
        ...formData,
        weight: formData.weight ? parseFloat(formData.weight) : null,
        height: formData.height ? parseFloat(formData.height) : null,
        birth_date: formData.birth_date || null
      });

      if (error) throw error;
      
      toast.success('تم إنشاء ملفك الطبي بنجاح!');
      onComplete(); // دالة لإخفاء المعالج وإظهار لوحة المريض
      
    } catch (error: any) {
      toast.error(error.message || 'حدث خطأ أثناء حفظ البيانات');
    } finally {
      setLoading(false);
    }
  };

  // --- مكون مساعد (Helper) لرسم أزرار نعم/لا مع حقل تفاصيل ---
  const renderToggleField = (label: string, fieldName: keyof typeof formData, notesName?: keyof typeof formData, notesPlaceholder?: string) => (
    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-4">
      <div className="flex justify-between items-center mb-2">
        <label className="text-sm font-bold text-gray-700">{label}</label>
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button type="button" onClick={() => setFormData(p => ({ ...p, [fieldName]: true }))} className={`px-4 py-1.5 rounded-md text-xs font-black transition-all ${formData[fieldName] ? 'bg-blue-600 text-white shadow' : 'text-gray-500 hover:text-gray-700'}`}>نعم</button>
          <button type="button" onClick={() => setFormData(p => ({ ...p, [fieldName]: false }))} className={`px-4 py-1.5 rounded-md text-xs font-black transition-all ${!formData[fieldName] ? 'bg-white text-gray-800 shadow' : 'text-gray-500 hover:text-gray-700'}`}>لا</button>
        </div>
      </div>
      {(formData[fieldName] && notesName) && (
        <textarea name={notesName} value={formData[notesName] as string} onChange={handleInputChange} placeholder={notesPlaceholder || "يرجى التوضيح..."} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs mt-2 outline-none focus:border-blue-500 transition-colors" rows={2} />
      )}
    </div>
  );

  // --- محتوى الخطوات ---
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <h3 className="text-lg font-black text-blue-700 flex items-center gap-2 mb-4"><User className="w-5 h-5"/> البيانات الشخصية</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-xs font-bold text-gray-600 mb-1">الاسم رباعي *</label><input type="text" name="full_name" value={formData.full_name} onChange={handleInputChange} className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:border-blue-500" required /></div>
              <div><label className="block text-xs font-bold text-gray-600 mb-1">الرقم القومي *</label><input type="text" name="national_id" value={formData.national_id} onChange={handleInputChange} maxLength={14} className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:border-blue-500" dir="ltr" required /></div>
              <div><label className="block text-xs font-bold text-gray-600 mb-1">رقم الهاتف</label><input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:border-blue-500" dir="ltr" /></div>
              <div><label className="block text-xs font-bold text-gray-600 mb-1">تاريخ الميلاد</label><input type="date" name="birth_date" value={formData.birth_date} onChange={handleInputChange} className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:border-blue-500" /></div>
              <div className="md:col-span-2"><label className="block text-xs font-bold text-gray-600 mb-1">العنوان بالتفصيل</label><input type="text" name="address" value={formData.address} onChange={handleInputChange} className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:border-blue-500" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">النوع</label>
                <select name="gender" value={formData.gender} onChange={handleInputChange} className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:border-blue-500">
                  <option value="ذكر">ذكر</option><option value="أنثى">أنثى</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">الحالة الاجتماعية</label>
                <select name="marital_status" value={formData.marital_status} onChange={handleInputChange} className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:border-blue-500">
                  <option value="أعزب">أعزب</option><option value="متزوج">متزوج</option><option value="مطلق">مطلق</option><option value="أرمل">أرمل</option>
                </select>
              </div>
            </div>
            {renderToggleField('هل أنت رب الأسرة؟', 'is_head_of_family')}
          </div>
        );
      
      case 2:
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <h3 className="text-lg font-black text-rose-600 flex items-center gap-2 mb-4"><Activity className="w-5 h-5"/> القياسات الحيوية</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">فصيلة الدم</label>
                <select name="blood_group" value={formData.blood_group} onChange={handleInputChange} className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:border-rose-500 text-left font-bold" dir="ltr">
                  <option value="غير معروف">غير معروف</option>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => <option key={bg} value={bg}>{bg}</option>)}
                </select>
              </div>
              <div><label className="block text-xs font-bold text-gray-600 mb-1">الوزن (كجم)</label><input type="number" name="weight" value={formData.weight} onChange={handleInputChange} className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:border-rose-500" placeholder="مثال: 75" dir="ltr" /></div>
              <div><label className="block text-xs font-bold text-gray-600 mb-1">الطول (سم)</label><input type="number" name="height" value={formData.height} onChange={handleInputChange} className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:border-rose-500" placeholder="مثال: 170" dir="ltr" /></div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-2 animate-in fade-in slide-in-from-bottom-4">
            <h3 className="text-lg font-black text-emerald-600 flex items-center gap-2 mb-4"><FileText className="w-5 h-5"/> التاريخ المرضي والأدوية</h3>
            {renderToggleField('هل تعاني من أمراض مزمنة؟ (ضغط، سكر، الخ)', 'has_chronic_diseases', 'chronic_diseases_notes', 'اذكر الأمراض المزمنة...')}
            {renderToggleField('هل تتناول أدوية بانتظام حالياً؟', 'has_current_medications', 'current_medications_notes', 'اذكر أسماء الأدوية والجرعات...')}
            {renderToggleField('هل يوجد تاريخ للإصابة بالأورام؟', 'has_tumors', 'tumors_notes', 'اذكر نوع الورم وتاريخ الإصابة...')}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mt-4">
              <label className="text-sm font-bold text-gray-700 block mb-2">عمليات جراحية سابقة</label>
              <textarea name="past_surgeries" value={formData.past_surgeries} onChange={handleInputChange} placeholder="اذكر العمليات وتواريخها التقريبية إن وُجدت..." className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:border-emerald-500" rows={3} />
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-2 animate-in fade-in slide-in-from-bottom-4">
            <h3 className="text-lg font-black text-amber-600 flex items-center gap-2 mb-4"><AlertCircle className="w-5 h-5"/> الحساسية والعادات</h3>
            {formData.gender === 'أنثى' && renderToggleField('هل يوجد حمل أو رضاعة حالياً؟', 'is_pregnant_or_lactating', 'pregnancy_lactation_notes', 'اذكري شهر الحمل أو عمر الرضيع...')}
            {renderToggleField('هل تدخن؟', 'is_smoking', 'smoking_notes', 'اذكر النوع (سجائر، فيب) والكمية يومياً...')}
            {renderToggleField('هل تعاني من حساسية تجاه أدوية معينة؟', 'has_drug_allergies', 'drug_allergies_notes', 'اذكر اسم الدواء ونوع الحساسية...')}
            {renderToggleField('هل تعاني من حساسية تجاه أطعمة معينة؟', 'has_food_allergies', 'food_allergies_notes', 'اذكر الأطعمة...')}
            {renderToggleField('هل توجد إعاقة جسدية؟', 'has_physical_disability', 'disability_notes', 'وصف الإعاقة...')}
            {renderToggleField('هل تتابع لأي أمراض أو اضطرابات نفسية؟', 'has_psychiatric_illness', 'psychiatric_illness_notes', 'وصف الحالة...')}
          </div>
        );

      case 5:
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <h3 className="text-lg font-black text-purple-600 flex items-center gap-2 mb-4"><Users className="w-5 h-5"/> التاريخ العائلي</h3>
            {renderToggleField('هل يوجد تاريخ مرضي في العائلة لأمراض وراثية أو مزمنة؟', 'has_family_history')}
            
            {formData.has_family_history && (
              <div className="bg-purple-50/50 p-4 rounded-2xl border border-purple-100 animate-in zoom-in-95">
                <p className="text-xs font-bold text-gray-600 mb-3">حدد الأمراض الموجودة في العائلة (اختر من المتعدد):</p>
                <div className="flex flex-wrap gap-2">
                  {FAMILY_HISTORY_OPTIONS.map(item => {
                    const isSelected = formData.family_history_details.includes(item);
                    return (
                      <button 
                        key={item} type="button" onClick={() => toggleFamilyHistoryItem(item)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all border ${isSelected ? 'bg-purple-600 text-white border-purple-600 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'}`}
                      >
                        {item} {isSelected && '✓'}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        );

      case 6:
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <h3 className="text-lg font-black text-teal-600 flex items-center gap-2 mb-4"><Home className="w-5 h-5"/> المحددات الاجتماعية والبيئية</h3>
            <p className="text-xs text-gray-500 font-bold mb-4">هذه المعلومات تساعدنا في تقييم المخاطر البيئية والصحية المحيطة بك بدقة أكبر.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { label: 'هل لديك تأمين صحي شامل؟', field: 'has_comprehensive_insurance' },
                { label: 'هل يوجد دخل شهري ثابت للأسرة؟', field: 'has_fixed_income' },
                { label: 'هل تقوم بتربية حيوانات أليفة بالمنزل؟', field: 'breeds_pets' },
                { label: 'هل توجد حظيرة أو حيوانات طيور/مواشي؟', field: 'breeds_livestock' },
                { label: 'هل يوجد تهوية جيدة وتشميس للمنزل؟', field: 'has_good_ventilation' },
                { label: 'هل يوجد صرف صحي آمن للمنزل؟', field: 'has_sewage_system' },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100 shadow-sm cursor-pointer hover:border-teal-200 transition-colors" onClick={() => handleToggle(item.field)}>
                  <span className="text-xs font-bold text-gray-700">{item.label}</span>
                  <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 relative ${(formData as any)[item.field] ? 'bg-teal-500' : 'bg-gray-200'}`}>
                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-300 ${(formData as any)[item.field] ? 'translate-x-[-24px]' : 'translate-x-0'}`}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 py-10 font-sans text-right" dir="rtl">
      <div className="w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
        
        {/* Header & Progress */}
        <div className="bg-gradient-to-l from-blue-600 to-indigo-600 p-6 text-white shrink-0">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-black flex items-center gap-2"><Heart className="w-6 h-6"/> الملف الطبي الشامل</h2>
            <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-black">خطوة {currentStep} من {totalSteps}</span>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-white/20 rounded-full h-2 mb-2 overflow-hidden">
            <div className="bg-green-400 h-2 rounded-full transition-all duration-500 ease-out" style={{ width: `${progress}%` }}></div>
          </div>
          <div className="flex justify-between text-[10px] font-bold text-blue-100">
            <span>البداية</span>
            <span>النهاية</span>
          </div>
        </div>

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-gray-50/50">
          {renderStepContent()}
        </div>

        {/* Footer Buttons */}
        <div className="p-4 border-t bg-white flex justify-between items-center shrink-0">
          <button 
            onClick={() => setCurrentStep(p => Math.max(1, p - 1))} 
            disabled={currentStep === 1 || loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-gray-500 font-bold text-sm hover:bg-gray-100 disabled:opacity-30 transition-colors"
          >
            <ArrowRight size={18}/> السابق
          </button>

          {currentStep < totalSteps ? (
            <button 
              onClick={() => setCurrentStep(p => Math.min(totalSteps, p + 1))}
              disabled={currentStep === 1 && (!formData.full_name || !formData.national_id)} // منع التخطي إذا لم يُدخل الاسم والرقم القومي
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-black text-sm shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 transition-all"
            >
              التالي <ArrowLeft size={18}/>
            </button>
          ) : (
            <button 
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 bg-green-500 text-white rounded-xl font-black text-sm shadow-lg shadow-green-200 hover:bg-green-600 disabled:opacity-50 transition-all animate-pulse hover:animate-none"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin"/> : <CheckCircle2 className="w-5 h-5"/>}
              حفظ وإنهاء الملف
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
