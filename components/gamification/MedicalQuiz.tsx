import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Loader2, HelpCircle, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
    difficulty: string;
    points: number;
    specialty: string;
    onWin: (points: number, diffLabel: string) => void;
    onLose: () => void;
    onBack: () => void;
}

export default function MedicalQuiz({ difficulty, points, specialty, onWin, onLose, onBack }: Props) {
    const [questions, setQuestions] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [timeLeft, setTimeLeft] = useState(15);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);

    useEffect(() => {
        const fetchQuestions = async () => {
            const { data } = await supabase.from('arcade_quiz_questions').select('*').eq('difficulty', difficulty).limit(5);
            if (data && data.length > 0) {
                setQuestions(data.sort(() => 0.5 - Math.random()).slice(0, 3)); // 3 أسئلة
            } else {
                toast.error('لا توجد أسئلة كافية لهذا المستوى.');
                onBack();
            }
            setLoading(false);
        };
        fetchQuestions();
    }, [difficulty]);

    useEffect(() => {
        if (loading || selectedAnswer !== null || timeLeft <= 0) {
            if (timeLeft <= 0 && selectedAnswer === null) handleAnswer(-1); // Time out
            return;
        }
        const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
        return () => clearInterval(timer);
    }, [timeLeft, loading, selectedAnswer]);

    const handleAnswer = (index: number) => {
        setSelectedAnswer(index);
        const currentQ = questions[currentIndex];
        
        setTimeout(() => {
            if (index === currentQ.correct_index) {
                if (currentIndex + 1 < questions.length) {
                    setCurrentIndex(prev => prev + 1);
                    setSelectedAnswer(null);
                    setTimeLeft(15);
                } else {
                    onWin(points, difficulty); // نجح في كل الأسئلة
                }
            } else {
                onLose(); // أخطأ
            }
        }, 1500);
    };

    if (loading) return <div className="py-20 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-blue-500" /></div>;
    if (questions.length === 0) return null;

    const currentQ = questions[currentIndex];

    return (
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border space-y-6 animate-in zoom-in-95">
            <div className="flex justify-between items-center border-b pb-4">
                <h3 className="font-black text-xl text-blue-700 flex items-center gap-2"><HelpCircle /> الاختبار السريع ({currentIndex + 1}/{questions.length})</h3>
                <div className={`font-black text-xl px-4 py-1 rounded-xl ${timeLeft <= 5 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 text-gray-700'}`}>{timeLeft}ث</div>
            </div>
            <div className="py-6">
                <h4 className="text-xl md:text-2xl font-black text-gray-800 text-center mb-8 leading-relaxed bg-blue-50 p-6 rounded-2xl">{currentQ.question}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[currentQ.option_a, currentQ.option_b, currentQ.option_c, currentQ.option_d].map((opt, idx) => {
                        if (!opt) return null;
                        const isSelected = selectedAnswer === idx;
                        const isCorrect = currentQ.correct_index === idx;
                        let btnClass = 'bg-white border-gray-200 text-gray-700 hover:border-blue-400 hover:bg-blue-50';
                        if (selectedAnswer !== null) {
                            if (isCorrect) btnClass = 'bg-green-500 text-white border-green-600 shadow-lg';
                            else if (isSelected) btnClass = 'bg-red-500 text-white border-red-600 shadow-lg';
                            else btnClass = 'bg-gray-50 border-gray-100 text-gray-400 opacity-50';
                        }

                        return (
                            <button key={idx} onClick={() => handleAnswer(idx)} disabled={selectedAnswer !== null} className={`p-4 rounded-2xl border-2 font-bold text-sm md:text-base transition-all active:scale-95 ${btnClass}`}>
                                <div className="flex items-center justify-between">
                                    <span>{opt}</span>
                                    {selectedAnswer !== null && isCorrect && <CheckCircle className="w-5 h-5"/>}
                                    {selectedAnswer !== null && isSelected && !isCorrect && <XCircle className="w-5 h-5"/>}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
