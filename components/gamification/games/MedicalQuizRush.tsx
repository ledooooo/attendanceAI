import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { Brain, CheckCircle, XCircle, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { Employee } from '../../../types';
import { DiffProfile, QuizQuestion, applyMultiplier, pickDifficultySet } from '../../../features/staff/components/arcade/types';

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
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);

    const { data: allQuestions = [], isLoading: loadingQuestions } = useQuery({
        queryKey: ['arcade_quiz_questions', employee.specialty],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('arcade_quiz_questions')
                .select('id, question, option_a, option_b, option_c, option_d, correct_index, difficulty, specialty')
                .eq('is_active', true);
            if (error) throw error;
            return ((data || []).filter((q: any) =>
                !q.specialty || q.specialty.includes('الكل') || q.specialty.includes(employee.specialty)
            )) as QuizQuestion[];
        },
        staleTime: 600000,
    });

    const startGame = async () => {
        if (allQuestions.length < 5) { toast.error('لا توجد أسئلة كافية حالياً'); return; }
        setStarting(true);
        try { await onStart(); } catch { setStarting(false); return; }
        const diffSet = pickDifficultySet(diffProfile, 5);
        const selected: QuizQuestion[] = [];
        for (const diff of diffSet) {
            const pool = allQuestions.filter(q => q.difficulty === diff && !selected.find(s => s.id === q.id));
            const fallback = allQuestions.filter(q => !selected.find(s => s.id === q.id));
            const source = pool.length > 0 ? pool : fallback;
            if (source.length > 0) selected.push(source[Math.floor(Math.random() * source.length)]);
        }
        if (selected.length < 5) {
            const remaining = allQuestions.filter(q => !selected.find(s => s.id === q.id)).sort(() => Math.random() - 0.5);
            selected.push(...remaining.slice(0, 5 - selected.length));
        }
        setQuestions(selected.sort(() => Math.random() - 0.5));
        setCurrentQuestion(0);
        setScore(0);
        setTimeLeft(60);
        setSelectedAnswer(null);
        setShowFeedback(false);
        setIsActive(true);
        setStarting(false);
    };

    useEffect(() => {
        let timer: ReturnType<typeof setInterval>;
        if (isActive && timeLeft > 0) timer = setInterval(() => setTimeLeft(p => p - 1), 1000);
        else if (isActive && timeLeft === 0) { setIsActive(false); onComplete(0, false); }
        return () => clearInterval(timer);
    }, [isActive, timeLeft, onComplete]);

    const handleAnswer = (answerIndex: number) => {
        if (showFeedback) return;
        setSelectedAnswer(answerIndex);
        setShowFeedback(true);
        const isCorrect = answerIndex === questions[currentQuestion].correct_index;
        if (isCorrect) setScore(prev => prev + 1);
        setTimeout(() => {
            if (currentQuestion < questions.length - 1) {
                setCurrentQuestion(prev => prev + 1);
                setSelectedAnswer(null);
                setShowFeedback(false);
            } else {
                setIsActive(false);
                const finalScore = score + (isCorrect ? 1 : 0);
                
                // حساب النقاط الأساسية ثم تطبيق المضاعف
                const rawTotal = finalScore * 3 + Math.floor(timeLeft / 3);
                let total = applyMultiplier(rawTotal, diffProfile);
                
                // ✅ جعل الحد الأقصى للنقاط 30 نقطة فقط مهما بلغ الحساب
                total = Math.min(30, total);
                
                if (finalScore >= 3) {
                    toast.success(`رائع! ${finalScore}/5 إجابات صحيحة! 🎉`);
                    onComplete(total, true);
                } else {
                    toast.error(`حاول مرة أخرى! ${finalScore}/5 فقط 💔`);
                    onComplete(0, false);
                }
            }
        }, 1500);
    };

    if (!isActive) {
        return (
            <div className="text-center py-12">
                <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
                    <Brain className="w-14 h-14 text-white animate-pulse"/>
                </div>
                <h3 className="text-3xl font-black text-gray-800 mb-3">سباق المعرفة الطبية! 🏃‍♂️</h3>
                <p className="text-base font-bold text-gray-600 mb-4 max-w-lg mx-auto">أجب على 5 أسئلة طبية بأسرع وقت ممكن. كل ثانية توفرها = نقاط إضافية!</p>
                <p className="text-sm font-bold text-indigo-600 mb-6 flex items-center justify-center gap-1">
                    <Sparkles className="w-4 h-4"/> مستواك {diffProfile.emoji}: أسئلة مخصصة ×{diffProfile.multiplier.toFixed(1)} نقاط
                </p>
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-4 rounded-3xl max-w-md mx-auto mb-8 border-2 border-indigo-200">
                    <div className="grid grid-cols-2 gap-4 text-sm font-bold">
                        <div className="bg-white p-3 rounded-xl shadow-sm"><p className="text-indigo-600">⏱️ الوقت المحدد</p><p className="text-2xl text-gray-800">60 ثانية</p></div>
                        <div className="bg-white p-3 rounded-xl shadow-sm"><p className="text-indigo-600">❓ عدد الأسئلة</p><p className="text-2xl text-gray-800">5 أسئلة</p></div>
                        <div className="bg-white p-3 rounded-xl shadow-sm col-span-2"><p className="text-indigo-600">🎯 شرط النجاح</p><p className="text-lg text-gray-800">3 إجابات صحيحة على الأقل</p></div>
                    </div>
                </div>
                <button
                    onClick={startGame}
                    disabled={starting || loadingQuestions || allQuestions.length < 5}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-10 py-4 rounded-2xl font-black shadow-2xl hover:scale-105 transition-all disabled:opacity-50 text-lg"
                >
                    {loadingQuestions ? '⏳ جاري التحميل...' : starting ? '⏳ جاري البدء...' : '🚀 ابدأ السباق'}
                </button>
            </div>
        );
    }

    const currentQ = questions[currentQuestion];
    const opts = [currentQ.option_a, currentQ.option_b, currentQ.option_c, currentQ.option_d];

    return (
        <div className="max-w-3xl mx-auto py-8 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-8 px-4">
                <div className={`px-6 py-3 rounded-2xl font-black text-xl shadow-lg ${timeLeft > 20 ? 'bg-indigo-500 text-white' : 'bg-red-500 text-white animate-pulse'}`}>
                    ⏱️ {timeLeft} ث
                </div>
                <div className="bg-white px-6 py-3 rounded-2xl font-black shadow-lg border-2 border-indigo-200">
                    <span className="text-indigo-600">{currentQuestion + 1}</span><span className="text-gray-400"> / 5</span>
                </div>
                <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-6 py-3 rounded-2xl font-black shadow-lg">
                    ✅ {score} صحيحة
                </div>
            </div>
            <div className="w-full bg-gray-200 h-3 rounded-full mb-8 overflow-hidden shadow-inner">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-300 rounded-full" style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}></div>
            </div>
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-8 rounded-3xl mb-8 border-2 border-indigo-200 shadow-xl">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white font-black text-xl flex-shrink-0 shadow-lg">
                        {currentQuestion + 1}
                    </div>
                    <h3 className="text-xl md:text-2xl font-black text-gray-900 leading-relaxed">{currentQ.question}</h3>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {opts.map((option, idx) => {
                    let btnClass = 'bg-white border-2 border-gray-200 hover:border-indigo-400 hover:bg-indigo-50 text-gray-800';
                    if (showFeedback) {
                        if (idx === currentQ.correct_index) btnClass = 'bg-gradient-to-br from-emerald-400 to-emerald-600 border-emerald-600 text-white';
                        else if (idx === selectedAnswer) btnClass = 'bg-gradient-to-br from-red-400 to-red-600 border-red-600 text-white';
                        else btnClass = 'bg-gray-100 border-gray-200 text-gray-400';
                    }
                    return (
                        <button
                            key={idx}
                            onClick={() => handleAnswer(idx)}
                            disabled={showFeedback}
                            className={`${btnClass} p-5 rounded-2xl font-bold text-lg transition-all hover:scale-105 active:scale-95 shadow-md hover:shadow-xl disabled:cursor-not-allowed text-right flex items-center gap-3`}
                        >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0 ${showFeedback && idx === currentQ.correct_index ? 'bg-white text-emerald-600' : showFeedback && idx === selectedAnswer ? 'bg-white text-red-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                {String.fromCharCode(65 + idx)}
                            </div>
                            <span className="flex-1">{option}</span>
                            {showFeedback && idx === currentQ.correct_index && <CheckCircle className="w-6 h-6 flex-shrink-0"/>}
                            {showFeedback && idx === selectedAnswer && idx !== currentQ.correct_index && <XCircle className="w-6 h-6 flex-shrink-0"/>}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
