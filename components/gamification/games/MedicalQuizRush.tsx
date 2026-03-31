import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { Brain, CheckCircle, XCircle, Sparkles, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Employee } from '../../../types';
import { DiffProfile, QuizQuestion } from '../../../features/staff/components/arcade/types';

interface Props {
    employee: Employee;
    diffProfile: DiffProfile;
    onStart: () => Promise<void>;
    onComplete: (points: number, isWin: boolean) => void;
}

export default function MedicalQuizRush({ employee, diffProfile, onStart, onComplete }: Props) {
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [score, setScore] = useState(0);
    const [timeLeft, setTimeLeft] = useState(60);
    const [isActive, setIsActive] = useState(false);
    const [starting, setStarting] = useState(false);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [showFeedback, setShowFeedback] = useState(false);
    const [questions, setQuestions] = useState<any[]>([]);

    // 🚀 جلب 8 أسئلة بطلب واحد فقط للذكاء الاصطناعي بدلاً من 8 طلبات منفصلة
    const { data: aiQuestions = [], isLoading: loadingQuestions } = useQuery({
        queryKey: ['smart_quiz_rush', employee.specialty, diffProfile.label],
        queryFn: async () => {
            const { data, error } = await supabase.functions.invoke('generate-smart-quiz', {
                body: {
                    specialty: employee.job_title || 'طبيب بشرى',
                    domain: 'طبي وعلمي',
                    difficulty: diffProfile.label === 'صعب' ? 'صعب' : 'متوسط',
                    length: 'قصير',
                    language: 'ar',
                    include_hint: false,
                    game_type: 'mcq',
                    question_count: 8 // 👈 طلب واحد لـ 8 أسئلة دفعة واحدة
                }
            });

            if (error || !data) {
                console.error('AI Fetch Error:', error);
                return [];
            }
            
            // استخدام Map لفلترة أي أسئلة مكررة 
            const uniqueQuestions = new Map();
            
            // data أصبحت الآن عبارة عن Array جاهزة من الـ AI
            data.forEach((q: any) => {
                if (!uniqueQuestions.has(q.question_text)) {
                    // تحويل إجابة AI الحرفية إلى Index رقمي ليطابق واجهتك القديمة
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

            return Array.from(uniqueQuestions.values());
        },
        staleTime: 0, // لا نخزن الكاش لكي نولد أسئلة جديدة في كل لعبة
        refetchOnWindowFocus: false
    });

    const startGame = async () => {
        if (aiQuestions.length < 3) {
            toast.error('لم نتمكن من جلب أسئلة كافية من الذكاء الاصطناعي، يرجى المحاولة بعد قليل.');
            return;
        }
        setStarting(true);
        try {
            await onStart();
        } catch {
            setStarting(false);
            return;
        }
        
        // خلط الأسئلة الجاهزة
        setQuestions(aiQuestions.sort(() => 0.5 - Math.random()));
        
        setCurrentQuestion(0);
        setScore(0);
        setTimeLeft(60);
        setIsActive(true);
        setStarting(false);
    };

    const endGame = (finalScore: number) => {
        setIsActive(false);
        const winThreshold = diffProfile.points_to_win;
        const isWin = finalScore >= winThreshold;
        onComplete(finalScore, isWin);
    };

    useEffect(() => {
        let timer: ReturnType<typeof setInterval>;
        if (isActive && timeLeft > 0) {
            timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
        } else if (isActive && timeLeft === 0) {
            endGame(score);
        }
        return () => clearInterval(timer);
    }, [isActive, timeLeft, score]);

    const handleAnswer = (idx: number) => {
        if (showFeedback || !isActive) return;
        
        setSelectedAnswer(idx);
        setShowFeedback(true);
        
        const isCorrect = idx === questions[currentQuestion].correct_index;
        
        if (isCorrect) {
            setScore(s => s + diffProfile.points_per_q);
            toast.success('إجابة صحيحة!', { id: 'rush_correct', duration: 1000 });
        } else {
            toast.error('إجابة خاطئة!', { id: 'rush_wrong', duration: 1000 });
        }

        setTimeout(() => {
            if (currentQuestion < questions.length - 1) {
                setCurrentQuestion(curr => curr + 1);
                setSelectedAnswer(null);
                setShowFeedback(false);
            } else {
                endGame(score + (isCorrect ? diffProfile.points_per_q : 0));
            }
        }, 1000);
    };

    if (!isActive) {
        return (
            <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 max-w-lg mx-auto text-center">
                <div className="w-24 h-24 bg-gradient-to-br from-red-100 to-orange-100 rounded-3xl flex items-center justify-center mx-auto mb-6 rotate-12">
                    <Brain className="w-12 h-12 text-red-500 -rotate-12" />
                </div>
                <h3 className="text-2xl font-black text-gray-800 mb-2">سباق المعرفة الطبي</h3>
                <p className="text-gray-500 font-bold text-sm mb-6">أجب على أكبر عدد من الأسئلة في 60 ثانية!</p>
                
                <div className="bg-gray-50 p-4 rounded-2xl mb-8 flex justify-around">
                    <div>
                        <span className="block text-xs font-bold text-gray-400 mb-1">النقاط للنجاح</span>
                        <span className="text-xl font-black text-gray-800">{diffProfile.points_to_win} نقطة</span>
                    </div>
                    <div>
                        <span className="block text-xs font-bold text-gray-400 mb-1">الوقت</span>
                        <span className="text-xl font-black text-red-500">60 ثانية</span>
                    </div>
                </div>

                <button
                    onClick={startGame}
                    disabled={starting || loadingQuestions}
                    className="w-full bg-gradient-to-r from-red-500 to-orange-500 text-white py-4 rounded-2xl font-black text-lg hover:from-red-600 hover:to-orange-600 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-red-200 disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
                >
                    {starting || loadingQuestions ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6" />}
                    {loadingQuestions ? 'جاري إعداد الأسئلة بـ AI...' : starting ? 'جاري التحضير...' : 'ابدأ السباق الآن!'}
                </button>
            </div>
        );
    }

    const currentQ = questions[currentQuestion];
    const options = [currentQ.option_a, currentQ.option_b, currentQ.option_c, currentQ.option_d];

    return (
        <div className="max-w-2xl mx-auto w-full animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-6">
                <div className="bg-white px-5 py-3 rounded-2xl shadow-sm border border-gray-100 font-black text-gray-800">
                    النقاط: <span className="text-emerald-500 ml-1">{score}</span>
                </div>
                <div className={`px-5 py-3 rounded-2xl font-black shadow-sm flex items-center gap-2 ${timeLeft <= 10 ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-red-500 border border-red-100'}`}>
                    الوقت: {timeLeft} ث
                </div>
            </div>

            <div className="bg-white rounded-[2rem] p-8 shadow-xl border-b-4 border-red-500 mb-6">
                <div className="flex items-start gap-4 mb-8">
                    <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center flex-shrink-0 font-black text-lg">
                        {currentQuestion + 1}
                    </div>
                    <h3 className="text-xl md:text-2xl font-black text-gray-800 leading-relaxed mt-1">
                        {currentQ.question}
                    </h3>
                </div>

                <div className="grid grid-cols-1 gap-3">
                    {options.map((option: string, idx: number) => {
                        let btnClass = 'bg-white border-2 border-gray-100 text-gray-700 hover:border-red-300 hover:bg-red-50';
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
                                className={`${btnClass} p-5 rounded-2xl font-bold text-sm md:text-lg transition-all active:scale-95 text-right flex items-center justify-between`}
                            >
                                <span>{option}</span>
                                {showFeedback && idx === currentQ.correct_index && <CheckCircle className="w-6 h-6 flex-shrink-0"/>}
                                {showFeedback && idx === selectedAnswer && idx !== currentQ.correct_index && <XCircle className="w-6 h-6 flex-shrink-0"/>}
                            </button>
                        );
                    })}
                </div>
                
                {/* عرض التفسير بعد الإجابة */}
                {showFeedback && currentQ.explanation && (
                    <div className="mt-6 p-4 rounded-xl text-sm font-bold animate-in slide-in-from-bottom-4 bg-emerald-50 text-emerald-800 border border-emerald-200 text-center">
                        {currentQ.explanation}
                    </div>
                )}
            </div>
        </div>
    );
}
