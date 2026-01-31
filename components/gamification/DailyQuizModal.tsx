import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { Employee } from '../../types';
import { X, HelpCircle, CheckCircle, XCircle, Trophy, Loader2 } from 'lucide-react';
import confetti from 'canvas-confetti'; // تأثير الاحتفال (تأكد من تثبيته أو حذفه)
import toast from 'react-hot-toast';

// إذا لم ترد تثبيت canvas-confetti، احذف السطر الخاص به وأسطر استدعائه بالأسفل
// npm install canvas-confetti
// npm install @types/canvas-confetti -D

export default function DailyQuizModal({ employee }: { employee: Employee }) {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [question, setQuestion] = useState<any>(null);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        checkDailyStatus();
    }, [employee]);

    const checkDailyStatus = async () => {
        if (!employee) return;
        
        const today = new Date().toISOString().split('T')[0];

        // 1. هل قام الموظف بحل السؤال اليوم؟
        const { data: existingActivity } = await supabase
            .from('daily_activities')
            .select('id')
            .eq('employee_id', employee.employee_id)
            .eq('activity_type', 'daily_quiz')
            .eq('activity_date', today)
            .maybeSingle();

        if (existingActivity) {
            setIsOpen(false); // حل السؤال بالفعل
            return;
        }

        // 2. جلب سؤال مناسب (عام أو خاص بالتخصص)
        // ملاحظة: نستخدم random لجلب سؤال عشوائي (هنا نجلب أول سؤال يطابق الشرط للتبسيط)
        const { data: questions } = await supabase
            .from('quiz_questions')
            .select('*')
            .or(`specialty.eq.all,specialty.eq.${employee.specialty}`);

        if (questions && questions.length > 0) {
            // اختيار سؤال عشوائي
            const randomQ = questions[Math.floor(Math.random() * questions.length)];
            setQuestion(randomQ);
            setLoading(false);
            
            // تأخير ظهور النافذة قليلاً لعدم إزعاج المستخدم فور الدخول
            setTimeout(() => setIsOpen(true), 2000);
        }
    };

    const handleAnswer = async () => {
        if (!selectedOption || !question || isSubmitting) return;
        setIsSubmitting(true);

        const isCorrect = selectedOption === question.correct_answer;
        const today = new Date().toISOString().split('T')[0];

        // 1. تسجيل النشاط (لمنع التكرار)
        await supabase.from('daily_activities').insert({
            employee_id: employee.employee_id,
            activity_type: 'daily_quiz',
            activity_date: today,
            is_completed: true
        });

        if (isCorrect) {
            setResult('correct');
            triggerConfetti(); // احتفال

            // 2. إضافة النقاط
            await supabase.from('points_ledger').insert({
                employee_id: employee.employee_id,
                points: question.points,
                reason: 'إجابة سؤال اليوم بشكل صحيح'
            });

            // 3. تحديث مجموع نقاط الموظف
            // (يفضل عمل Trigger في قاعدة البيانات، لكن سنقوم بها هنا للسرعة)
            await supabase.rpc('increment_points', { 
                emp_id: employee.employee_id, 
                amount: question.points 
            });
            
            toast.success(`أحسنت! حصلت على ${question.points} نقطة 🌟`);
        } else {
            setResult('wrong');
            toast.error('إجابة خاطئة، حظاً أوفر غداً!');
        }
        
        setIsSubmitting(false);
    };

    const triggerConfetti = () => {
        // تأثير بسيط إذا لم تثبت المكتبة احذفه
        try {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            });
        } catch (e) { console.log('Confetti not installed'); }
    };

    if (!isOpen || !question) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative">
                
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white text-center relative">
                    <button 
                        onClick={() => setIsOpen(false)} 
                        className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 p-1 rounded-full text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-md">
                        <Trophy className="w-8 h-8 text-yellow-300 drop-shadow-sm" />
                    </div>
                    <h2 className="text-xl font-black">تحدي اليوم</h2>
                    <p className="text-indigo-100 text-sm font-bold mt-1">جاوب واكسب {question.points} نقطة!</p>
                </div>

                {/* Body */}
                <div className="p-6">
                    {result === null ? (
                        <>
                            <h3 className="text-gray-800 font-bold text-lg mb-4 text-center leading-relaxed">
                                {question.question_text}
                            </h3>
                            
                            <div className="space-y-3">
                                {question.options && typeof question.options === 'string' 
                                    ? JSON.parse(question.options).map((opt: string, idx: number) => (
                                        <button
                                            key={idx}
                                            onClick={() => setSelectedOption(opt)}
                                            className={`w-full p-4 rounded-xl border-2 text-sm font-bold transition-all flex items-center justify-between ${
                                                selectedOption === opt 
                                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                                                : 'border-gray-100 bg-white text-gray-600 hover:border-indigo-200'
                                            }`}
                                        >
                                            {opt}
                                            {selectedOption === opt && <div className="w-3 h-3 bg-indigo-600 rounded-full"></div>}
                                        </button>
                                    ))
                                    : Array.isArray(question.options) && question.options.map((opt: string, idx: number) => (
                                        <button
                                            key={idx}
                                            onClick={() => setSelectedOption(opt)}
                                            className={`w-full p-4 rounded-xl border-2 text-sm font-bold transition-all flex items-center justify-between ${
                                                selectedOption === opt 
                                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                                                : 'border-gray-100 bg-white text-gray-600 hover:border-indigo-200'
                                            }`}
                                        >
                                            {opt}
                                            {selectedOption === opt && <div className="w-3 h-3 bg-indigo-600 rounded-full"></div>}
                                        </button>
                                    ))
                                }
                            </div>

                            <button 
                                onClick={handleAnswer} 
                                disabled={!selectedOption || isSubmitting}
                                className="w-full mt-6 bg-indigo-600 text-white py-3 rounded-xl font-black shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto"/> : 'تأكيد الإجابة'}
                            </button>
                        </>
                    ) : (
                        <div className="text-center py-6 animate-in zoom-in">
                            {result === 'correct' ? (
                                <>
                                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <CheckCircle className="w-10 h-10 text-green-600" />
                                    </div>
                                    <h3 className="text-2xl font-black text-gray-800 mb-2">إجابة صحيحة! 🎉</h3>
                                    <p className="text-gray-500 font-bold mb-6">تم إضافة {question.points} نقطة إلى رصيدك.</p>
                                </>
                            ) : (
                                <>
                                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <XCircle className="w-10 h-10 text-red-600" />
                                    </div>
                                    <h3 className="text-2xl font-black text-gray-800 mb-2">إجابة خاطئة 😔</h3>
                                    <p className="text-gray-500 mb-2 text-sm">الإجابة الصحيحة كانت:</p>
                                    <p className="text-indigo-600 font-black text-lg mb-6">{question.correct_answer}</p>
                                </>
                            )}
                            <button 
                                onClick={() => setIsOpen(false)}
                                className="bg-gray-100 text-gray-700 px-8 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                            >
                                إغلاق
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
