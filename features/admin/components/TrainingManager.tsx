import React, { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, Trash2, BookOpen, MapPin, Layers, Loader2, Image as ImageIcon, Video, X } from 'lucide-react';
import { Input, Select } from '../../../components/ui/FormElements';
import toast from 'react-hot-toast';

export default function TrainingManager() {
    const queryClient = useQueryClient();
    const [showModal, setShowModal] = useState(false);
    const [uploading, setUploading] = useState(false); // حالة التحميل
    
    const [formData, setFormData] = useState({
        title: '',
        type: 'internal',
        location: '',
        training_date: '',
        is_mandatory: 'false',
        points: 20,
        slides: [{ title: 'مقدمة', content: '', mediaUrl: '', mediaType: 'none' }] 
    });

    const { data: trainings = [] } = useQuery({
        queryKey: ['admin_trainings'],
        queryFn: async () => {
            const { data } = await supabase.from('trainings').select('*').order('created_at', { ascending: false });
            return data;
        }
    });

    const createMutation = useMutation({
        mutationFn: async (newTraining: any) => {
            const { error } = await supabase.from('trainings').insert([{
                ...newTraining,
                is_mandatory: newTraining.is_mandatory === 'true'
            }]);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success('تم نشر التدريب بنجاح');
            setShowModal(false);
            setFormData({ title: '', type: 'internal', location: '', training_date: '', is_mandatory: 'false', points: 20, slides: [{ title: 'مقدمة', content: '', mediaUrl: '', mediaType: 'none' }] });
            queryClient.invalidateQueries({ queryKey: ['admin_trainings'] });
        },
        onError: () => toast.error('حدث خطأ')
    });

    // دالة رفع الملفات (صور أو فيديو)
    const handleFileUpload = async (event: any, index: number) => {
        const file = event.target.files[0];
        if (!file) return;

        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
            const filePath = `slides/${fileName}`;

            // 1. الرفع إلى Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('training-media')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // 2. الحصول على الرابط العلني
            const { data: { publicUrl } } = supabase.storage
                .from('training-media')
                .getPublicUrl(filePath);

            // 3. تحديد نوع الملف
            const type = file.type.startsWith('video') ? 'video' : 'image';

            // 4. تحديث الشريحة
            const newSlides = [...formData.slides];
            // @ts-ignore
            newSlides[index].mediaUrl = publicUrl;
            // @ts-ignore
            newSlides[index].mediaType = type;
            setFormData({ ...formData, slides: newSlides });

            toast.success('تم رفع الملف');
        } catch (error: any) {
            console.error(error);
            toast.error('فشل الرفع: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    const addSlide = () => {
        setFormData({ ...formData, slides: [...formData.slides, { title: '', content: '', mediaUrl: '', mediaType: 'none' }] });
    };

    const removeSlide = (index: number) => {
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
        <div className="space-y-6 animate-in fade-in">
            {/* ... (نفس كود عرض القائمة السابق) ... */}
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-indigo-100">
                <h2 className="text-xl font-black text-indigo-800 flex items-center gap-2">
                    <BookOpen className="w-6 h-6"/> إدارة التدريب (الوسائط المتعددة)
                </h2>
                <button onClick={() => setShowModal(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700">
                    <Plus className="w-5 h-5"/> تدريب جديد
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {trainings.map((t: any) => (
                    <div key={t.id} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
                        <div className={`absolute top-0 right-0 w-2 h-full ${t.type === 'online' ? 'bg-purple-500' : 'bg-blue-500'}`}></div>
                        <h3 className="font-bold text-lg mb-1">{t.title}</h3>
                        <div className="flex justify-between items-center mt-4 border-t pt-3">
                            <span className="text-sm font-bold text-indigo-600 flex items-center gap-1"><Layers className="w-4 h-4"/> {t.slides?.length || 0} شرائح</span>
                            <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-lg text-xs font-black">⭐ {t.points} نقطة</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-white rounded-3xl w-full max-w-4xl p-6 shadow-2xl my-8">
                        <div className="flex justify-between items-center mb-6 border-b pb-4">
                            <h3 className="font-black text-xl text-gray-800">إضافة تدريب تفاعلي</h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-red-500"><X className="w-6 h-6"/></button>
                        </div>

                        {/* البيانات الأساسية */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <Input label="عنوان التدريب" value={formData.title} onChange={v => setFormData({...formData, title: v})} />
                            <Select label="نوع التدريب" options={['internal', 'external', 'online']} value={formData.type} onChange={v => setFormData({...formData, type: v})} />
                            {formData.type !== 'online' && <Input label="المكان" value={formData.location} onChange={v => setFormData({...formData, location: v})} />}
                            <Input label="نقاط المكافأة" type="number" value={formData.points} onChange={v => setFormData({...formData, points: Number(v)})} />
                        </div>

                        {/* منشئ الشرائح */}
                        <div className="bg-gray-50 p-4 rounded-2xl border border-dashed border-gray-300">
                            <div className="space-y-6 max-h-[400px] overflow-y-auto custom-scrollbar p-2">
                                {formData.slides.map((slide: any, index: number) => (
                                    <div key={index} className="bg-white p-4 rounded-2xl border shadow-sm relative">
                                        <div className="absolute top-2 left-2 flex gap-2">
                                            <button onClick={() => removeSlide(index)} className="text-red-400 hover:text-red-600 bg-red-50 p-1.5 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                                        </div>
                                        <span className="text-xs font-black text-gray-400 mb-2 block">شريحة #{index + 1}</span>
                                        
                                        <div className="space-y-3">
                                            <input 
                                                placeholder="عنوان الشريحة (مثال: طريقة غسل الأيدي)" 
                                                className="w-full font-black text-lg text-gray-800 border-b border-gray-100 focus:border-indigo-500 outline-none pb-2"
                                                value={slide.title}
                                                onChange={(e) => updateSlide(index, 'title', e.target.value)}
                                            />
                                            
                                            {/* منطقة رفع الوسائط */}
                                            {slide.mediaUrl ? (
                                                <div className="relative w-full h-40 bg-black rounded-xl overflow-hidden flex items-center justify-center group">
                                                    {slide.mediaType === 'video' ? (
                                                        <video src={slide.mediaUrl} className="h-full w-auto" controls />
                                                    ) : (
                                                        <img src={slide.mediaUrl} className="h-full w-full object-contain" alt="slide" />
                                                    )}
                                                    <button 
                                                        onClick={() => removeMedia(index)}
                                                        className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <X className="w-4 h-4"/>
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex gap-2">
                                                    <label className={`flex-1 cursor-pointer border-2 border-dashed border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:border-indigo-400 hover:bg-indigo-50 transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                                                        <div className="bg-indigo-100 text-indigo-600 p-2 rounded-full">
                                                            {uploading ? <Loader2 className="w-6 h-6 animate-spin"/> : <ImageIcon className="w-6 h-6"/>}
                                                        </div>
                                                        <span className="text-xs font-bold text-gray-500">
                                                            {uploading ? 'جاري الرفع...' : 'اضغط لرفع صورة أو GIF أو فيديو'}
                                                        </span>
                                                        <input 
                                                            type="file" 
                                                            accept="image/*,video/*" 
                                                            className="hidden" 
                                                            onChange={(e) => handleFileUpload(e, index)}
                                                        />
                                                    </label>
                                                </div>
                                            )}

                                            <textarea 
                                                placeholder="الشرح النصي (اختياري)..." 
                                                className="w-full text-sm text-gray-600 bg-gray-50 p-3 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 min-h-[80px]"
                                                value={slide.content}
                                                onChange={(e) => updateSlide(index, 'content', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button onClick={addSlide} className="w-full mt-4 bg-white border-2 border-dashed border-indigo-200 text-indigo-600 font-bold py-3 rounded-xl hover:bg-indigo-50 hover:border-indigo-400 transition-all flex justify-center gap-2">
                                <Plus className="w-5 h-5"/> إضافة شريحة جديدة
                            </button>
                        </div>

                        <div className="mt-6 pt-4 border-t">
                            <button onClick={() => createMutation.mutate(formData)} disabled={createMutation.isPending || uploading} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex justify-center items-center gap-2">
                                {createMutation.isPending ? <Loader2 className="animate-spin"/> : <Save className="w-6 h-6"/>} نشر التدريب
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
