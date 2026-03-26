import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Dices, HelpCircle, Clock, Star, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Employee } from '../../../types';
import { DiffProfile, applyMultiplier } from '../../../features/staff/components/arcade/types';

interface Props {
    employee: Employee;
    diffProfile: DiffProfile;
    onStart: () => Promise<void>;
    onComplete: (points: number, isWin: boolean) => void;
}

type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; basePoints: number; timeLimit: number; level: number }> = {
    easy:   { label: 'سهل',     basePoints: 5,  timeLimit: 20, level: 3  },
    medium: { label: 'متوسط',   basePoints: 10, timeLimit: 15, level: 6  },
    hard:   { label: 'صعب',     basePoints: 20, timeLimit: 12, level: 10 },
    expert: { label: 'صعب جداً', basePoints: 30, timeLimit: 10, level: 14 },
};

// دالة جلب السؤال باستخدام generate-beast-question مع fallback محلي
async function fetchQuestionWithAI(specialty: string, difficulty: Difficulty): Promise<any> {
    const level = DIFFICULTY_CONFIG[difficulty].level;
    try {
        // استدعاء الدالة الموجودة
        const { data, error } = await supabase.functions.invoke('generate-beast-question', {
            body: { specialty, level, usedTopics: [] }, // usedTopics يمكن تركها فارغة أو تمرير تاريخ الأسئلة إن أردت
        });
        if (error || !data) throw new Error('AI request failed');
        if (data.error) throw new Error(data.error);
        
        // التحقق من صحة البيانات القادمة من الدالة
        // الدالة تعيد { question, options, correct, explanation, topic, provider }
        if (!data.question || !data.options || data.correct === undefined) {
            throw new Error('Invalid question format from AI');
        }
        // تحويل correct (رقم الفهرس) إلى النص الصحيح
        const correctAnswer = data.options[data.correct];
        return {
            source: 'ai',
            provider: data.provider || 'AI',
            question: data.question,
            options: data.options,
            correct_answer: correctAnswer,
            explanation: data.explanation,
        };
    } catch (err) {
        console.warn('AI fallback:', err);
        // الرجوع إلى بنك الأسئلة المحلي
        const { data: localQuestions, error: localError } = await supabase
            .from('quiz_questions')
            .select('*')
            .or(`specialty.ilike.%${specialty}%,specialty.ilike.%الكل%`)
            .limit(30);
        
        if (localError || !localQuestions || localQuestions.length === 0) {
            throw new Error('No questions available locally');
        }
        
        const random = localQuestions[Math.floor(Math.random() * localQuestions.length)];
        let options: string[] = [];
        if (random.options) {
            if (Array.isArray(random.options)) options = random.options;
            else {
                try { options = JSON.parse(random.options); } catch { options = random.options.split(',').map(s => s.trim()); }
            }
        }
        return {
            source: 'local',
            question: random.question_text,
            options,
            correct_answer: random.correct_answer,
        };
    }
}

export default function SpinAndAnswerGame({ employee, diffProfile, onStart, onComplete }: Props) {
    const [difficulty, setDifficulty] = useState<Difficulty>('medium');
    const [phase, setPhase] = useState<'difficulty' | 'loading' | 'question'>('difficulty');
    const [question, setQuestion] = useState<any>(null);
    const [pointsWon, setPointsWon] = useState(0);
    const [timeLeft, setTimeLeft] = useState(15);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const basePoints = DIFFICULTY_CONFIG[difficulty].basePoints;
    const finalPoints = applyMultiplier(basePoints, diffProfile);
    const timeLimit = DIFFICULTY_CONFIG[difficulty].timeLimit;

    const startGame = async () => {
        setError(null);
        setPhase('loading');
        setLoading(true);
        try {
            await onStart(); // خصم المحاولة
            const q = await fetchQuestionWithAI(employee.specialty, difficulty);
            setQuestion(q);
            setPointsWon(finalPoints);
            setTimeLeft(timeLimit);
            setPhase('question');
        } catch (err: any) {
            const msg = err.message || 'فشل في تحميل السؤال، حاول مرة أخرى';
            setError(msg);
            toast.error(msg);
            setPhase('difficulty');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let timer: ReturnType<typeof setInterval>;
        if (phase === 'question' && timeLeft > 0) {
            timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
        } else if (phase === 'question' && timeLeft === 0) {
            onComplete(0, false);
            setPhase('difficulty');
        }
        return () => clearInterval(timer);
    }, [phase, timeLeft, onComplete]);

    const handleAnswer = (answer: string) => {
        if (phase !== 'question') return;
        const isCorrect = answer.trim().toLowerCase() === question.correct_answer.trim().toLowerCase();
        if (isCorrect) {
            onComplete(pointsWon, true);
        } else {
            onComplete(0, false);
        }
        setPhase('difficulty');
    };

    // شاشة اختيار الصعوبة
    if (phase === 'difficulty') {
        return (
            <div className="text-center py-8 animate-in fade-in duration-300" dir="rtl">
                <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md mx-auto">
                    <div className="flex items-center justify-center mb-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                            <Sparkles className="w-8 h-8 text-white" />
                        </div>
                    </div>
                    <h3 className="text-xl font-black text-gray-800 mb-2">اختر مستوى الصعوبة</h3>
                    <p className="text-sm text-gray-500 mb-6">كلما زادت الصعوبة، زادت النقاط</p>
                    
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        {Object.entries(DIFFICULTY_CONFIG).map(([key, config]) => {
                            const diffKey = key as Difficulty;
                            const pointsAfterMultiplier = applyMultiplier(config.basePoints, diffProfile);
                            return (
                                <button
                                    key={key}
                                    onClick={() => setDifficulty(diffKey)}
                                    className={`p-3 rounded-xl border-2 transition-all ${
                                        difficulty === diffKey
                                            ? 'border-violet-500 bg-violet-50 shadow-md'
                                            : 'border-gray-200 hover:border-violet-300'
                                    }`}
                                >
                                    <p className="font-black text-gray-800">{config.label}</p>
                                    <p className="text-sm font-bold text-violet-600">{config.basePoints} نقطة</p>
                                    <p className="text-[10px] text-gray-400">×{diffProfile.multiplier.toFixed(1)} = {pointsAfterMultiplier}</p>
                                </button>
                            );
                        })}
                    </div>
                    
                    <div className="bg-indigo-50 rounded-xl p-3 mb-6 text-center">
                        <p className="text-xs font-bold text-indigo-700">مضاعف {diffProfile.emoji} {diffProfile.label}</p>
                        <p className="text-2xl font-black text-indigo-800">×{diffProfile.multiplier.toFixed(1)}</p>
                    </div>
                    
                    <button
                        onClick={startGame}
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white py-4 rounded-2xl font-black shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Dices className="w-5 h-5" />}
                        {loading ? 'جاري التحضير...' : 'ابدأ اللعبة'}
                    </button>
                    
                    {error && (
                        <div className="mt-4 text-red-500 text-sm flex items-center justify-center gap-1">
                            <AlertCircle className="w-4 h-4" /> {error}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (phase === 'loading') {
        return (
            <div className="text-center py-16 animate-in fade-in duration-300">
                <div className="flex flex-col items-center justify-center">
                    <Loader2 className="w-16 h-16 text-violet-500 animate-spin mb-4" />
                    <p className="text-gray-600 font-bold">جاري تحضير السؤال...</p>
                    <p className="text-xs text-gray-400 mt-1">قد يستغرق ذلك بضع ثوانٍ</p>
                </div>
            </div>
        );
    }

    if (phase === 'question' && question) {
        let options: string[] = [];
        if (Array.isArray(question.options)) {
            options = question.options;
        } else if (typeof question.options === 'string') {
            try {
                options = JSON.parse(question.options);
            } catch {
                options = question.options.split(',').map((s: string) => s.trim());
            }
        }
        
        return (
            <div className="text-center py-4 animate-in slide-in-from-right max-w-3xl mx-auto" dir="rtl">
                <div className="flex justify-between items-center mb-6 px-4">
                    <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-5 py-2 rounded-xl font-black shadow-lg flex items-center gap-2">
                        <Clock className="w-4 h-4 animate-pulse" /> {timeLeft} ثانية
                    </div>
                    <div className="bg-gradient-to-r from-amber-400 to-yellow-500 text-white px-5 py-2 rounded-xl font-black shadow-lg flex items-center gap-2">
                        <Star className="w-4 h-4" /> الجائزة: {pointsWon} نقطة
                    </div>
                    <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-5 py-2 rounded-xl font-black shadow-lg flex items-center gap-2">
                        <Sparkles className="w-4 h-4" /> {DIFFICULTY_CONFIG[difficulty].label}
                    </div>
                </div>
                
                <div className="bg-gradient-to-br from-violet-50 to-fuchsia-50 p-8 rounded-3xl mb-8 border-2 border-violet-200 shadow-xl">
                    <HelpCircle className="w-14 h-14 text-violet-500 mx-auto mb-4 animate-bounce" />
                    <h3 className="text-2xl font-black text-violet-900 leading-relaxed">{question.question}</h3>
                    {question.source === 'ai' && (
                        <p className="text-xs text-violet-400 mt-4 flex items-center justify-center gap-1">
                            <Sparkles className="w-3 h-3" /> تم توليد هذا السؤال بواسطة {question.provider || 'الذكاء الاصطناعي'}
                        </p>
                    )}
                    {question.source === 'local' && (
                        <p className="text-xs text-gray-400 mt-4 flex items-center justify-center gap-1">
                            <AlertCircle className="w-3 h-3" /> من بنك الأسئلة المحلي
                        </p>
                    )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {options.map((opt: string, idx: number) => (
                        <button
                            key={idx}
                            onClick={() => handleAnswer(opt)}
                            className="bg-white border-2 border-gray-200 p-5 rounded-2xl font-bold text-gray-800 hover:border-violet-500 hover:bg-violet-50 hover:scale-105 transition-all active:scale-95 shadow-md hover:shadow-xl text-lg"
                        >
                            {opt}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    return null;
}
