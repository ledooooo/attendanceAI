import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../supabaseClient';
import toast from 'react-hot-toast';
import { 
  MessageCircle, Plus, Loader2, AlertTriangle, FileText, 
  Pill, Activity, XOctagon, Stethoscope, ArrowLeft 
} from 'lucide-react';

export default function PatientConsultations({ patientId }: { patientId: string }) {
    const [consultations, setConsultations] = useState<any[]>([]);
    const [replies, setReplies] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    
    // حالات الشاشات
    const [showForm, setShowForm] = useState(false);
    const [selectedConsultation, setSelectedConsultation] = useState<any | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // نموذج الاستشارة الجديدة
    const [formData, setFormData] = useState({
        specialty: 'طب الأسرة',
        urgency: 'normal',
        consultation_text: '',
        symptoms: '', // سيتم تحويلها لـ JSON Array قبل الحفظ
        bp: '', sugar: '', hr: '', resp: '', // سيتم تجميعها في vitals JSON
        current_meds: '',
        smoking_status: '',
        pregnancy_lactation_status: ''
    });

    const specialties = ['طب الأسرة', 'الأطفال', 'النساء والتوليد', 'الباطنة', 'الأسنان'];

    useEffect(() => {
        if (patientId) fetchConsultations();
    }, [patientId]);

    // جلب الاستشارات مع ردودها إن وجدت
    const fetchConsultations = async () => {
        setLoading(true);
        // 1. جلب الاستشارات
        const { data: consData, error: consError } = await supabase
            .from('consultations')
            .select('*')
            .eq('patient_id', patientId)
            .order('created_at', { ascending: false });

        if (!consError && consData) {
            setConsultations(consData);
            
            // 2. جلب الردود للاستشارات التي تم الرد عليها
            const answeredIds = consData.filter(c => c.status === 'answered' || c.status === 'closed').map(c => c.id);
            if (answeredIds.length > 0) {
                const { data: repliesData } = await supabase
                    .from('consultation_replies')
                    .select('*')
                    .in('consultation_id', answeredIds);
                
                if (repliesData) {
                    const repliesMap: Record<string, any> = {};
                    repliesData.forEach(reply => {
                        repliesMap[reply.consultation_id] = reply;
                    });
                    setReplies(repliesMap);
                }
            }
        }
        setLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        // تجهيز بيانات JSONB
        const symptomsArray = formData.symptoms ? formData.symptoms.split(',').map(s => s.trim()) : [];
        const vitalsObj = {
            bp: formData.bp || null,
            sugar: formData.sugar || null,
            hr: formData.hr || null,
            resp: formData.resp || null
        };

        const payload = {
            patient_id: patientId,
            specialty: formData.specialty,
            urgency: formData.urgency,
            consultation_text: formData.consultation_text,
            symptoms: symptomsArray,
            vitals: vitalsObj,
            current_meds: formData.current_meds,
            smoking_status: formData.smoking_status,
            pregnancy_lactation_status: formData.pregnancy_lactation_status,
            status: 'new'
        };

        const { error } = await supabase.from('consultations').insert(payload);
        
        if (error) {
            toast.error('حدث خطأ أثناء إرسال الاستشارة');
        } else {
            toast.success('تم إرسال الاستشارة بنجاح للأطباء');
            setShowForm(false);
            // تصفير النموذج
            setFormData({
                specialty: 'طب الأسرة', urgency: 'normal', consultation_text: '', symptoms: '',
                bp: '', sugar: '', hr: '', resp: '', current_meds: '', smoking_status: '', pregnancy_lactation_status: ''
            });
            fetchConsultations();
        }
        setSubmitting(false);
    };

    // ─── عرض تفاصيل الرد (الروشتة الذكية) ───
    if (selectedConsultation) {
        const reply = replies[selectedConsultation.id];
        
        return (
            <div className="animate-in fade-in slide-in-from-right-4 space-y-4">
                <button onClick={() => setSelectedConsultation(null)} className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-800 transition">
                    <ArrowLeft size={16} /> العودة لقائمة الاستشارات
                </button>

                {/* كارت الاستشارة (سؤال المريض) */}
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-2 h-full bg-blue-500"></div>
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-2 py-1 rounded-md">{selectedConsultation.specialty}</span>
                            <span className="text-[10px] font-bold text-gray-400 mr-2">{new Date(selectedConsultation.created_at).toLocaleString('ar-EG')}</span>
                        </div>
                    </div>
                    <p className="text-sm font-bold text-gray-800 leading-relaxed bg-gray-50 p-4 rounded-xl">
                        "{selectedConsultation.consultation_text}"
                    </p>
                </div>

                {/* كارت الرد (روشتة الطبيب) */}
                {reply ? (
                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-1 rounded-3xl shadow-md border border-emerald-100">
                        <div className="bg-white p-5 rounded-[1.3rem] relative">
                            <div className="absolute top-4 left-4 w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                                <Stethoscope className="w-6 h-6 text-emerald-600" />
                            </div>
                            
                            <h3 className="text-xl font-black text-emerald-800 mb-6">رد الطبيب (الوصفة الطبية)</h3>

                            <div className="space-y-6">
                                {/* الأدوية */}
                                {reply.prescriptions && reply.prescriptions.length > 0 && (
                                    <div>
                                        <h4 className="text-sm font-black text-gray-700 flex items-center gap-2 border-b pb-2 mb-3"><Pill size={16} className="text-blue-500"/> الأدوية الموصوفة</h4>
                                        <div className="grid gap-2">
                                            {reply.prescriptions.map((med: any, i: number) => (
                                                <div key={i} className="flex flex-col md:flex-row justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                                                    <div>
                                                        <span className="font-black text-gray-800 text-sm block" dir="ltr">{med.name} {med.dose}</span>
                                                        <span className="text-xs font-bold text-gray-500">{med.freq} - لمدة {med.duration}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* التحاليل والأشعات */}
                                {(reply.lab_requests?.length > 0 || reply.radiology_requests?.length > 0) && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {reply.lab_requests?.length > 0 && (
                                            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                                                <h4 className="text-sm font-black text-blue-800 mb-2 flex items-center gap-1"><Activity size={14}/> التحاليل المطلوبة</h4>
                                                <ul className="list-disc list-inside text-xs font-bold text-blue-700 space-y-1" dir="ltr">
                                                    {reply.lab_requests.map((lab: any, i: number) => <li key={i}>{lab.test}</li>)}
                                                </ul>
                                            </div>
                                        )}
                                        {reply.radiology_requests?.length > 0 && (
                                            <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100">
                                                <h4 className="text-sm font-black text-purple-800 mb-2 flex items-center gap-1"><Activity size={14}/> الأشعة المطلوبة</h4>
                                                <ul className="list-disc list-inside text-xs font-bold text-purple-700 space-y-1" dir="ltr">
                                                    {reply.radiology_requests.map((rad: any, i: number) => <li key={i}>{rad.type} - {rad.part}</li>)}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* رسائل التوعية وعلامات الخطر */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {reply.health_messages?.length > 0 && (
                                        <div>
                                            <h4 className="text-sm font-black text-teal-700 flex items-center gap-1 mb-2"><FileText size={14}/> رسائل التثقيف الصحي</h4>
                                            <ul className="text-xs font-bold text-gray-600 space-y-2">
                                                {reply.health_messages.map((msg: string, i: number) => <li key={i} className="bg-teal-50 p-2 rounded-lg border border-teal-100">💡 {msg}</li>)}
                                            </ul>
                                        </div>
                                    )}
                                    {reply.danger_signs && (
                                        <div>
                                            <h4 className="text-sm font-black text-red-700 flex items-center gap-1 mb-2"><AlertTriangle size={14}/> علامات الخطر (توجه للطوارئ فوراً إذا ظهرت)</h4>
                                            <div className="text-xs font-bold text-red-700 bg-red-50 p-3 rounded-xl border border-red-100 leading-relaxed">
                                                {reply.danger_signs}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* تاريخ المتابعة */}
                                {reply.follow_up_date && (
                                    <div className="bg-yellow-50 text-yellow-800 p-3 rounded-xl text-center font-black text-sm border border-yellow-200">
                                        📅 موعد المتابعة القادم: {new Date(reply.follow_up_date).toLocaleDateString('ar-EG')}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-10 bg-white rounded-3xl border border-dashed text-gray-400 font-bold">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-400 mb-2" />
                        الاستشارة قيد المراجعة من قبل الأطباء. يرجى الانتظار.
                    </div>
                )}
            </div>
        );
    }

    // ─── الشاشة الرئيسية للقائمة ───
    return (
        <div className="animate-in fade-in space-y-4">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black text-indigo-800 flex items-center gap-2">
                    <MessageCircle className="text-indigo-600" /> الاستشارات الطبية
                </h2>
                <button onClick={() => setShowForm(!showForm)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-1 hover:bg-indigo-700 transition">
                    <Plus size={16} /> استشارة جديدة
                </button>
            </div>

            {/* نموذج إرسال استشارة جديدة */}
            {showForm && (
                <form onSubmit={handleSubmit} className="bg-white p-5 rounded-3xl shadow-md border border-indigo-100 space-y-4 mb-6">
                    <h3 className="font-black text-indigo-900 border-b pb-3 mb-4 text-lg">طلب استشارة إلكترونية</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm font-bold">
                        <div>
                            <label className="block text-gray-600 mb-1">التخصص المطلوب *</label>
                            <select value={formData.specialty} onChange={e => setFormData({...formData, specialty: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:border-indigo-500">
                                {specialties.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-gray-600 mb-1">درجة الأهمية *</label>
                            <select value={formData.urgency} onChange={e => setFormData({...formData, urgency: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:border-indigo-500">
                                <option value="normal">عادية (رد خلال 24 ساعة)</option>
                                <option value="urgent">عاجلة (رد في أقرب وقت)</option>
                            </select>
                        </div>
                        
                        <div className="md:col-span-2">
                            <label className="block text-gray-600 mb-1">نص الاستشارة بوضوح *</label>
                            <textarea required value={formData.consultation_text} onChange={e => setFormData({...formData, consultation_text: e.target.value})} placeholder="اشرح مشكلتك بالتفصيل..." className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:border-indigo-500" rows={4} />
                        </div>

                        <div className="md:col-span-2 border-t pt-4 mt-2">
                            <p className="text-xs text-indigo-500 mb-3">بيانات اختيارية تساعد الطبيب في التشخيص بدقة أكبر:</p>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-gray-600 mb-1">الأعراض الحالية (افصل بينها بفاصلة ,)</label>
                            <input type="text" value={formData.symptoms} onChange={e => setFormData({...formData, symptoms: e.target.value})} placeholder="مثال: صداع، كحة، حرارة" className="w-full p-3 bg-gray-50 border rounded-xl outline-none" />
                        </div>

                        <div><label className="block text-gray-600 mb-1">أدوية تتناولها حالياً</label><input type="text" value={formData.current_meds} onChange={e => setFormData({...formData, current_meds: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl outline-none" /></div>
                        
                        {/* القياسات الحيوية (Vitals) */}
                        <div className="col-span-1 md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-2 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 mt-2">
                            <div><label className="block text-[10px] text-gray-500 mb-1">الضغط</label><input type="text" value={formData.bp} onChange={e => setFormData({...formData, bp: e.target.value})} placeholder="120/80" dir="ltr" className="w-full p-2 text-xs border rounded-lg" /></div>
                            <div><label className="block text-[10px] text-gray-500 mb-1">السكر</label><input type="text" value={formData.sugar} onChange={e => setFormData({...formData, sugar: e.target.value})} placeholder="100" dir="ltr" className="w-full p-2 text-xs border rounded-lg" /></div>
                            <div><label className="block text-[10px] text-gray-500 mb-1">النبض</label><input type="text" value={formData.hr} onChange={e => setFormData({...formData, hr: e.target.value})} placeholder="80" dir="ltr" className="w-full p-2 text-xs border rounded-lg" /></div>
                            <div><label className="block text-[10px] text-gray-500 mb-1">الحرارة</label><input type="text" value={formData.resp} onChange={e => setFormData({...formData, resp: e.target.value})} placeholder="37.5" dir="ltr" className="w-full p-2 text-xs border rounded-lg" /></div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                        <button type="button" onClick={() => setShowForm(false)} className="px-6 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold">إلغاء</button>
                        <button type="submit" disabled={submitting || !formData.consultation_text} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold flex items-center gap-2 disabled:opacity-50 hover:bg-indigo-700 transition">
                            {submitting ? <Loader2 size={18} className="animate-spin" /> : 'إرسال الاستشارة للطبيب'}
                        </button>
                    </div>
                </form>
            )}

            {/* قائمة الاستشارات */}
            {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-500 w-8 h-8" /></div>
            ) : consultations.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-gray-200">
                    <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-gray-400 font-bold">لا توجد استشارات سابقة.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {consultations.map(cons => (
                        <div key={cons.id} onClick={() => setSelectedConsultation(cons)} className="bg-white p-5 rounded-3xl border shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer relative overflow-hidden">
                            {cons.urgency === 'urgent' && <div className="absolute top-0 right-0 w-2 h-full bg-red-500"></div>}
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                    <span className={`text-[10px] font-black px-2 py-1 rounded-md ${
                                        cons.status === 'new' ? 'bg-yellow-50 text-yellow-600' :
                                        cons.status === 'answered' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-600'
                                    }`}>
                                        {cons.status === 'new' ? 'قيد المراجعة ⏳' : cons.status === 'answered' ? 'تم الرد ✅' : 'مغلقة 🔒'}
                                    </span>
                                    <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-2 py-1 rounded-md">{cons.specialty}</span>
                                </div>
                                <span className="text-[10px] font-bold text-gray-400">{new Date(cons.created_at).toLocaleDateString('ar-EG')}</span>
                            </div>
                            <p className="text-sm text-gray-700 font-bold leading-relaxed line-clamp-2 mt-3">
                                {cons.consultation_text}
                            </p>
                            {cons.status === 'answered' && (
                                <div className="mt-4 pt-3 border-t border-gray-50 flex items-center gap-1 text-[11px] font-black text-emerald-600">
                                    <Stethoscope size={14}/> اضغط هنا لفتح الروشتة وقراءة رد الطبيب
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
