import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Employee } from '../../../types';
import { 
    Play, CheckCircle, MapPin, ChevronLeft, ChevronRight, X, 
    Trophy, Sparkles, RotateCcw, UserCheck, Lock 
} from 'lucide-react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

interface Props {
    employee: Employee;
    forcedTraining?: any; // لاستقبال التدريب الإجباري
    onComplete?: () => void; // callback عند الانتهاء لفك الحظر
}

export default function StaffTrainingCenter({ employee, forcedTraining, onComplete }: Props) {
    const queryClient = useQueryClient();
    const [selectedTraining, setSelectedTraining] = useState<any>(null);
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
    
    // حالات التحكم في التخطي
    const [canProceed, setCanProceed] = useState(false);
    const [timer, setTimer] = useState(0);

    // 1. جلب التدريبات
    const { data: trainings = [] } = useQuery({
        queryKey: ['staff_trainings', employee.employee_id],
        queryFn: async () => {
            const { data: allTrainings } = await supabase.from('trainings').select('*').order('created_at', { ascending: false });
            
            const { data: myProgress } = await supabase.from('employee_trainings')
                .select('training_id, status')
                .eq('employee_id', employee.employee_id);

            return allTrainings?.map(t => ({
                ...t,
                is_completed: myProgress?.some(p => p.training_id === t.id && p.status === 'completed')
            }));
        }
    });

    // 2. مراقبة التدريب الإجباري (إذا تم تمريره من الـ Guard)
    useEffect(() => {
        if (forcedTraining) {
            setSelectedTraining(forcedTraining);
            setCurrentSlideIndex(0);
        }
    }, [forcedTraining]);

    // 3. منطق المؤقت ومنع التخطي
    useEffect(() => {
        if (!selectedTraining) return;

        const currentSlide = selectedTraining.slides[currentSlideIndex];
        
        // لو التدريب مكتمل مسبقاً، نسمح بالتنقل بحرية
        if (selectedTraining.is_completed) {
            setCanProceed(true);
            setTimer(0);
            return;
        }

        setCanProceed(false); // قفل الزر مبدئياً

        if (currentSlide.mediaType === 'video') {
            // الفيديو: ننتظر حدث onEnded (لا نفعل شيئاً هنا)
            setTimer(0);
        } else {
            // النص/الصورة: مؤقت زمني (مثلاً 5 ثوانٍ)
            setTimer(5);
            const interval = setInterval(() => {
                setTimer((prev) => {
                    if (prev <= 1) {
                        clearInterval(interval);
                        setCanProceed(true);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [currentSlideIndex, selectedTraining]);

    // 4. تسجيل الإكمال
    const completeMutation = useMutation({
        mutationFn: async (training: any) => {
            const { error } = await supabase.from('employee_trainings').insert({
                employee_id: employee.employee_id,
                training_id: training.id,
                status: 'completed',
                type: 'lms'
            });
            if (error) throw error;

            await supabase.rpc('increment_points', { emp_id: employee.employee_id, amount: training.points });
            
            await supabase.from('points_ledger').insert({
                employee_id: employee.employee_id,
                points: training.points,
                reason: `إتمام تدريب: ${training.title}`
            });
        },
        onSuccess: () => {
            confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
            toast.success(`أحسنت! تم إضافة ${selectedTraining.points} نقطة لرصيدك`);
            
            // تحديث البيانات
            queryClient.invalidateQueries({ queryKey: ['staff_trainings'] });
            queryClient.invalidateQueries({ queryKey: ['employee_full_details'] });
            
            // إغلاق واستدعاء callback إذا وجد
            setSelectedTraining(null);
            if (onComplete) onComplete();
        },
        onError: (err: any) => {
            if (err.code === '23505') {
                toast.success("تم تسجيل هذا التدريب بالفعل");
                if (onComplete) onComplete();
                setSelectedTraining(null);
            } else {
                toast.error("حدث خطأ أثناء التسجيل");
            }
        }
    });

    // التنقل
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

    const handleFinish = () => {
        if (selectedTraining.is_completed) {
            setSelectedTraining(null);
            if (onComplete) onComplete();
        } else {
            completeMutation.mutate(selectedTraining);
        }
    };

    const openTraining = (t: any) => {
        setSelectedTraining(t);
        setCurrentSlideIndex(0);
    };

    // دالة مساعدة لعرض الميديا (فيديو أو صورة أو يوتيوب)
    const renderMedia = (slide: any) => {
        if (!slide.mediaUrl) return (
            <div className="flex-1 bg-gradient-to-br from-indigo-900 to-black flex items-center justify-center min-h-[300px]">
                <Sparkles className="w-20 h-20 text-white/10"/>
            </div>
        );

        // دعم بسيط لليوتيوب (تحويل الرابط إلى Embed إذا لزم الأمر)
        const isYoutube = slide.mediaUrl.includes('youtube.com') || slide.mediaUrl.includes('youtu.be');
        
        if (isYoutube) {
            // استخراج ID الفيديو بشكل بسيط (للتبسيط نستخدم الرابط كما هو إذا كان embed جاهز، أو نعرضه كـ iframe)
            // ملاحظة: لتحويل رابط عادي لـ embed يحتاج منطق regex، هنا نفترض أن الرابط مباشر أو يدعمه المتصفح
            return (
                <div className="w-full h-full flex items-center justify-center bg-black min-h-[300px]">
                     {/* في حالة اليوتيوب، لا يمكننا بسهولة تتبع onEnded بدون API، لذا سنعتمد على التايمر فقط */}
                     {/* نقوم بتفعيل الزر بعد فترة زمنية تقديرية أو يدوياً */}
                    <iframe 
                        src={slide.mediaUrl.replace('watch?v=', 'embed/')} 
                        className="w-full h-full aspect-video" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowFullScreen
                        onLoad={() => {
                            if(!selectedTraining.is_completed) {
                                setTimer(15); // إجبار 15 ثانية لليوتيوب كحد أدنى
                                setCanProceed(false);
                            }
                        }}
                    />
                </div>
            );
        }

        if (slide.mediaType === 'video' || slide.mediaUrl.endsWith('.mp4')) {
            return (
                <div className="w-full flex-1 flex items-center justify-center bg-black min-h-[300px]">
                    <video 
                        src={slide.mediaUrl} 
                        className="max-h-full w-full object-contain" 
                        controls 
                        controlsList="nodownload" // منع التحميل
                        autoPlay 
                        playsInline
                        onEnded={() => setCanProceed(true)} // ✅ السماح بالمرور عند الانتهاء
                    />
                </div>
            );
        }

        return (
            <div className="w-full flex-1 flex items-center justify-center bg-black min-h-[300px]">
                <img 
                    src={slide.mediaUrl} 
                    className="max-h-full w-full object-contain" 
                    alt="slide content" 
                />
            </div>
        );
    };

    return (
        <div className="space-y-4 animate-in fade-in">
            <h2 className="text-lg font-black text-gray-800 mb-4 px-2">📚 مركز التدريب والتطوير</h2>

            <div className="grid grid-cols-1 gap-4 px-2 pb-20">
                {trainings.map((t: any) => (
                    <div key={t.id} className={`relative bg-white rounded-3xl p-5 border shadow-sm transition-all ${t.is_completed ? 'border-green-200' : 'border-gray-100 hover:shadow-md'}`}>
                        
                        {/* الشارات */}
                        {t.is_mandatory && !t.is_completed && (
                            <span className="absolute top-4 left-4 bg-red-100 text-red-600 text-[10px] font-black px-2 py-1 rounded-full animate-pulse">إلزامي</span>
                        )}
                        
                        <h3 className="font-bold text-gray-800 mb-2">{t.title}</h3>
                        
                        {/* تفاصيل المكان والمسؤول */}
                        <div className="space-y-1 mb-4">
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                                <span className="flex items-center gap-1"><MapPin className="w-3 h-3"/> {t.type === 'online' ? 'Online' : t.location}</span>
                                <span className="flex items-center gap-1 text-yellow-600 font-bold"><Trophy className="w-3 h-3"/> {t.points} نقطة</span>
                            </div>
                            {t.responsible_person && (
                                <p className="text-xs text-indigo-600 font-bold flex items-center gap-1">
                                    <UserCheck className="w-3 h-3"/> {t.responsible_person}
                                </p>
                            )}
                        </div>

                        {/* أزرار التحكم */}
                        {!t.is_completed ? (
                            <button 
                                onClick={() => openTraining(t)}
                                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold flex justify-center items-center gap-2 hover:bg-indigo-700 transition-colors"
                            >
                                <Play className="w-4 h-4 fill-current"/> ابدأ التدريب الآن
                            </button>
                        ) : (
                            <div className="flex gap-2">
                                <div className="flex-1 bg-green-50 text-green-700 py-3 rounded-xl font-bold text-center text-sm border border-green-100 flex justify-center items-center gap-1 cursor-default">
                                    <CheckCircle className="w-4 h-4"/> تم الاجتياز
                                </div>
                                <button 
                                    onClick={() => openTraining(t)}
                                    className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl font-bold text-center text-sm hover:bg-gray-200 transition-colors flex justify-center items-center gap-1 border border-gray-200"
                                >
                                    <RotateCcw className="w-4 h-4"/> مراجعة
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* مشغل التدريب (Modal) */}
            {selectedTraining && (
                <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center md:p-4 animate-in zoom-in-95 duration-200">
                    <div className="bg-black md:bg-white w-full max-w-2xl md:rounded-3xl overflow-hidden shadow-2xl flex flex-col h-full md:h-auto md:max-h-[90vh]">
                        
                        {/* Header */}
                        <div className="p-4 bg-gray-900 md:bg-white md:border-b flex justify-between items-center shrink-0 z-10">
                            <div>
                                <h3 className="font-black text-white md:text-gray-800 text-sm">{selectedTraining.title}</h3>
                                <p className="text-xs text-gray-400 md:text-gray-500 font-bold mt-1">شريحة {currentSlideIndex + 1} من {selectedTraining.slides.length}</p>
                            </div>
                            {/* إخفاء زر الإغلاق إذا كان إجبارياً وغير مكتمل */}
                            {(!forcedTraining || selectedTraining.is_completed) && (
                                <button onClick={() => setSelectedTraining(null)} className="p-2 bg-white/10 md:bg-gray-100 rounded-full text-white md:text-gray-600 hover:bg-white/20"><X className="w-5 h-5"/></button>
                            )}
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 overflow-y-auto flex flex-col relative bg-black">
                            {renderMedia(selectedTraining.slides[currentSlideIndex])}

                            <div className="bg-white rounded-t-[30px] p-6 -mt-6 relative z-10 min-h-[200px]">
                                <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-4"></div>
                                <h2 className="text-xl font-black text-gray-900 mb-3 text-center">
                                    {selectedTraining.slides[currentSlideIndex]?.title}
                                </h2>
                                <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap text-center max-w-lg mx-auto">
                                    {selectedTraining.slides[currentSlideIndex]?.content}
                                </p>
                            </div>
                        </div>

                        {/* Footer Controls */}
                        <div className="p-4 bg-white border-t flex justify-between items-center shrink-0">
                            <button 
                                onClick={prevSlide} 
                                disabled={currentSlideIndex === 0}
                                className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 disabled:opacity-30 hover:bg-gray-200 transition-colors"
                            >
                                <ChevronRight className="w-6 h-6"/>
                            </button>

                            <div className="flex gap-1.5 mx-4 overflow-x-auto max-w-[200px] no-scrollbar">
                                {selectedTraining.slides.map((_:any, idx:number) => (
                                    <div key={idx} className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentSlideIndex ? 'bg-indigo-600 w-8' : idx < currentSlideIndex ? 'bg-indigo-300 w-2' : 'bg-gray-200 w-2'}`}></div>
                                ))}
                            </div>

                            {/* زر الإجراء مع قفل التخطي */}
                            {currentSlideIndex === selectedTraining.slides.length - 1 ? (
                                <button 
                                    onClick={handleFinish}
                                    disabled={!canProceed || completeMutation.isPending}
                                    className={`px-6 py-3 rounded-full font-black shadow-lg hover:scale-105 transition-transform flex items-center gap-2 text-sm text-white 
                                        ${!canProceed ? 'bg-gray-400 cursor-not-allowed' : selectedTraining.is_completed ? 'bg-gray-600' : 'bg-green-600 shadow-green-200'}`}
                                >
                                    {completeMutation.isPending ? '...' : 
                                     !canProceed ? `انتظر (${timer})` : 
                                     selectedTraining.is_completed ? 'إغلاق' : 'إنهاء'} 
                                    {canProceed && (selectedTraining.is_completed ? <X className="w-4 h-4"/> : <CheckCircle className="w-4 h-4"/>)}
                                    {!canProceed && <Lock className="w-3 h-3"/>}
                                </button>
                            ) : (
                                <button 
                                    onClick={nextSlide} 
                                    disabled={!canProceed}
                                    className={`w-12 h-12 flex items-center justify-center rounded-full text-white shadow-lg transition-colors
                                        ${!canProceed ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'}`}
                                >
                                    {!canProceed && timer > 0 ? <span className="text-xs font-bold">{timer}</span> : <ChevronLeft className="w-6 h-6"/>}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
