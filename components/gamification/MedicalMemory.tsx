import React, { useState, useEffect } from 'react';
import { Loader2, Copy } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
    difficulty: string;
    points: number;
    onWin: (points: number, diffLabel: string) => void;
    onLose: () => void;
    onBack: () => void;
}

const CARDS_DATA = [
    { id: 1, text: 'CPR', pairId: 1 }, { id: 2, text: 'إنعاش قلبي', pairId: 1 },
    { id: 3, text: 'ECG', pairId: 2 }, { id: 4, text: 'رسم قلب', pairId: 2 },
    { id: 5, text: 'HTN', pairId: 3 }, { id: 6, text: 'ضغط دم', pairId: 3 },
    { id: 7, text: 'DM', pairId: 4 }, { id: 8, text: 'سكري', pairId: 4 },
];

export default function MedicalMemory({ difficulty, points, onWin, onLose, onBack }: Props) {
    const [cards, setCards] = useState<any[]>([]);
    const [flipped, setFlipped] = useState<number[]>([]);
    const [matched, setMatched] = useState<number[]>([]);
    const [timeLeft, setTimeLeft] = useState(30);

    useEffect(() => {
        // خلط البطاقات عند بدء اللعبة
        setCards([...CARDS_DATA].sort(() => 0.5 - Math.random()));
    }, []);

    useEffect(() => {
        if (timeLeft <= 0 && matched.length < CARDS_DATA.length) {
            onLose();
            return;
        }
        const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
        return () => clearInterval(timer);
    }, [timeLeft, matched]);

    const handleCardClick = (index: number) => {
        if (flipped.length === 2 || flipped.includes(index) || matched.includes(index)) return;

        const newFlipped = [...flipped, index];
        setFlipped(newFlipped);

        if (newFlipped.length === 2) {
            const card1 = cards[newFlipped[0]];
            const card2 = cards[newFlipped[1]];

            if (card1.pairId === card2.pairId) {
                const newMatched = [...matched, newFlipped[0], newFlipped[1]];
                setMatched(newMatched);
                setFlipped([]);
                if (newMatched.length === cards.length) {
                    setTimeout(() => onWin(points, difficulty), 500);
                }
            } else {
                setTimeout(() => setFlipped([]), 1000);
            }
        }
    };

    return (
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border space-y-6 animate-in zoom-in-95">
            <div className="flex justify-between items-center border-b pb-4">
                <h3 className="font-black text-xl text-pink-600 flex items-center gap-2"><Copy /> الذاكرة الطبية</h3>
                <div className={`font-black text-xl px-4 py-1 rounded-xl ${timeLeft <= 10 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 text-gray-700'}`}>{timeLeft}ث</div>
            </div>
            <p className="text-center text-sm font-bold text-gray-500">طابق كل اختصار طبي بمعناه الصحيح قبل انتهاء الوقت!</p>
            <div className="grid grid-cols-4 gap-3">
                {cards.map((card, idx) => {
                    const isFlipped = flipped.includes(idx) || matched.includes(idx);
                    return (
                        <button 
                            key={idx} 
                            onClick={() => handleCardClick(idx)}
                            className={`aspect-square rounded-2xl font-black text-xs md:text-sm transition-all duration-300 transform ${isFlipped ? 'bg-pink-100 text-pink-700 border-2 border-pink-300 scale-100' : 'bg-gray-100 text-transparent hover:bg-gray-200 scale-95 hover:scale-100'}`}
                        >
                            {isFlipped ? card.text : '?'}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
