import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Employee } from '../../../types';
import { 
    Play, CheckCircle, MapPin, ChevronLeft, ChevronRight, X, 
    Trophy, Sparkles, RotateCcw, UserCheck, Lock, SkipForward, Download, FileText 
} from 'lucide-react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

interface Props {
    employee: Employee;
    forcedTraining?: any; 
    onComplete?: () => void; 
    deepLinkTrainingId?: string | null; 
}

export default function StaffTrainingCenter({ employee, forcedTraining, onComplete, deepLinkTrainingId }: Props) {
    const queryClient = useQueryClient();
    const [selectedTraining, setSelectedTraining] = useState<any>(null);
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
    
    const [handledDeepLink, setHandledDeepLink] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null); 

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

    // 2. التحكم في التدريب الإجباري
    useEffect(() => {
        if (forcedTraining) {
            setSelectedTraining(forcedTraining);
            setCurrentSlideIndex(0);
        }
    }, [forcedTraining]);

    // 3. الاستماع للرابط العميق وفتح التدريب المباشر
    useEffect(() => {
        if (trainings.length > 0 && deepLinkTrainingId && !handledDeepLink && !selectedTraining && !forcedTraining) {
            const targetTraining = trainings.find((t: any) => String(t.id) === String(deepLinkTrainingId));
            
            if (targetTraining) {
                setSelectedTraining(targetTraining);
                setCurrentSlideIndex(0);
                setHandledDeepLink(true); 
            }
        }
    }, [trainings, deepLinkTrainingId, handledDeepLink, selectedTraining, forcedTraining]);

    // 4. منطق المؤقت والتحكم
    useEffect(() => {
        if (!selectedTraining) return;

        const currentSlide = selectedTraining.slides[currentSlideIndex];
        
        if (selectedTraining.is_completed) {
            setCanProceed(true);
            setTimer(0);
            return;
        }

        setCanProceed(false);

        const url = currentSlide.mediaUrl ? currentSlide.mediaUrl.toLowerCase() : '';
        const isVideo = currentSlide.mediaType === 'video' || 
                        (url && (url.includes('.mp4') || url.includes('youtube') || url.includes('youtu.be')));

        if (isVideo) {
            setTimer(0); 
            if (videoRef.current && !url.includes('youtu')) {
                videoRef.current.defaultMuted = true;
                videoRef.current.muted = true;
                videoRef.current.load();
                videoRef.current.play().catch(e => console.log("Autoplay prevented", e));
            }
            if (url.includes('youtu')) {
                 setTimer(15); 
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
        } else {
            const isDoc = url.includes('.pdf') || url.includes('.ppt') || url.includes('.doc');
            setTimer(isDoc ? 10 : 5); 

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
            queryClient.invalidateQueries({ queryKey: ['staff_trainings'] });
            queryClient.invalidateQueries({ queryKey: ['employee_full_details'] });
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

    const skipCurrentSlide = () => {
        setCanProceed(true);
        setTimer(0);
        toast('تم تخطي الشريحة', { icon: '⏩' });
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

    const getYouTubeEmbedUrl = (url: string) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        const videoId = (match && match[2].length === 11) ? match[2] : null;
        return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&playsinline=1&rel=0&controls=1` : null;
    };

    const renderMedia = (slide: any) => {
        if (!slide.mediaUrl) return null;

        const url = slide.mediaUrl.toLowerCase();

        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            const embedUrl = getYouTubeEmbedUrl(slide.mediaUrl);
            if (embedUrl) {
                return (
                    <div className="w-full h-full flex items-center justify-center bg-black min-h-[300px]">
                        <iframe 
                            src={embedUrl} 
                            className="w-full h-full aspect-video" 
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                            allowFullScreen
                            // @ts-ignore
                            playsInline
                        />
                    </div>
                );
            }
        }

        if (slide.mediaType === 'video' || (url.includes('.mp4') && !url.includes('.pdf') && !url.includes('.ppt'))) {
            return (
                <div className="w-full flex-1 flex flex-col items-center justify-center bg-black min-h-[300px] pb-4">
                    <video 
                        ref={videoRef} 
                        key={slide.mediaUrl} 
                        src={slide.mediaUrl} 
                        className="max-h-full w-full object-contain" 
                        controls 
                        controlsList="nodownload" 
                        playsInline 
                        preload="auto"
                        muted 
                        autoPlay
                        onEnded={() => setCanProceed(true)} 
                    />
                </div>
            );
        }

        if (url.includes('.pdf') || url.includes('.ppt') || url.includes('.pptx') || url.includes('.doc') || url.includes('.docx')) {
            return (
                <div className="w-full flex-1 flex flex-col items-center justify-center bg-gray-100 min-h-[300px]">
                    <iframe 
                        src={`https://docs.google.com/gview?url=${encodeURIComponent(slide.mediaUrl)}&embedded=true`}
                        className="w-full h-full min-h-[400px] border-0"
                        title="Document Viewer"
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
                        {t.is_mandatory && !t.is_completed && (
                            <span className="absolute top-4 left-4 bg-red-100 text-red-600 text-[10px] font-black px-2 py-1 rounded-full animate-pulse">إلزامي</span>
                        )}
                        <h3 className="font-bold text-gray-800 mb-2">{t.title}</h3>
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
                        {!t.is_completed ? (
                            <button onClick={() => openTraining(t)} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold flex justify-center items-center gap-2 hover:bg-indigo-700 transition-colors">
                                <Play className="w-4 h-4 fill-current"/> ابدأ التدريب الآن
                            </button>
                        ) : (
                            <div className="flex gap-2">
                                <div className="flex-1 bg-green-50 text-green-700 py-3 rounded-xl font-bold text-center text-sm border border-green-100 flex justify-center items-center gap-1 cursor-default">
                                    <CheckCircle className="w-4 h-4"/> تم الاجتياز
                                </div>
                                <button onClick={() => openTraining(t)} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl font-bold text-center text-sm hover:bg-gray-200 transition-colors flex justify-center items-center gap-1 border border-gray-200">
                                    <RotateCcw className="w-4 h-4"/> مراجعة
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {selectedTraining && (
                <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center md:p-4 animate-in zoom-in-95 duration-200">
                    <div className="bg-black md:bg-white w-full max-w-3xl md:rounded-3xl overflow-hidden shadow-2xl flex flex-col h-full md:h-auto md:max-h-[90vh]">
                        
                        {/* Header */}
                        <div className="p-4 bg-gray-900 md:bg-white flex justify-between items-center shrink-0 z-10 relative">
                            <div>
                                <h3 className="font-black text-white md:text-gray-800 text-sm md:text-base">{selectedTraining.title}</h3>
                                <p className="text-xs text-gray-400 md:text-gray-500 font-bold mt-1">شريحة {currentSlideIndex + 1} من {selectedTraining.slides.length}</p>
                            </div>
                            {(!forcedTraining || selectedTraining.is_completed) && (
                                <button onClick={() => setSelectedTraining(null)} className="p-2 bg-white/10 md:bg-gray-100 rounded-full text-white md:text-gray-600 hover:bg-white/20 transition-colors"><X className="w-5 h-5"/></button>
                            )}
                            
                            {/* Progress Bar (شريط التقدم العلوي) */}
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 md:bg-gray-100">
                                <div 
                                    className="h-full bg-indigo-500 transition-all duration-300"
                                    style={{ width: `${((currentSlideIndex + 1) / selectedTraining.slides.length) * 100}%` }}
                                />
                            </div>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto flex flex-col relative bg-gray-50">
                            
                            {/* التحقق مما إذا كان هناك ميديا أم لا */}
                            {selectedTraining.slides[currentSlideIndex]?.mediaUrl ? (
                                <>
                                    {renderMedia(selectedTraining.slides[currentSlideIndex])}
                                    <div className="bg-white rounded-t-[30px] p-6 md:p-8 -mt-6 relative z-10 min-h-[200px] shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
                                        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6"></div>
                                        <div className="max-w-2xl mx-auto w-full text-right">
                                            <h2 className="text-xl md:text-2xl font-black text-gray-900 mb-4">
                                                {selectedTraining.slides[currentSlideIndex]?.title}
                                            </h2>
                                            <p className="text-gray-700 text-sm md:text-base leading-loose whitespace-pre-wrap font-medium">
                                                {selectedTraining.slides[currentSlideIndex]?.content}
                                            </p>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                /* شاشة كاملة للنص إذا لم يكن هناك ميديا */
                                <div className="flex-1 bg-white p-8 md:p-12 flex flex-col justify-center items-center text-right relative">
                                    <div className="max-w-2xl w-full">
                                        <h2 className="text-2xl md:text-4xl font-black text-indigo-700 mb-6 pb-4 border-b-2 border-indigo-50">
                                            {selectedTraining.slides[currentSlideIndex]?.title}
                                        </h2>
                                        <p className="text-gray-700 text-base md:text-lg leading-loose whitespace-pre-wrap font-medium">
                                            {selectedTraining.slides[currentSlideIndex]?.content}
                                        </p>
                                    </div>
                                </div>
                            )}

                        </div>

                        {/* شريط الإجراءات السفلي (Footer) */}
                        <div className="p-4 md:p-5 bg-white border-t flex flex-wrap justify-between items-center shrink-0 gap-2">
                            
                            {/* زر العودة (السابق) */}
                            <button 
                                onClick={prevSlide} 
                                disabled={currentSlideIndex === 0} 
                                className="px-4 py-2.5 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 disabled:opacity-30 hover:bg-gray-200 transition-colors gap-1.5"
                            >
                                <ChevronRight className="w-5 h-5"/>
                                <span className="text-xs font-bold hidden sm:inline">السابق</span>
                            </button>

                            {/* أزرار الإجراءات الإضافية (تخطي وتحميل) */}
                            <div className="flex gap-2">
                                {/* زر التحميل */}
                                {selectedTraining.slides[currentSlideIndex]?.mediaUrl && !selectedTraining.slides[currentSlideIndex]?.mediaUrl.includes('youtube') && !selectedTraining.slides[currentSlideIndex]?.mediaUrl.includes('youtu.be') && (
                                    <a 
                                        href={selectedTraining.slides[currentSlideIndex].mediaUrl} 
                                        target="_blank" 
                                        rel="noreferrer" 
                                        download
                                        className="px-4 py-2.5 bg-indigo-50 text-indigo-600 rounded-full font-bold text-xs flex items-center gap-1.5 hover:bg-indigo-100 transition-colors"
                                        title="تحميل المرفق"
                                    >
                                        <Download className="w-4 h-4" /> <span className="hidden sm:inline">تحميل المرفق</span>
                                    </a>
                                )}

                                {/* زر التخطي */}
                                {!canProceed && !selectedTraining.is_completed && (
                                    <button 
                                        onClick={skipCurrentSlide}
                                        className="px-4 py-2.5 bg-yellow-100 text-yellow-700 rounded-full font-bold text-xs flex items-center gap-1.5 hover:bg-yellow-200 transition-colors"
                                        title="تخطي المؤقت"
                                    >
                                        <SkipForward className="w-4 h-4" /> <span className="hidden sm:inline">تخطي</span>
                                    </button>
                                )}
                            </div>

                            <div className="flex-1"></div>

                            {/* زر التالي / إنهاء */}
                            {currentSlideIndex === selectedTraining.slides.length - 1 ? (
                                <button 
                                    onClick={handleFinish} 
                                    disabled={!canProceed || completeMutation.isPending} 
                                    className={`px-6 py-2.5 rounded-full font-black shadow-lg hover:scale-105 transition-transform flex items-center gap-2 text-sm text-white ${!canProceed ? 'bg-gray-400 cursor-not-allowed' : selectedTraining.is_completed ? 'bg-gray-800' : 'bg-green-600 shadow-green-200'}`}
                                >
                                    {completeMutation.isPending ? '...' : !canProceed ? `انتظر (${timer})` : selectedTraining.is_completed ? 'إغلاق الدورة' : 'إنهاء وإرسال'} 
                                    {canProceed && (selectedTraining.is_completed ? <X className="w-4 h-4"/> : <CheckCircle className="w-5 h-5"/>)}
                                    {!canProceed && <Lock className="w-4 h-4"/>}
                                </button>
                            ) : (
                                <button 
                                    onClick={nextSlide} 
                                    disabled={!canProceed} 
                                    className={`px-5 py-2.5 flex items-center justify-center rounded-full text-white shadow-lg transition-colors gap-1.5 ${!canProceed ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'}`}
                                >
                                    {!canProceed && timer > 0 ? (
                                        <span className="text-sm font-bold px-2">{timer} ث</span>
                                    ) : (
                                        <>
                                            <span className="text-sm font-bold">التالي</span>
                                            <ChevronLeft className="w-5 h-5"/>
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
