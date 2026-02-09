import React, { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, Trash2, BookOpen, MapPin, Users, Loader2, PlayCircle, Layers } from 'lucide-react';
import { Input, Select } from '../../../components/ui/FormElements';
import toast from 'react-hot-toast';

export default function TrainingManager() {
    const queryClient = useQueryClient();
    const [showModal, setShowModal] = useState(false);
    
    // حالة النموذج
    const [formData, setFormData] = useState({
        title: '',
        type: 'internal', // internal, external, online
        location: '',
        training_date: '',
        is_mandatory: 'false',
        points: 20,
        slides: [{ title: 'مقدمة', content: '' }] // الشريحة الأولى افتراضية
    });

    // جلب التدريبات
    const { data: trainings = [], isLoading } = useQuery({
        queryKey: ['admin_trainings'],
        queryFn: async () => {
            const { data } = await supabase.from('trainings').select('*').order('created_at', { ascending: false });
            return data;
        }
    });

    // إضافة تدريب جديد
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
            setFormData({ title: '', type: 'internal', location: '', training_date: '', is_mandatory: 'false', points: 20, slides: [{ title: 'مقدمة', content: '' }] });
            queryClient.invalidateQueries({ queryKey: ['admin_trainings'] });
        },
        onError: () => toast.error('حدث خطأ أثناء النشر')
    });

    // إدارة الشرائح (Slides)
    const addSlide = () => {
        setFormData({ ...formData, slides: [...formData.slides, { title: '', content: '' }] });
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

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-indigo-100">
                <h2 className="text-xl font-black text-indigo-800 flex items-center gap-2">
                    <BookOpen className="w-6 h-6"/> إدارة التدريب والتعليم المستمر
                </h2>
                <button onClick={() => setShowModal(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700">
                    <Plus className="w-5 h-5"/> تدريب جديد
                </button>
            </div>

            {/* قائمة التدريبات الحالية */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {trainings.map((t: any) => (
                    <div key={t.id} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
                        <div className={`absolute top-0 right-0 w-2 h-full ${t.type === 'online' ? 'bg-purple-500' : t.type === 'external' ? 'bg-orange-500' : 'bg-blue-500'}`}></div>
                        <h3 className="font-bold text-lg mb-1">{t.title}</h3>
                        <div className="text-xs text-gray-500 font-bold mb-4 flex gap-2">
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3"/> {t.type === 'online' ? 'تطبيق (Online)' : t.location || 'داخل المركز'}</span>
                            {t.is_mandatory && <span className="bg-red-100 text-red-600 px-2 rounded-full">إجباري</span>}
                        </div>
                        <div className="flex justify-between items-center mt-4 border-t pt-3">
                            <span className="text-sm font-bold text-indigo-600 flex items-center gap-1"><Layers className="w-4 h-4"/> {t.slides?.length || 0} شرائح</span>
                            <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-lg text-xs font-black">⭐ {t.points} نقطة</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal إنشاء تدريب */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-white rounded-3xl w-full max-w-4xl p-6 shadow-2xl my-8">
                        <div className="flex justify-between items-center mb-6 border-b pb-4">
                            <h3 className="font-black text-xl text-gray-800">إضافة برنامج تدريبي جديد</h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-red-500"><Plus className="rotate-45 w-6 h-6"/></button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <Input label="عنوان التدريب" value={formData.title} onChange={v => setFormData({...formData, title: v})} />
                            <Select label="نوع التدريب" options={['internal', 'external', 'online']} value={formData.type} onChange={v => setFormData({...formData, type: v})} />
                            {formData.type !== 'online' && <Input label="المكان" value={formData.location} onChange={v => setFormData({...formData, location: v})} />}
                            <Input label="تاريخ التدريب (اختياري)" type="datetime-local" value={formData.training_date} onChange={v => setFormData({...formData, training_date: v})} />
                            <Select label="إلزامية التدريب" options={['true', 'false']} value={formData.is_mandatory} onChange={v => setFormData({...formData, is_mandatory: v})} />
                            <Input label="نقاط المكافأة" type="number" value={formData.points} onChange={v => setFormData({...formData, points: Number(v)})} />
                        </div>

                        {/* Slide Builder */}
                        <div className="bg-gray-50 p-4 rounded-2xl border border-dashed border-gray-300">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="font-bold text-gray-700 flex items-center gap-2"><PlayCircle className="w-5 h-5"/> محتوى التدريب (Slides)</h4>
                                <button onClick={addSlide} className="text-indigo-600 text-sm font-bold flex items-center gap-1 hover:bg-indigo-50 px-2 py-1 rounded">+ شريحة جديدة</button>
                            </div>
                            
                            <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar p-1">
                                {formData.slides.map((slide, index) => (
                                    <div key={index} className="bg-white p-4 rounded-xl border shadow-sm relative group">
                                        <span className="absolute top-2 left-2 bg-gray-100 text-gray-500 w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold">{index + 1}</span>
                                        <button onClick={() => removeSlide(index)} className="absolute top-2 left-10 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4"/></button>
                                        
                                        <div className="mb-2">
                                            <input 
                                                placeholder="عنوان الشريحة الرئيسية" 
                                                className="w-full font-bold text-gray-800 border-b border-transparent focus:border-indigo-300 outline-none p-1"
                                                value={slide.title}
                                                onChange={(e) => updateSlide(index, 'title', e.target.value)}
                                            />
                                        </div>
                                        <textarea 
                                            placeholder="محتوى الشريحة (نص الشرح)..." 
                                            className="w-full text-sm text-gray-600 bg-gray-50 p-2 rounded-lg outline-none focus:ring-1 focus:ring-indigo-200 min-h-[80px]"
                                            value={slide.content}
                                            onChange={(e) => updateSlide(index, 'content', e.target.value)}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="mt-6 pt-4 border-t flex gap-3">
                            <button onClick={() => createMutation.mutate(formData)} disabled={createMutation.isPending} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 flex justify-center items-center gap-2">
                                {createMutation.isPending ? <Loader2 className="animate-spin"/> : <Save className="w-5 h-5"/>} نشر التدريب
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
