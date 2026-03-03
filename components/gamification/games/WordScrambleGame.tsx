import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { Timer, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { Employee } from '../../../types';
import { DiffProfile, ScrambleWord, applyMultiplier, pickDifficultySet } from '../../../features/staff/components/arcade/types';

interface Props {
    employee: Employee;
    diffProfile: DiffProfile;
    onStart: () => Promise<void>;
    onComplete: (points: number, isWin: boolean) => void;
}

export default function WordScrambleGame({ employee, diffProfile, onStart, onComplete }: Props) {
    const [wordObj, setWordObj] = useState<ScrambleWord | null>(null);
    const [scrambledArray, setScrambledArray] = useState<string[]>([]);
    const [input, setInput] = useState('');
    const [timeLeft, setTimeLeft] = useState(20);
    const [isActive, setIsActive] = useState(false);
    const [starting, setStarting] = useState(false);

    const { data: words = [], isLoading: loadingWords } = useQuery({
        queryKey: ['arcade_scramble_words', employee.specialty],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('arcade_scramble_words')
                .select('id, word, hint, difficulty, specialty')
                .eq('is_active', true);
            if (error) throw error;
            return ((data || []).filter((w: any) =>
                !w.specialty || w.specialty.includes('الكل') || w.specialty.includes(employee.specialty)
            )) as ScrambleWord[];
        },
        staleTime: 600000,
    });

    const startGame = async () => {
        if (words.length === 0) { toast.error('لا توجد كلمات متاحة حالياً'); return; }
        setStarting(true);
        try { await onStart(); } catch { setStarting(false); return; }
        const [targetDiff] = pickDifficultySet(diffProfile, 1);
        const pool = words.filter(w => w.difficulty === targetDiff);
        const finalPool = pool.length > 0 ? pool : words;
        const randomWord = finalPool[Math.floor(Math.random() * finalPool.length)];
        setWordObj(randomWord);
        setScrambledArray(randomWord.word.split('').sort(() => 0.5 - Math.random()));
        setTimeLeft(20);
        setInput('');
        setIsActive(true);
        setStarting(false);
    };

    useEffect(() => {
        let timer: ReturnType<typeof setInterval>;
        if (isActive && timeLeft > 0) timer = setInterval(() => setTimeLeft(p => p - 1), 1000);
        else if (isActive && timeLeft === 0) { setIsActive(false); onComplete(0, false); }
        return () => clearInterval(timer);
    }, [isActive, timeLeft, onComplete]);

    const checkAnswer = () => {
        if (!wordObj) return;
        if (input.trim() === wordObj.word) {
            setIsActive(false);
            onComplete(applyMultiplier(Math.max(5, Math.floor(timeLeft)), diffProfile), true);
        } else {
            toast.error('كلمة خاطئة! حاول مرة أخرى', { icon: '❌' });
            setInput('');
        }
    };

    const currentPoints = applyMultiplier(Math.max(5, timeLeft), diffProfile);

    if (!isActive) {
        return (
            <div className="text-center py-12">
                <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
                    <Timer className="w-14 h-14 text-white animate-pulse"/>
                </div>
                <h3 className="text-3xl font-black text-gray-800 mb-3">فك الشفرة! 🧩</h3>
                <p className="text-base font-bold text-gray-600 mb-4 max-w-md mx-auto">النقاط تتناقص كل ثانية! رتب الحروف المبعثرة واكتب الكلمة بأسرع ما يمكن.</p>
                <p className="text-sm font-bold text-blue-600 mb-6 flex items-center justify-center gap-1">
                    <Sparkles className="w-4 h-4"/> مستواك {diffProfile.emoji}: صعوبة مخصصة ×{diffProfile.multiplier.toFixed(1)} نقاط
                </p>
                {loadingWords
                    ? <p className="text-gray-400 font-bold mb-4">⏳ جاري تحميل الكلمات...</p>
                    : words.length === 0
                        ? <p className="text-red-400 font-bold mb-4">⚠️ لا توجد كلمات متاحة حالياً</p>
                        : null
                }
                <button
                    onClick={startGame}
                    disabled={starting || loadingWords || words.length === 0}
                    className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-10 py-4 rounded-2xl font-black shadow-2xl hover:scale-105 transition-all disabled:opacity-50 text-lg"
                >
                    {starting ? '⏳ جاري البدء...' : '🚀 ابدأ التحدي'}
                </button>
            </div>
        );
    }

    return (
        <div className="text-center py-10 max-w-2xl mx-auto animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-10 px-4">
                <div className={`px-6 py-3 rounded-2xl font-black text-xl shadow-lg transition-all ${timeLeft > 10 ? 'bg-blue-500 text-white' : 'bg-red-500 text-white animate-pulse'}`}>
                    ⏱️ {timeLeft} ث
                </div>
                <div className="bg-gradient-to-r from-violet-500 to-purple-600 text-white px-6 py-3 rounded-2xl font-black shadow-lg">
                    💎 الآن: {currentPoints} نقطة
                </div>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-4 rounded-3xl mb-3 border-2 border-blue-200">
                <p className="text-sm font-bold text-blue-700 mb-2">💡 تلميح:</p>
                <p className="text-base font-black text-gray-800">{wordObj?.hint}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-3 mb-12 p-6 bg-white rounded-3xl shadow-xl border-2 border-gray-100" dir="ltr">
                {scrambledArray.map((letter, idx) => (
                    <div key={idx} className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 border-4 border-blue-200 rounded-2xl flex items-center justify-center text-3xl font-black text-white shadow-lg transform hover:scale-110 transition-transform">
                        {letter}
                    </div>
                ))}
            </div>
            <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && checkAnswer()}
                className="w-full text-center text-2xl font-black p-6 bg-gray-50 border-4 border-blue-300 focus:border-blue-500 outline-none rounded-3xl mb-6 transition-all shadow-lg"
                placeholder="اكتب الكلمة مجمعة هنا..."
                autoFocus
            />
            <button
                onClick={checkAnswer}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-5 rounded-3xl font-black shadow-2xl hover:scale-105 active:scale-95 transition-all text-xl"
            >
                ✅ تحقق من الإجابة (الجائزة: {currentPoints} نقطة)
            </button>
        </div>
    );
}
