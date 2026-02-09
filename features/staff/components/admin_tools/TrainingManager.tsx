import React, { useState } from 'react';
import { supabase } from '../../../../supabaseClient'; // تأكد من المسار حسب هيكل مشروعك
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    Plus, Save, Trash2, BookOpen, MapPin, Layers, 
    Loader2, Image as ImageIcon, Video, X, CheckCircle, AlertCircle 
} from 'lucide-react';
import { Input, Select } from '../../../../components/ui/FormElements'; // تأكد من المسار
import toast from 'react-hot-toast';

export default function TrainingManager() {
    const queryClient = useQueryClient();
    const [showModal, setShowModal] = useState(false);
    const [uploading, setUploading] = useState<number | null>(null); // لتحديد أي شريحة يتم رفع ملف لها حالياً

    // الحالة المبدئية للنموذج
    const initialFormState = {
        title: '',
        type: 'internal', // internal, external, online
        location: '',
        training_date: '',
        is_mandatory: 'false',
        points: 10,
        slides: [{ title: 'مقدمة', content: '', mediaUrl: '', mediaType: 'none' }] 
    };

    const [formData, setFormData] = useState(initialFormState);

    // 1. جلب التدريبات
    const { data: trainings = [], isLoading } = useQuery({
        queryKey: ['admin_trainings'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('trainings')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        }
    });

    // 2. إنشاء تدريب جديد
    const createMutation = useMutation({
        mutationFn: async (newTraining: any) => {
            // تنظيف البيانات قبل الإرسال
            const payload = {
                ...newTraining,
                points: Number(newTraining.points),
                is_mandatory: newTraining.is_mandatory === 'true',
                // التأكد من أن التاريخ صالح أو null
                training_date: newTraining.training_date ? newTraining.training_date : null
            };

            const { error } = await supabase.from('trainings').insert([payload]);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success('تم نشر التدريب بنجاح');
            setShowModal(false);
            setFormData(initialFormState);
            queryClient.invalidateQueries({ queryKey: ['admin_trainings'] });
        },
        onError: (err: any) => toast.error('حدث خطأ: ' + err.message)
    });

    // 3. حذف تدريب
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('trainings').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success('تم حذف التدريب');
            queryClient.invalidateQueries({ queryKey: ['admin_trainings'] });
        },
        onError: () => toast.error('فشل الحذف')
    });

    // --- دوال التعامل مع الشرائح والملفات ---

    const handleFileUpload = async (event: any, index: number) => {
        const file = event.target.files[0];
        if (!file) return;

        // التحقق من الحجم (مثلاً 50 ميجا كحد أقصى للفيديو)
        if (file.size > 50 * 1024 * 1024) {
            return toast.error("حجم الملف كبير جداً (الحد الأقصى 50 ميجا)");
        }

        setUploading(index);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `slides/${fileName}`;

            // رفع الملف
            const { error: uploadError } = await supabase.storage
                .from('training-media')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // الحصول على الرابط
            const { data: { publicUrl } } = supabase.storage
                .from('training-media')
                .getPublicUrl(filePath);

            // تحديد النوع
            const type = file.type.startsWith('video') ? 'video' : 'image';

            // تحديث الشريحة
            const newSlides = [...formData.slides];
            // @ts-ignore
            newSlides[index].mediaUrl = publicUrl;
            // @ts-ignore
            newSlides[index].mediaType = type;
            setFormData({ ...formData, slides: newSlides });

            toast.success('تم رفع الملف بنجاح');
        } catch (error: any) {
            console.error(error);
            toast.error('فشل الرفع: تأكد من إنشاء Bucket باسم training-media');
        } finally {
            setUploading(null);
        }
    };

    const addSlide = () => {
        setFormData({ 
            ...formData, 
            slides: [...formData.slides, { title: '', content: '', mediaUrl: '', mediaType: 'none' }] 
        });
    };

    const removeSlide = (index: number) => {
        if (formData.slides.length === 1) return toast.error("يجب أن يحتوي التدريب على شريحة واحدة على الأقل");
        const newSlides = formData.slides.filter((_, i) => i !== index);
        setFormData({ ...formData, slides: newSlides });
    };

    const updateSlide = (index: number, field: string, value: string) => {
        const newSlides = [...formData.slides];
        // @ts-ignore
        newSlides[index][field] = value;
        setFormData({ ...formData, slides: newSlides });
    };

    const removeMedia = (index: number) => {
        const newSlides = [...formData.slides];
        // @ts-ignore
        newSlides[index].mediaUrl = '';
        // @ts-ignore
        newSlides[index].mediaType = 'none';
        setFormData({ ...formData, slides: newSlides });
    };

    return (
        <div className="space-y-6 animate-in fade-in pb-20">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-indigo-50 gap-4">
                <div>
                    <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                        <BookOpen className="w-8 h-8 text-indigo-600"/> إدارة التدريب والتعليم المستمر
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">إنشاء ومتابعة البرامج التدريبية للموظفين</p>
                </div>
                <button onClick={() => setShowModal(true)} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95">
                    <Plus className="w-5 h-5"/> تدريب جديد
                </button>
            </div>

            {/* Training List */}
            {isLoading ? (
                <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-indigo-600"/></div>
            ) : trainings.length === 0 ? (
                <div className="text-center p-10 bg-gray-50 rounded-3xl border border-dashed">
                    <p className="text-gray-400 font-bold">لا توجد تدريبات متاحة حالياً</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {trainings.map((t: any) => (
                        <div key={t.id} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                            {/* Decorative Bar */}
                            <div className={`absolute top-0 right-0 left-0 h-2 ${t.type === 'online' ? 'bg-purple-500' : t.type === 'external' ? 'bg-orange-500' : 'bg-blue-500'}`}></div>
                            
                            <div className="flex justify-between items-start mt-2">
                                <div>
                                    <h3 className="font-bold text-lg text-gray-800 mb-1 line-clamp-1">{t.title}</h3>
                                    <p className="text-xs text-gray-500 font-bold flex items-center gap-1">
                                        <MapPin className="w-3 h-3"/> {t.type === 'online' ? 'تطبيق (Online)' : t.location || 'داخل المركز'}
                                    </p>
                                </div>
                                {t.is_mandatory && <span className="bg-red-50 text-red-600 text-[10px] font-black px-2 py-1 rounded-full border border-red-100">إجباري</span>}
                            </div>

                            <div className="mt-6 flex justify-between items-center border-t border-gray-50 pt-4">
                                <div className="flex gap-3">
                                    <span className="text-xs font-bold text-gray-500 bg-gray-50 px-2 py-1 rounded-lg flex items-center gap-1">
                                        <Layers className="w-3 h-3"/> {t.slides?.length || 0}
                                    </span>
                                    <span className="text-xs font-bold text-yellow-600 bg-yellow-50 px-2 py-1 rounded-lg flex items-center gap-1">
                                        {t.points} نقطة
                                    </span>
                                </div>
                                <button 
                                    onClick={() => { if(confirm('هل أنت متأكد من حذف هذا التدريب؟')) deleteMutation.mutate(t.id); }}
                                    className="text-red-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4"/>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl my-8 flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="p-6 border-b flex justify-between items-center shrink-0">
                            <h3 className="font-black text-xl text-gray-800 flex items-center gap-2">
                                <BookOpen className="w-6 h-6 text-indigo-600"/> إضافة برنامج تدريبي
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-red-500 bg-gray-50 p-2 rounded-full"><X className="w-6 h-6"/></button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                            {/* Basic Info Section */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                <Input label="عنوان التدريب" value={formData.title} onChange={v => setFormData({...formData, title: v})} placeholder="مثال: بروتوكول التعامل مع الطوارئ" required />
                                <Select label="نوع التدريب" options={['internal', 'external', 'online']} value={formData.type} onChange={v => setFormData({...formData, type: v})} />
                                {formData.type !== 'online' && <Input label="المكان" value={formData.location} onChange={v => setFormData({...formData, location: v})} placeholder="اسم القاعة / المركز" />}
                                <Input label="تاريخ التدريب (اختياري)" type="datetime-local" value={formData.training_date} onChange={v => setFormData({...formData, training_date: v})} />
                                <Select label="إلزامية التدريب" options={['true', 'false']} value={formData.is_mandatory} onChange={v => setFormData({...formData, is_mandatory: v})} />
                                <Input label="نقاط المكافأة عند الإتمام" type="number" value={formData.points} onChange={v => setFormData({...formData, points: Number(v)})} />
                            </div>

                            {/* Slides Builder Section */}
                            <div className="bg-gray-50/80 p-6 rounded-3xl border border-gray-200">
                                <div className="flex justify-between items-center mb-6">
                                    <h4 className="font-bold text-gray-800 flex items-center gap-2 text-lg">
                                        <Layers className="w-5 h-5 text-indigo-600"/> محتوى التدريب (الشرائح)
                                    </h4>
                                    <button onClick={addSlide} className="bg-indigo-100 text-indigo-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-200 transition-colors flex items-center gap-2">
                                        <Plus className="w-4 h-4"/> شريحة جديدة
                                    </button>
                                </div>
                                
                                <div className="space-y-6">
                                    {formData.slides.map((slide: any, index: number) => (
                                        <div key={index} className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm relative group transition-all hover:shadow-md">
                                            {/* Slide Number Badge */}
                                            <div className="absolute top-4 left-4 flex gap-2">
                                                <span className="bg-gray-100 text-gray-500 w-8 h-8 flex items-center justify-center rounded-full text-xs font-black border border-gray-200">
                                                    {index + 1}
                                                </span>
                                                <button onClick={() => removeSlide(index)} className="bg-red-50 text-red-500 w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-100 transition-colors">
                                                    <Trash2 className="w-4 h-4"/>
                                                </button>
                                            </div>

                                            <div className="space-y-4 pt-2">
                                                <input 
                                                    placeholder="عنوان الشريحة (مثال: الخطوة الأولى)" 
                                                    className="w-full font-black text-lg text-gray-800 border-b-2 border-transparent focus:border-indigo-500 outline-none pb-2 bg-transparent transition-colors placeholder-gray-300"
                                                    value={slide.title}
                                                    onChange={(e) => updateSlide(index, 'title', e.target.value)}
                                                />
                                                
                                                {/* Media Area */}
                                                <div className="flex gap-4">
                                                    {/* Preview Box */}
                                                    <div className="w-40 h-40 bg-gray-100 rounded-2xl flex-shrink-0 overflow-hidden border border-gray-200 relative flex items-center justify-center">
                                                        {slide.mediaUrl ? (
                                                            <>
                                                                {slide.mediaType === 'video' ? (
                                                                    <video src={slide.mediaUrl} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <img src={slide.mediaUrl} className="w-full h-full object-cover" alt="slide" />
                                                                )}
                                                                <button 
                                                                    onClick={() => removeMedia(index)}
                                                                    className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full hover:bg-red-700"
                                                                >
                                                                    <X className="w-3 h-3"/>
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <ImageIcon className="w-8 h-8 text-gray-300"/>
                                                        )}
                                                        
                                                        {uploading === index && (
                                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm">
                                                                <Loader2 className="w-6 h-6 text-white animate-spin"/>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Content & Upload */}
                                                    <div className="flex-1 space-y-3">
                                                        {!slide.mediaUrl && (
                                                            <label className="inline-flex items-center gap-2 bg-white border border-gray-300 px-4 py-2 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors text-sm font-bold text-gray-600">
                                                                <ImageIcon className="w-4 h-4"/> رفع صورة / فيديو
                                                                <input 
                                                                    type="file" 
                                                                    accept="image/*,video/*" 
                                                                    className="hidden" 
                                                                    onChange={(e) => handleFileUpload(e, index)}
                                                                    disabled={uploading !== null}
                                                                />
                                                            </label>
                                                        )}
                                                        
                                                        <textarea 
                                                            placeholder="اكتب شرحاً توضيحياً لهذه الشريحة..." 
                                                            className="w-full text-sm text-gray-700 bg-gray-50 p-3 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-100 min-h-[100px] resize-none border border-transparent focus:bg-white transition-all"
                                                            value={slide.content}
                                                            onChange={(e) => updateSlide(index, 'content', e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t bg-gray-50 flex gap-4 shrink-0">
                            <button onClick={() => setShowModal(false)} className="flex-1 py-4 rounded-2xl font-bold text-gray-500 hover:bg-gray-200 transition-colors">إلغاء</button>
                            <button 
                                onClick={() => createMutation.mutate(formData)} 
                                disabled={createMutation.isPending || uploading !== null || !formData.title} 
                                className="flex-[2] bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:shadow-none"
                            >
                                {createMutation.isPending ? <Loader2 className="animate-spin"/> : <Save className="w-5 h-5"/>} نشر التدريب
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
