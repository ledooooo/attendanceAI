import React, { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Employee } from '../../../types';
import { Play, CheckCircle, Clock, MapPin, ChevronLeft, ChevronRight, X, Trophy } from 'lucide-react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

export default function StaffTrainingCenter({ employee }: { employee: Employee }) {
    const queryClient = useQueryClient();
    const [selectedTraining, setSelectedTraining] = useState<any>(null);
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

    // 1. جلب التدريبات المتاحة + حالة الإكمال
    const { data: trainings = [], isLoading } = useQuery({
        queryKey: ['staff_trainings', employee.employee_id],
        queryFn: async () => {
            // جلب كل التدريبات
            const { data: allTrainings } = await supabase.from('trainings').select('*').order('created_at', { ascending: false });
            
            // جلب سجلات الموظف لهذا التدريب
            const { data: myProgress } = await supabase.from('employee_trainings')
                .select('training_id, status')
                .eq('employee_id', employee.employee_id);

            // دمج البيانات لمعرفة المكتمل
            return allTrainings?.map(t => ({
                ...t,
                is_completed: myProgress?.some(p => p.training_id === t.id && p.status === 'completed')
            }));
        }
    });

    // 2. تسجيل الإكمال ومنح النقاط
    const completeMutation = useMutation({
        mutationFn: async (training: any) => {
            // أ) تسجيل في جدول التدريبات
            const { error } = await supabase.from('employee_trainings').insert({
                employee_id: employee.employee_id,
                training_id: training.id,
                status: 'completed'
            });
            if (error) throw error;

            // ب) منح النقاط
            await supabase.rpc('increment_points', { emp_id: employee.employee_id, amount: training.points });
            
            // ج) تسجيل في السجل
            await supabase.from('points_ledger').insert({
                employee_id: employee.employee_id,
                points: training.points,
                reason: `إتمام تدريب: ${training.title}`
            });
        },
        onSuccess: () => {
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
            toast.success(`أحسنت! تم إضافة ${selectedTraining.points} نقطة لرصيدك`);
            setSelectedTraining(null);
            queryClient.invalidateQueries({ queryKey: ['staff_trainings'] });
            queryClient.invalidateQueries({ queryKey: ['employee_full_details'] }); // لتحديث النقاط في الهيدر
        },
        onError: (err: any) => {
            if (err.code === '23505') toast.error("لقد أكملت هذا التدريب مسبقاً"); // Unique Violation
            else toast.error("حدث خطأ في التسجيل");
        }
    });

    // التحكم في السلايدر
    const nextSlide = () => {
        if (currentSlideIndex < selectedTraining.slides.length - 1) {
            setCurrentSlideIndex(curr => curr + 1);
        }
    };

    const prevSlide = () => {
        if (currentSlideIndex > 0) {
            setCurrentSlideIndex(curr => curr - 1);
        }
    };

    const finishTraining = () => {
        completeMutation.mutate(selectedTraining);
    };

    const openTraining = (t: any) => {
        setSelectedTraining(t);
        setCurrentSlideIndex(0);
    };

    return (
        <div className="space-y-4 animate-in fade-in">
            <h2 className="text-lg font-black text-gray-800 mb-4 px-2">📚 مركز التدريب والتطوير</h2>

            <div className="grid grid-cols-1 gap-4 px-2 pb-20">
                {trainings.map((t: any) => (
                    <div key={t.id} className={`relative bg-white rounded-3xl p-5 border shadow-sm transition-all ${t.is_completed ? 'border-green-200 opacity-80' : 'border-gray-100 hover:shadow-md'}`}>
                        {t.is_mandatory && !t.is_completed && (
                            <span className="absolute top-4 left-4 bg-red-100 text-red-600 text-[10px] font-black px-2 py-1 rounded-full animate-pulse">إلزامي</span>
                        )}
                        {t.is_completed && (
                            <span className="absolute top-4 left-4 bg-green-100 text-green-700 text-[10px] font-black px-2 py-1 rounded-full flex items-center gap-1"><CheckCircle className="w-3 h-3"/> مكتمل</span>
                        )}

                        <h3 className="font-bold text-gray-800 mb-2">{t.title}</h3>
                        
                        <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3"/> {t.type === 'online' ? 'Online' : t.location}</span>
                            <span className="flex items-center gap-1 text-yellow-600 font-bold"><Trophy className="w-3 h-3"/> {t.points} نقطة</span>
                        </div>

                        {/* زر الإجراء */}
                        {!t.is_completed ? (
                            <button 
                                onClick={() => openTraining(t)}
                                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold flex justify-center items-center gap-2 hover:bg-indigo-700 transition-colors"
                            >
                                <Play className="w-4 h-4 fill-current"/> ابدأ التدريب الآن
                            </button>
                        ) : (
                            <div className="w-full bg-gray-100 text-gray-500 py-3 rounded-xl font-bold text-center text-sm cursor-not-allowed">
                                تم الاجتياز
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* مشغل التدريب (Training Player Modal) */}
            {selectedTraining && (
                <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
                        {/* Header */}
                        <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                            <div>
                                <h3 className="font-black text-gray-800 text-sm">{selectedTraining.title}</h3>
                                <p className="text-xs text-gray-500 font-bold mt-1">شريحة {currentSlideIndex + 1} من {selectedTraining.slides.length}</p>
                            </div>
                            <button onClick={() => setSelectedTraining(null)} className="p-2 hover:bg-red-50 rounded-full text-gray-400 hover:text-red-500"><X className="w-5 h-5"/></button>
                        </div>

                        {/* Slide Content */}
                        <div className="flex-1 p-8 overflow-y-auto flex flex-col justify-center items-center text-center bg-gradient-to-br from-white to-gray-50">
                            <h2 className="text-2xl font-black text-indigo-900 mb-6 leading-tight">
                                {selectedTraining.slides[currentSlideIndex]?.title}
                            </h2>
                            <p className="text-gray-700 text-lg leading-relaxed whitespace-pre-wrap max-w-lg">
                                {selectedTraining.slides[currentSlideIndex]?.content}
                            </p>
                        </div>

                        {/* Footer Controls */}
                        <div className="p-4 border-t bg-white flex justify-between items-center">
                            <button 
                                onClick={prevSlide} 
                                disabled={currentSlideIndex === 0}
                                className="px-4 py-2 rounded-xl text-gray-600 font-bold disabled:opacity-30 hover:bg-gray-100"
                            >
                                <ChevronRight className="w-6 h-6"/>
                            </button>

                            {/* زر الانتهاء يظهر فقط في آخر شريحة */}
                            {currentSlideIndex === selectedTraining.slides.length - 1 ? (
                                <button 
                                    onClick={finishTraining}
                                    disabled={completeMutation.isPending}
                                    className="bg-green-600 text-white px-8 py-3 rounded-xl font-black shadow-lg shadow-green-200 hover:scale-105 transition-transform flex items-center gap-2"
                                >
                                    {completeMutation.isPending ? 'جاري التسجيل...' : 'إنهاء واستلام النقاط 🎁'}
                                </button>
                            ) : (
                                <div className="flex gap-1">
                                    {selectedTraining.slides.map((_:any, idx:number) => (
                                        <div key={idx} className={`w-2 h-2 rounded-full transition-all ${idx === currentSlideIndex ? 'bg-indigo-600 w-4' : 'bg-gray-200'}`}></div>
                                    ))}
                                </div>
                            )}

                            <button 
                                onClick={nextSlide} 
                                disabled={currentSlideIndex === selectedTraining.slides.length - 1}
                                className="px-4 py-2 rounded-xl text-gray-600 font-bold disabled:opacity-30 hover:bg-gray-100"
                            >
                                <ChevronLeft className="w-6 h-6"/>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
