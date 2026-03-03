import React, { useState, useEffect } from 'react';
import { Gamepad2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
    onStart: () => Promise<void>;
    onComplete: (points: number, isWin: boolean) => void;
}

const ICONS = ['🚑', '💊', '💉', '🔬', '🩺', '🦷'];

export default function MemoryMatchGame({ onStart, onComplete }: Props) {
    const [cards, setCards] = useState<{ id: number; icon: string; isFlipped: boolean; isMatched: boolean }[]>([]);
    const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
    const [matches, setMatches] = useState(0);
    const [timeLeft, setTimeLeft] = useState(45);
    const [isActive, setIsActive] = useState(false);
    const [starting, setStarting] = useState(false);

    const startGame = async () => {
        setStarting(true);
        try { await onStart(); } catch { setStarting(false); return; }
        const shuffled = [...ICONS, ...ICONS]
            .sort(() => 0.5 - Math.random())
            .map((icon, idx) => ({ id: idx, icon, isFlipped: false, isMatched: false }));
        setCards(shuffled);
        setMatches(0);
        setFlippedIndices([]);
        setTimeLeft(45);
        setIsActive(true);
        setStarting(false);
    };

    useEffect(() => {
        let timer: ReturnType<typeof setInterval>;
        if (isActive && timeLeft > 0) timer = setInterval(() => setTimeLeft(p => p - 1), 1000);
        else if (isActive && timeLeft === 0) {
            setIsActive(false);
            toast.error('انتهى الوقت! 💔');
            setTimeout(() => onComplete(0, false), 1500);
        }
        return () => clearInterval(timer);
    }, [isActive, timeLeft, onComplete]);

    const handleCardClick = (index: number) => {
        if (!isActive || cards[index].isFlipped || cards[index].isMatched || flippedIndices.length === 2) return;
        const newCards = [...cards];
        newCards[index].isFlipped = true;
        setCards(newCards);
        const newFlipped = [...flippedIndices, index];
        setFlippedIndices(newFlipped);
        if (newFlipped.length === 2) {
            const [first, second] = newFlipped;
            if (newCards[first].icon === newCards[second].icon) {
                setTimeout(() => {
                    const matchedCards = [...newCards];
                    matchedCards[first].isMatched = true;
                    matchedCards[second].isMatched = true;
                    setCards(matchedCards);
                    setFlippedIndices([]);
                    setMatches(prev => {
                        const nm = prev + 1;
                        if (nm === ICONS.length) {
                            setIsActive(false);
                            toast.success('🎉 مبروك! أنهيت اللعبة!');
                            setTimeout(() => onComplete(20, true), 1000);
                        }
                        return nm;
                    });
                }, 500);
            } else {
                setTimeout(() => {
                    const resetCards = [...newCards];
                    resetCards[first].isFlipped = false;
                    resetCards[second].isFlipped = false;
                    setCards(resetCards);
                    setFlippedIndices([]);
                }, 1000);
            }
        }
    };

    if (!isActive) {
        return (
            <div className="text-center py-12">
                <div className="w-24 h-24 bg-gradient-to-br from-orange-500 to-amber-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
                    <Gamepad2 className="w-14 h-14 text-white animate-bounce"/>
                </div>
                <h3 className="text-3xl font-black text-gray-800 mb-3">تطابق الذاكرة 🧠</h3>
                <p className="text-base font-bold text-gray-600 mb-8 max-w-lg mx-auto">لديك 45 ثانية لتطابق جميع الأيقونات الطبية معاً. ركز جيداً!</p>
                <button
                    onClick={startGame}
                    disabled={starting}
                    className="bg-gradient-to-r from-orange-500 to-amber-600 text-white px-10 py-4 rounded-2xl font-black shadow-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 text-lg"
                >
                    {starting ? '⏳ جاري البدء...' : '🎮 ابدأ اللعب'}
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto py-6 text-center animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-8 px-4">
                <div className={`px-6 py-3 rounded-2xl font-black text-xl shadow-lg transition-all ${timeLeft > 15 ? 'bg-orange-500 text-white' : 'bg-red-500 text-white animate-pulse'}`}>
                    ⏰ {timeLeft} ث
                </div>
                <div className="bg-gradient-to-r from-violet-500 to-purple-600 text-white px-6 py-3 rounded-2xl font-black shadow-lg">
                    ✅ {matches} / {ICONS.length}
                </div>
            </div>
            <div className="grid grid-cols-4 gap-3 md:gap-4 p-4 bg-gradient-to-br from-orange-50 to-amber-50 rounded-3xl border-2 border-orange-200 shadow-xl" dir="ltr">
                {cards.map((card, idx) => (
                    <div
                        key={card.id}
                        onClick={() => handleCardClick(idx)}
                        className={`aspect-square rounded-2xl cursor-pointer transition-all duration-500 transform flex items-center justify-center text-4xl md:text-5xl shadow-lg hover:shadow-2xl ${card.isFlipped || card.isMatched ? 'bg-white border-2 border-orange-300' : 'bg-gradient-to-br from-gray-700 to-gray-900 hover:from-gray-600 hover:to-gray-800 border-b-4 border-gray-950'} ${card.isMatched ? 'opacity-50 scale-95' : 'hover:scale-105'}`}
                    >
                        {(card.isFlipped || card.isMatched)
                            ? card.icon
                            : <span className="text-white/30 text-2xl font-black">?</span>
                        }
                    </div>
                ))}
            </div>
        </div>
    );
}
