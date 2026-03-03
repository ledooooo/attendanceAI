import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
    onStart: () => Promise<void>;
    onComplete: (points: number, isWin: boolean) => void;
}

export default function SafeCrackerGame({ onStart, onComplete }: Props) {
    const [secretCode, setSecretCode] = useState('');
    const [guesses, setGuesses] = useState<{ guess: string; feedback: string[] }[]>([]);
    const [currentGuess, setCurrentGuess] = useState('');
    const [isActive, setIsActive] = useState(false);
    const [starting, setStarting] = useState(false);
    const MAX_GUESSES = 5;

    const startGame = async () => {
        setStarting(true);
        try { await onStart(); } catch { setStarting(false); return; }
        let code = '';
        while (code.length < 3) {
            const r = Math.floor(Math.random() * 9) + 1;
            if (!code.includes(r.toString())) code += r;
        }
        setSecretCode(code);
        setGuesses([]);
        setCurrentGuess('');
        setIsActive(true);
        setStarting(false);
    };

    const submitGuess = () => {
        if (currentGuess.length !== 3) { toast.error('يجب إدخال 3 أرقام فقط!', { icon: '⚠️' }); return; }
        const feedback: string[] = [];
        for (let i = 0; i < 3; i++) {
            if (currentGuess[i] === secretCode[i]) feedback.push('green');
            else if (secretCode.includes(currentGuess[i])) feedback.push('yellow');
            else feedback.push('red');
        }
        const newGuesses = [...guesses, { guess: currentGuess, feedback }];
        setGuesses(newGuesses);
        setCurrentGuess('');
        if (currentGuess === secretCode) {
            setTimeout(() => { toast.success('🎉 أحسنت! فتحت الخزنة!', { duration: 3000 }); onComplete(20, true); }, 800);
        } else if (newGuesses.length >= MAX_GUESSES) {
            toast.error(`💔 الكود الصحيح كان: ${secretCode}`, { duration: 3000 });
            setTimeout(() => onComplete(0, false), 2000);
        }
    };

    if (!isActive) {
        return (
            <div className="text-center py-12">
                <div className="w-24 h-24 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl animate-pulse">
                    <Lock className="w-14 h-14 text-white"/>
                </div>
                <h3 className="text-3xl font-black text-gray-800 mb-3">الخزنة السرية! 🔐</h3>
                <p className="text-base font-bold text-gray-600 mb-8 max-w-lg mx-auto">
                    خمن الرقم السري (3 أرقام مختلفة من 1-9) في 5 محاولات فقط بناءً على تلميحات الألوان.
                </p>
                <div className="flex justify-center gap-6 mb-8">
                    {[
                        ['bg-emerald-500', 'رقم صحيح\nمكان صحيح'],
                        ['bg-amber-500',   'رقم صحيح\nمكان خطأ'],
                        ['bg-red-500',     'رقم غير\nموجود']
                    ].map(([color, label], i) => (
                        <div key={i} className="text-center">
                            <div className={`w-12 h-12 ${color} rounded-xl mb-2 shadow-md`}></div>
                            <p className="text-xs font-bold text-gray-600 whitespace-pre-line">{label}</p>
                        </div>
                    ))}
                </div>
                <button
                    onClick={startGame}
                    disabled={starting}
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-10 py-4 rounded-2xl font-black shadow-2xl hover:scale-105 transition-all disabled:opacity-50 text-lg"
                >
                    {starting ? '⏳ جاري البدء...' : '🔓 ابدأ المحاولة'}
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-xl mx-auto py-8 animate-in slide-in-from-bottom-4 text-center">
            <div className="flex items-center justify-center gap-3 mb-8">
                <Lock className="w-10 h-10 text-emerald-600"/>
                <h3 className="text-2xl font-black text-gray-800">اكسر الخزنة!</h3>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-4 rounded-3xl mb-8 border-2 border-emerald-200">
                <p className="text-sm font-bold text-gray-700 mb-3">
                    المحاولات المتبقية: <span className="text-2xl text-emerald-600 font-black">{MAX_GUESSES - guesses.length}</span>
                </p>
                <div className="flex justify-center gap-4 text-xs font-bold">
                    <div className="flex items-center gap-1"><div className="w-4 h-4 bg-emerald-500 rounded"></div> صح</div>
                    <div className="flex items-center gap-1"><div className="w-4 h-4 bg-amber-500 rounded"></div> مكان خطأ</div>
                    <div className="flex items-center gap-1"><div className="w-4 h-4 bg-red-500 rounded"></div> غير موجود</div>
                </div>
            </div>
            <div className="space-y-4 mb-10">
                {guesses.map((g, i) => (
                    <div key={i} className="flex justify-center gap-3 animate-in slide-in-from-right" dir="ltr">
                        {g.guess.split('').map((num, idx) => (
                            <div
                                key={idx}
                                className={`w-16 h-16 flex items-center justify-center text-2xl font-black text-white rounded-2xl shadow-xl transform transition-all hover:scale-110 ${g.feedback[idx] === 'green' ? 'bg-gradient-to-br from-emerald-400 to-emerald-600' : g.feedback[idx] === 'yellow' ? 'bg-gradient-to-br from-amber-400 to-amber-600' : 'bg-gradient-to-br from-red-400 to-red-600'}`}
                            >
                                {num}
                            </div>
                        ))}
                    </div>
                ))}
                {[...Array(MAX_GUESSES - guesses.length)].map((_, i) => (
                    <div key={i} className="flex justify-center gap-3 opacity-20" dir="ltr">
                        {[1, 2, 3].map(n => <div key={n} className="w-16 h-16 bg-gray-300 rounded-2xl"></div>)}
                    </div>
                ))}
            </div>
            {guesses.length < MAX_GUESSES && (
                <div className="flex gap-3 justify-center items-stretch" dir="ltr">
                    <input
                        type="number"
                        maxLength={3}
                        value={currentGuess}
                        onChange={e => setCurrentGuess(e.target.value.slice(0, 3))}
                        onKeyDown={e => e.key === 'Enter' && submitGuess()}
                        className="w-48 text-center text-3xl font-black p-4 bg-gray-50 border-4 border-emerald-300 focus:border-emerald-500 outline-none rounded-2xl shadow-lg"
                        placeholder="***"
                        autoFocus
                    />
                    <button
                        onClick={submitGuess}
                        className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-8 rounded-2xl font-black hover:scale-105 active:scale-95 shadow-xl transition-all text-lg"
                    >
                        جرب ✨
                    </button>
                </div>
            )}
        </div>
    );
}
