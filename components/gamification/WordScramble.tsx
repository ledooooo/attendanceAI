import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Loader2, Brain, HelpCircle, Send } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
    difficulty: string;
    points: number;
    onWin: (points: number, diffLabel: string) => void;
    onLose: () => void;
    onBack: () => void;
}

export default function WordScramble({ difficulty, points, onWin, onLose, onBack }: Props) {
    const [wordData, setWordData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [guess, setGuess] = useState('');
    const [scrambled, setScrambled] = useState('');
    const [timeLeft, setTimeLeft] = useState(60);

    useEffect(() => {
        const fetchWord = async () => {
            const { data } = await supabase.from('arcade_scramble_words').select('*').eq('difficulty', difficulty);
            if (data && data.length > 0) {
                const randomWord = data[Math.floor(Math.random() * data.length)];
                setWordData(randomWord);
                setScrambled(randomWord.word.split('').sort(() => 0.5 - Math.random()).join(''));
            } else {
                toast.error('لا توجد كلمات متاحة لهذا المستوى حالياً.');
                onBack();
            }
            setLoading(false);
        };
        fetchWord();
    }, [difficulty]);

    useEffect(() => {
        if (!wordData || timeLeft <= 0) {
            if (timeLeft <= 0) onLose();
            return;
        }
        const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
        return () => clearInterval(timer);
    }, [timeLeft, wordData]);

    const handleSubmit = () => {
        if (guess.trim().toLowerCase() === wordData.word.trim().toLowerCase()) {
            onWin(points, difficulty);
        } else {
            toast.error('إجابة خاطئة! حاول مرة أخرى');
            setGuess('');
        }
    };

    if (loading) return <div className="py-20 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-purple-500" /></div>;
    if (!wordData) return null;

    return (
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border space-y-6 animate-in zoom-in-95">
            <div className="flex justify-between items-center border-b pb-4">
                <h3 className="font-black text-xl text-purple-700 flex items-center gap-2"><Brain /> الكلمات المبعثرة</h3>
                <div className={`font-black text-xl px-4 py-1 rounded-xl ${timeLeft <= 10 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 text-gray-700'}`}>{timeLeft}ث</div>
            </div>
            <div className="text-center py-8">
                <p className="text-gray-500 font-bold mb-4">رتب الحروف التالية لتكوين المصطلح الطبي الصحيح:</p>
                <div className="text-4xl md:text-5xl font-black text-gray-800 tracking-[0.5em] md:tracking-[1em] mb-8 bg-purple-50 py-6 rounded-2xl border-2 border-purple-100 uppercase" dir="ltr">
                    {scrambled}
                </div>
                <div className="bg-blue-50 text-blue-700 p-4 rounded-xl text-sm font-bold flex items-start gap-2 text-right mb-6">
                    <HelpCircle className="w-5 h-5 shrink-0" />
                    <span>تلميح: {wordData.hint}</span>
                </div>
                <input 
                    type="text" dir="ltr" value={guess} onChange={(e) => setGuess(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    className="w-full text-center text-2xl font-black p-4 border-2 border-gray-200 rounded-2xl outline-none focus:border-purple-500 uppercase transition-colors mb-4"
                    placeholder="اكتب الكلمة هنا..."
                />
                <button onClick={handleSubmit} className="w-full bg-purple-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2">
                    <Send className="w-5 h-5" /> تحقق من الإجابة
                </button>
            </div>
        </div>
    );
}
