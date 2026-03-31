import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { Brain, CheckCircle, XCircle, Sparkles, Loader2, BookOpen, ArrowRight, Trophy } from 'lucide-react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti'; // 👈 استيراد مكتبة الاحتفال
import { Employee } from '../../../types';
import { DiffProfile } from '../../../features/staff/components/arcade/types';

interface Props {
    employee: Employee;
    diffProfile: DiffProfile;
    onStart: () => Promise<void>;
    onComplete: (points: number, isWin: boolean) => void;
}

export default function MedicalQuizRush({ employee, diffProfile, onStart, onComplete }: Props) {
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [correctCount, setCorrectCount] = useState(0); // 👈 عداد الإجابات الصحيحة
    const [finalScore, setFinalScore] = useState(0); // 👈 النقاط النهائية
    const [timeLeft, setTimeLeft] = useState(60);
    const [isActive, setIsActive] = useState(false);
    const [starting, setStarting] = useState(false);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [showFeedback, setShowFeedback] = useState(false);
    const [questions, setQuestions] = useState<any[]>([]);
    
    // حالات شاشة التقرير النهائي
    const [isSummary, setIsSummary] = useState(false);
    const [history, setHistory] = useState<any[]>([]);

    const isMedicalEnglishSpecialty = ['بشر', 'أسنان', 'صيدل', 'اسره'].some(s => 
        (employee.job_title || '').includes(s) || (employee.specialty || '').includes(s)
    );
    const quizLanguage = isMedicalEnglishSpecialty ? 'English (Professional Medical Terminology)' : 'ar';

    const { data: aiQuestions = [], isLoading: loadingQuestions } = useQuery({
        queryKey: ['smart_quiz_rush', employee.specialty, diffProfile.label],
        queryFn: async () => {
            const { data, error } = await supabase.functions.invoke('generate-smart-quiz', {
                body: {
                    specialty: employee.job_title || employee.specialty || 'طبيب بشرى',
                    domain: 'طبي وعلمي',
                    difficulty: diffProfile.label === 'صعب' ? 'صعب' : 'متوسط',
                    length: 'قصير',
                    language: quizLanguage,
                    include_hint: false,
                    game_type: 'mcq',
                    question_count: 5 // 👈 نطلب 5 أسئلة فقط
                }
            });

            if (error || !data) return [];
            
            const uniqueQuestions = new Map();
            data.forEach((q: any) => {
                if (!uniqueQuestions.has(q.question_text)) {
                    const charToIndex: Record<string, number> = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
                    const correct_index = charToIndex[q.correct_option?.toUpperCase()] ?? 0;
                    
                    uniqueQuestions.set(q.question_text, {
                        id: q.id || Math.random().toString(),
                        question: q.question_text,
                        option_a: q.option_a,
                        option_b: q.option_b,
                        option_c: q.option_c,
                        option_d: q.option_d,
                        correct_index: correct_index,
                        explanation: q.explanation
                    });
                }
            });

            return Array.from(uniqueQuestions.values()).slice(0, 5); // نضمن أنها 5 أسئلة فقط
        },
        staleTime: 0,
        refetchOnWindowFocus: false
    });

    const startGame = async () => {
        if (aiQuestions.length < 3) {
            toast.error('لم نتمكن من جلب أسئلة كافية، يرجى المحاولة بعد قليل.');
            return;
        }
        setStarting(true);
        try {
            await onStart();
        } catch {
            setStarting(false);
            return;
        }
        
        setQuestions(aiQuestions); // بدون خلط لأننا نحتاج الـ 5 المولدين فقط
        setCurrentQuestion(0);
        setCorrectCount(0);
        setFinalScore(0);
        setTimeLeft(60);
        setHistory([]);
        setIsSummary(false);
        setIsActive(true);
        setStarting(false);
    };

    // 🏆 إنهاء اللعبة واحتساب النقاط والاحتفال
    const endGame = (currentCorrect: number) => {
        setIsActive(false);
        
        let earnedPoints = 0;
        if (currentCorrect === 3) earnedPoints = 15;
        else if (currentCorrect === 4) earnedPoints = 20;
        else if (currentCorrect >= 5) earnedPoints = 25;

        setFinalScore(earnedPoints);
        setIsSummary(true);

        // 🎇 إطلاق الاحتفال إذا فاز
        if (earnedPoints > 0) {
            try {
                const audio = new Audio('/applause.mp3'); // 👈 تشغيل ملف الصوت
                audio.play();
            } catch (e) { console.error("Audio play failed"); }
            
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#10B981', '#3B82F6', '#F59E0B', '#EF4444']
            });
        }
    };

    const handleFinalComplete = () => {
        const isWin = finalScore > 0;
        onComplete(finalScore, isWin); // إرسال النقاط الحقيقية وحالة الفوز
    };

    useEffect(() => {
        let timer: ReturnType<typeof setInterval>;
        if (isActive && timeLeft > 0) {
            timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
        } else if (isActive && timeLeft === 0) {
            endGame(correctCount); // انتهاء الوقت
        }
        return () => clearInterval(timer);
    }, [isActive, timeLeft, correctCount]);

    const handleAnswer = (idx: number) => {
        if (showFeedback || !isActive) return;
        
        setSelectedAnswer(idx);
        setShowFeedback(true);
        
        const currentQ = questions[currentQuestion];
        const isCorrect = idx === currentQ.correct_index;
        
        let newCorrectCount = correctCount;
        if (isCorrect) {
            newCorrectCount += 1;
            setCorrectCount(newCorrectCount);
            toast.success('إجابة صحيحة!', { id: 'rush_correct', duration: 1000 });
        } else {
            toast.error('إجابة خاطئة!', { id: 'rush_wrong', duration: 1000 });
        }

        setHistory(prev => [...prev, { 
            ...currentQ, 
            user_answer: idx, 
            is_correct: isCorrect,
            options: [currentQ.option_a, currentQ.option_b, currentQ.option_c, currentQ.option_d]
        }]);

        setTimeout(() => {
            if (!isActive) return;
            if (currentQuestion < questions.length - 1) {
                setCurrentQuestion(curr => curr + 1);
                setSelectedAnswer(null);
                setShowFeedback(false);
            } else {
                endGame(newCorrectCount); // الإجابة على آخر سؤال
            }
        }, 1000);
    };

    // 1. شاشة البداية
    if (!isActive && !isSummary) {
        return (
            <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 max-w-lg mx-auto text-center animate-in zoom-in-95">
                <div className="w-24 h-24 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-3xl flex items-center justify-center mx-auto mb-6 rotate-12">
                    <Trophy className="w-12 h-12 text-indigo-500 -rotate-12" />
                </div>
                <h3 className="text-2xl font-black text-gray-800 mb-2">تحدي الـ 5 أسئلة</h3>
                <p className="text-gray-500 font-bold text-sm mb-6">أجب على 5 أسئلة في 60 ثانية لحصد الجوائز!</p>
                
                {/* شرح نظام النقاط الجديد */}
                <div className="bg-gray-50 p-5 rounded-2xl mb-8 text-sm font-black text-gray-700 space-y-2 border border-gray-200">
                    <div className="flex justify-between"><span>3 إجابات صحيحة</span> <span className="text-emerald-600">15 نقطة</span></div>
                    <div className="flex justify-between border-t border-b border-gray-200 py-2"><span>4 إجابات صحيحة</span> <span className="text-emerald-600">20 نقطة</span></div>
                    <div className="flex justify-between"><span>5 إجابات صحيحة</span> <span className="text-emerald-600">25 نقطة 🏆</span></div>
                </div>

                {isMedicalEnglishSpecialty && (
                    <p className="text-xs font-bold text-blue-600 bg-blue-50 p-3 rounded-xl mb-6">
                        🌐 الأسئلة ستظهر باللغة الإنجليزية الطبية لتناسب تخصصك.
                    </p>
                )}

                <button
                    onClick={startGame}
                    disabled={starting || loadingQuestions}
                    className="w-full bg-gradient-to-r from-indigo-500 to-blue-500 text-white py-4 rounded-2xl font-black text-lg hover:from-indigo-600 hover:to-blue-600 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
                >
                    {starting || loadingQuestions ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6" />}
                    {loadingQuestions ? 'جاري إعداد التحدي بـ AI...' : starting ? 'جاري التحضير...' : 'ابدأ التحدي الآن!'}
                </button>
            </div>
        );
    }

    // 2. شاشة التقرير التعليمي (بعد اللعبة)
    if (isSummary) {
        const isWin = finalScore > 0;
        return (
            <div className="max-w-2xl mx-auto w-full animate-in slide-in-from-bottom-8 duration-500 pb-20">
                <div className={`bg-white rounded-[2rem] p-6 md:p-8 shadow-xl border-t-8 mb-6 text-center ${isWin ? 'border-emerald-500' : 'border-red-500'}`}>
                    <h2 className="text-3xl font-black text-gray-800 mb-2">
                        {isWin ? 'تهانينا! 🎊' : 'انتهى الوقت! ⏱️'}
                    </h2>
                    <p className="text-gray-500 font-bold text-sm mb-6">
                        لقد أجبت بشكل صحيح على <span className={`text-lg font-black ${isWin ? 'text-emerald-600' : 'text-red-500'}`}>{correctCount} من 5</span>
                    </p>
                    
                    <div className="bg-gray-50 p-4 rounded-2xl inline-block mb-6 border border-gray-100 min-w-[200px]">
                        <span className="block text-xs font-bold text-gray-400 mb-1">النقاط المكتسبة</span>
                        <span className={`text-3xl font-black ${isWin ? 'text-emerald-500' : 'text-gray-500'}`}>{finalScore}</span>
                    </div>
                    
                    <button 
                        onClick={handleFinalComplete}
                        className={`w-full text-white px-8 py-4 rounded-xl font-black shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 ${isWin ? 'bg-emerald-600 shadow-emerald-200 hover:bg-emerald-700' : 'bg-gray-800 shadow-gray-200 hover:bg-gray-900'}`}
                    >
                        {isWin ? 'جمع النقاط والعودة' : 'العودة للقائمة'} <ArrowRight className="w-5 h-5" />
                    </button>
                </div>

                <h3 className="text-lg font-black text-gray-700 mb-4 flex items-center gap-2 px-2">
                    <BookOpen className="w-5 h-5 text-indigo-500" /> المراجعة التعليمية:
                </h3>

                <div className="space-y-4">
                    {history.length === 0 ? (
                        <p className="text-center text-gray-400 font-bold p-8 bg-gray-50 rounded-3xl">لم تقم بالإجابة على أي سؤال!</p>
                    ) : (
                        history.map((item, idx) => (
                            <div key={idx} className={`bg-white p-5 rounded-2xl shadow-sm border-2 ${item.is_correct ? 'border-emerald-100' : 'border-red-100'}`}>
                                <div className="flex items-start justify-between gap-4 mb-3">
                                    <h4 className={`font-black text-sm md:text-base leading-relaxed ${isMedicalEnglishSpecialty ? 'text-left' : 'text-right'}`} dir={isMedicalEnglishSpecialty ? 'ltr' : 'rtl'}>
                                        {idx + 1}. {item.question}
                                    </h4>
                                    {item.is_correct ? <CheckCircle className="w-6 h-6 text-emerald-500 shrink-0"/> : <XCircle className="w-6 h-6 text-red-500 shrink-0"/>}
                                </div>

                                <div className="space-y-2 mt-4" dir={isMedicalEnglishSpecialty ? 'ltr' : 'rtl'}>
                                    <div className="flex flex-col text-sm font-bold">
                                        <span className="text-gray-400 text-xs mb-1">{isMedicalEnglishSpecialty ? 'Your Answer:' : 'إجابتك:'}</span>
                                        <span className={`p-2 rounded-lg ${item.is_correct ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700 line-through'}`}>
                                            {item.options[item.user_answer] || 'لم يتم الاختيار'}
                                        </span>
                                    </div>
                                    
                                    {!item.is_correct && (
                                        <div className="flex flex-col text-sm font-bold mt-2">
                                            <span className="text-gray-400 text-xs mb-1">{isMedicalEnglishSpecialty ? 'Correct Answer:' : 'الإجابة الصحيحة:'}</span>
                                            <span className="p-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                {item.options[item.correct_index]}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {item.explanation && (
                                    <div className={`mt-4 p-3 rounded-xl text-xs md:text-sm font-bold leading-relaxed ${isMedicalEnglishSpecialty ? 'text-left' : 'text-right'} bg-blue-50 text-blue-800`} dir={isMedicalEnglishSpecialty ? 'ltr' : 'rtl'}>
                                        <span className="block opacity-70 mb-1">{isMedicalEnglishSpecialty ? 'Explanation:' : 'التفسير العلمي:'}</span>
                                        {item.explanation}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        );
    }

    // 3. شاشة اللعب
    const currentQ = questions[currentQuestion];
    const options = [currentQ.option_a, currentQ.option_b, currentQ.option_c, currentQ.option_d];

    return (
        <div className="max-w-2xl mx-auto w-full animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-6">
                <div className="bg-white px-5 py-3 rounded-2xl shadow-sm border border-gray-100 font-black text-gray-800">
                    الإجابات الصحيحة: <span className="text-emerald-500 ml-1">{correctCount} / 5</span>
                </div>
                <div className={`px-5 py-3 rounded-2xl font-black shadow-sm flex items-center gap-2 ${timeLeft <= 10 ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-indigo-600 border border-indigo-100'}`}>
                    الوقت: {timeLeft} ث
                </div>
            </div>

            <div className="bg-white rounded-[2rem] p-6 md:p-8 shadow-xl border-b-4 border-indigo-500 mb-6">
                <div className="flex items-start gap-4 mb-6 md:mb-8" dir={isMedicalEnglishSpecialty ? 'ltr' : 'rtl'}>
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-base md:text-lg">
                        {currentQuestion + 1}
                    </div>
                    <h3 className={`text-lg md:text-2xl font-black text-gray-800 leading-relaxed mt-1 ${isMedicalEnglishSpecialty ? 'text-left' : 'text-right'}`}>
                        {currentQ.question}
                    </h3>
                </div>

                <div className="grid grid-cols-1 gap-3" dir={isMedicalEnglishSpecialty ? 'ltr' : 'rtl'}>
                    {options.map((option: string, idx: number) => {
                        let btnClass = 'bg-white border-2 border-gray-100 text-gray-700 hover:border-indigo-300 hover:bg-indigo-50';
                        if (showFeedback) {
                            if (idx === currentQ.correct_index) btnClass = 'bg-emerald-500 border-emerald-600 text-white shadow-lg';
                            else if (idx === selectedAnswer) btnClass = 'bg-red-500 border-red-600 text-white shadow-lg';
                            else btnClass = 'bg-gray-50 border-gray-100 text-gray-400 opacity-50';
                        }
                        return (
                            <button
                                key={idx}
                                onClick={() => handleAnswer(idx)}
                                disabled={showFeedback}
                                className={`${btnClass} p-4 md:p-5 rounded-2xl font-bold text-sm md:text-lg transition-all active:scale-95 flex items-center justify-between ${isMedicalEnglishSpecialty ? 'text-left' : 'text-right'}`}
                            >
                                <span className="flex-1 leading-snug">{option}</span>
                                {showFeedback && idx === currentQ.correct_index && <CheckCircle className="w-5 h-5 md:w-6 md:h-6 flex-shrink-0 ml-2"/>}
                                {showFeedback && idx === selectedAnswer && idx !== currentQ.correct_index && <XCircle className="w-5 h-5 md:w-6 md:h-6 flex-shrink-0 ml-2"/>}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
