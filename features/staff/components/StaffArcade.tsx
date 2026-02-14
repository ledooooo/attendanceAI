import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Gamepad2, Gift, Lock, RefreshCcw, Timer, Trophy, CheckCircle, XCircle, Loader2, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
    employee: Employee;
}

const MAX_DAILY_PLAYS = 3;

// كلمات التحدي الطبي
const MEDICAL_WORDS = [
    { word: 'طوارئ', hint: 'قسم استقبال الحالات العاجلة' },
    { word: 'إسعاف', hint: 'سيارة نقل المرضى' },
    { word: 'صيدلية', hint: 'مكان صرف الأدوية' },
    { word: 'عمليات', hint: 'غرفة الجراحة' },
    { word: 'فيتامين', hint: 'مكمل غذائي ضروري' },
    { word: 'مناعة', hint: 'نظام دفاع الجسم' },
];

export default function StaffArcade({ employee }: Props) {
    const queryClient = useQueryClient();
    const [activeGame, setActiveGame] = useState<string | null>(null);

    // 1. جلب عدد اللعبات اليومية
    const { data: playsToday = 0, isLoading: loadingPlays } = useQuery({
        queryKey: ['arcade_plays_today', employee.employee_id],
        queryFn: async () => {
            const today = new Date().toISOString().split('T')[0];
            const { count } = await supabase
                .from('daily_activities')
                .select('*', { count: 'exact', head: true })
                .eq('employee_id', employee.employee_id)
                .eq('activity_type', 'arcade_play')
                .eq('activity_date', today);
            return count || 0;
        }
    });

    const remainingPlays = MAX_DAILY_PLAYS - playsToday;

    // 2. تسجيل نتيجة اللعبة (فوز أو خسارة)
    const recordGameMutation = useMutation({
        mutationFn: async ({ points, gameName }: { points: number, gameName: string }) => {
            const today = new Date().toISOString().split('T')[0];
            
            // خصم محاولة
            await supabase.from('daily_activities').insert({
                employee_id: employee.employee_id,
                activity_type: 'arcade_play',
                activity_date: today,
                is_completed: true
            });

            // إضافة النقاط إذا فاز
            if (points > 0) {
                await supabase.rpc('increment_points', { emp_id: employee.employee_id, amount: points });
                await supabase.from('points_ledger').insert({
                    employee_id: employee.employee_id,
                    points: points,
                    reason: `فوز في لعبة: ${gameName} 🎮`
                });
            }
        },
        onSuccess: (_, variables) => {
            if (variables.points > 0) {
                toast.success(`مبروك! كسبت ${variables.points} نقطة 🎉`);
            } else {
                toast.error('حظ أوفر المرة القادمة! 💔');
            }
            queryClient.invalidateQueries({ queryKey: ['arcade_plays_today'] });
            queryClient.invalidateQueries({ queryKey: ['admin_employees'] }); // لتحديث الرصيد الكلي
            setActiveGame(null); // العودة للقائمة
        }
    });

    const handleGameComplete = (points: number, gameName: string) => {
        if (remainingPlays <= 0) {
            toast.error('لقد استنفذت محاولاتك اليومية!');
            setActiveGame(null);
            return;
        }
        recordGameMutation.mutate({ points, gameName });
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-[2rem] p-6 text-white shadow-lg relative overflow-hidden">
                <div className="relative z-10 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-black flex items-center gap-2">
                            <Gamepad2 className="w-8 h-8 text-fuchsia-300"/> صالة الألعاب
                        </h2>
                        <p className="text-violet-100 text-sm mt-1">العب، تسلى، واكسب نقاط إضافية!</p>
                    </div>
                    <div className="bg-white/20 backdrop-blur-md px-4 py-3 rounded-2xl text-center border border-white/10 shadow-inner">
                        <span className="block text-[10px] text-fuchsia-100 font-bold mb-1">محاولاتك اليوم</span>
                        <div className="flex gap-1 justify-center">
                            {[1, 2, 3].map(i => (
                                <div key={i} className={`w-3 h-3 rounded-full ${i <= remainingPlays ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]' : 'bg-white/20'}`}></div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {loadingPlays ? (
                <div className="text-center py-10"><Loader2 className="w-8 h-8 animate-spin mx-auto text-fuchsia-600"/></div>
            ) : remainingPlays <= 0 ? (
                <div className="bg-white p-8 rounded-3xl text-center border border-gray-100 shadow-sm">
                    <Trophy className="w-16 h-16 text-gray-300 mx-auto mb-4"/>
                    <h3 className="text-xl font-black text-gray-700">لقد استنفذت محاولاتك!</h3>
                    <p className="text-gray-500 mt-2 font-bold">انتظر للغد لتلعب مرة أخرى وتجمع المزيد من النقاط.</p>
                </div>
            ) : activeGame === null ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Game 1 */}
                    <button onClick={() => setActiveGame('box')} className="bg-white border-2 border-transparent hover:border-fuchsia-200 p-6 rounded-3xl shadow-sm hover:shadow-md transition-all group text-right text-left">
                        <div className="w-14 h-14 bg-fuchsia-100 text-fuchsia-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Gift className="w-8 h-8"/>
                        </div>
                        <h3 className="font-black text-gray-800 text-lg mb-1">صندوق الحظ</h3>
                        <p className="text-xs text-gray-500 font-bold leading-relaxed">اختر صندوقاً لتربح نقاطاً عشوائية. تعتمد على الحظ بالكامل!</p>
                        <span className="inline-block mt-4 text-[10px] bg-gray-100 text-gray-600 px-3 py-1 rounded-full font-black">⭐ الجائزة: حتى 20 نقطة</span>
                    </button>

                    {/* Game 2 */}
                    <button onClick={() => setActiveGame('scramble')} className="bg-white border-2 border-transparent hover:border-blue-200 p-6 rounded-3xl shadow-sm hover:shadow-md transition-all group text-right text-left">
                        <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Timer className="w-8 h-8"/>
                        </div>
                        <h3 className="font-black text-gray-800 text-lg mb-1">فك الشفرة</h3>
                        <p className="text-xs text-gray-500 font-bold leading-relaxed">رتب حروف الكلمة الطبية قبل انتهاء الـ 15 ثانية.</p>
                        <span className="inline-block mt-4 text-[10px] bg-gray-100 text-gray-600 px-3 py-1 rounded-full font-black">⭐ الجائزة: 15 نقطة</span>
                    </button>

                    {/* Game 3 */}
                    <button onClick={() => setActiveGame('safe')} className="bg-white border-2 border-transparent hover:border-emerald-200 p-6 rounded-3xl shadow-sm hover:shadow-md transition-all group text-right text-left">
                        <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Lock className="w-8 h-8"/>
                        </div>
                        <h3 className="font-black text-gray-800 text-lg mb-1">الخزنة السرية</h3>
                        <p className="text-xs text-gray-500 font-bold leading-relaxed">اكتشف الرقم السري المكون من 3 أرقام من خلال التلميحات.</p>
                        <span className="inline-block mt-4 text-[10px] bg-gray-100 text-gray-600 px-3 py-1 rounded-full font-black">⭐ الجائزة: 30 نقطة</span>
                    </button>
                </div>
            ) : (
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
                    <button onClick={() => setActiveGame(null)} className="text-sm font-bold text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-6">
                        <ArrowRight className="w-4 h-4"/> العودة للألعاب
                    </button>
                    
                    {recordGameMutation.isPending ? (
                        <div className="text-center py-20"><Loader2 className="w-10 h-10 animate-spin mx-auto text-violet-600 mb-4"/><p className="font-bold text-gray-500">جاري تسجيل النتيجة...</p></div>
                    ) : (
                        <>
                            {activeGame === 'box' && <MysteryBoxGame onComplete={(pts) => handleGameComplete(pts, 'صندوق الحظ')} />}
                            {activeGame === 'scramble' && <WordScrambleGame onComplete={(pts) => handleGameComplete(pts, 'فك الشفرة')} />}
                            {activeGame === 'safe' && <SafeCrackerGame onComplete={(pts) => handleGameComplete(pts, 'الخزنة السرية')} />}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

// ==========================================
// 🎮 لعبة 1: صندوق الحظ (Mystery Box)
// ==========================================
function MysteryBoxGame({ onComplete }: { onComplete: (points: number) => void }) {
    const [opened, setOpened] = useState(false);
    
    const openBox = () => {
        if(opened) return;
        setOpened(true);
        const prizes = [0, 5, 10, 15, 20];
        // نسبة أن يكون فارغاً 20%، والباقي جوائز
        const randomPrize = prizes[Math.floor(Math.random() * prizes.length)];
        
        setTimeout(() => {
            onComplete(randomPrize);
        }, 1500);
    };

    return (
        <div className="text-center py-10 animate-in zoom-in-95">
            <h3 className="text-2xl font-black text-gray-800 mb-2">اختر صندوقاً!</h3>
            <p className="text-sm font-bold text-gray-500 mb-8">صندوق واحد فقط يحتوي على الجائزة الكبرى</p>
            
            <div className="flex justify-center gap-4">
                {[1, 2, 3].map(i => (
                    <button 
                        key={i} 
                        onClick={openBox}
                        disabled={opened}
                        className={`w-24 h-24 md:w-32 md:h-32 rounded-3xl transition-all transform hover:scale-105 shadow-md flex items-center justify-center text-4xl
                            ${opened ? 'bg-gray-100 scale-95 opacity-50 cursor-not-allowed' : 'bg-gradient-to-br from-amber-200 to-orange-400 hover:shadow-xl hover:shadow-orange-200'}`}
                    >
                        {opened ? '💨' : '🎁'}
                    </button>
                ))}
            </div>
        </div>
    );
}

// ==========================================
// 🎮 لعبة 2: فك الشفرة (Word Scramble)
// ==========================================
function WordScrambleGame({ onComplete }: { onComplete: (points: number) => void }) {
    const [wordObj, setWordObj] = useState(MEDICAL_WORDS[0]);
    const [scrambled, setScrambled] = useState('');
    const [input, setInput] = useState('');
    const [timeLeft, setTimeLeft] = useState(15);
    const [isActive, setIsActive] = useState(false);

    const startGame = () => {
        const randomWord = MEDICAL_WORDS[Math.floor(Math.random() * MEDICAL_WORDS.length)];
        setWordObj(randomWord);
        setScrambled(randomWord.word.split('').sort(() => 0.5 - Math.random()).join(''));
        setTimeLeft(15);
        setInput('');
        setIsActive(true);
    };

    useEffect(() => {
        let timer: any;
        if (isActive && timeLeft > 0) {
            timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
        } else if (isActive && timeLeft === 0) {
            setIsActive(false);
            onComplete(0); // خسر الوقت
        }
        return () => clearInterval(timer);
    }, [isActive, timeLeft, onComplete]);

    const checkAnswer = () => {
        if (input === wordObj.word) {
            setIsActive(false);
            onComplete(15); // كسب النقاط
        } else {
            toast.error('كلمة خاطئة، حاول مجدداً!');
        }
    };

    if (!isActive && timeLeft === 15) {
        return (
            <div className="text-center py-10">
                <Timer className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-pulse"/>
                <h3 className="text-2xl font-black text-gray-800 mb-2">تحدي السرعة!</h3>
                <p className="text-sm font-bold text-gray-500 mb-6 max-w-sm mx-auto">لديك 15 ثانية فقط لترتيب حروف الكلمة المبعثرة وكتابتها بشكل صحيح.</p>
                <button onClick={startGame} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black shadow-lg shadow-blue-200 hover:bg-blue-700 hover:scale-105 transition-all">ابدأ التحدي الآن</button>
            </div>
        );
    }

    return (
        <div className="text-center py-8 max-w-md mx-auto animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-8">
                <span className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl font-black text-lg">⏳ {timeLeft} ثانية</span>
                <span className="text-xs font-bold text-gray-400">تلميح: {wordObj.hint}</span>
            </div>
            
            <div className="text-4xl md:text-5xl font-black text-gray-800 tracking-[0.5em] mb-10 bg-gray-50 py-6 rounded-3xl border border-gray-100">
                {scrambled}
            </div>

            <input 
                type="text" 
                value={input} 
                onChange={e => setInput(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && checkAnswer()}
                className="w-full text-center text-xl font-black p-4 bg-gray-100 border-2 border-transparent focus:border-blue-500 outline-none rounded-2xl mb-4 transition-all"
                placeholder="اكتب الكلمة الصحيحة هنا..."
                autoFocus
            />
            
            <button onClick={checkAnswer} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-md hover:bg-blue-700">تحقق من الإجابة</button>
        </div>
    );
}

// ==========================================
// 🎮 لعبة 3: الخزنة السرية (Crack the Safe)
// ==========================================
function SafeCrackerGame({ onComplete }: { onComplete: (points: number) => void }) {
    const [secretCode, setSecretCode] = useState('');
    const [guesses, setGuesses] = useState<{ guess: string, feedback: string[] }[]>([]);
    const [currentGuess, setCurrentGuess] = useState('');
    const MAX_GUESSES = 5;

    useEffect(() => {
        // إنشاء كود سري من 3 أرقام مختلفة
        let code = '';
        while(code.length < 3) {
            const r = Math.floor(Math.random() * 9) + 1; // 1-9
            if(!code.includes(r.toString())) code += r;
        }
        setSecretCode(code);
    }, []);

    const submitGuess = () => {
        if (currentGuess.length !== 3) {
            toast.error('يجب إدخال 3 أرقام');
            return;
        }

        let feedback = [];
        for (let i = 0; i < 3; i++) {
            if (currentGuess[i] === secretCode[i]) feedback.push('green');
            else if (secretCode.includes(currentGuess[i])) feedback.push('yellow');
            else feedback.push('red');
        }

        const newGuesses = [...guesses, { guess: currentGuess, feedback }];
        setGuesses(newGuesses);
        setCurrentGuess('');

        if (currentGuess === secretCode) {
            setTimeout(() => onComplete(30), 1000); // كسب 30 نقطة
        } else if (newGuesses.length >= MAX_GUESSES) {
            toast.error(`انتهت المحاولات! الكود كان: ${secretCode}`);
            setTimeout(() => onComplete(0), 2000);
        }
    };

    return (
        <div className="max-w-md mx-auto py-6 animate-in slide-in-from-bottom-4">
            <div className="text-center mb-6">
                <Lock className="w-12 h-12 text-emerald-500 mx-auto mb-2"/>
                <h3 className="text-xl font-black text-gray-800">اكسر الخزنة!</h3>
                <p className="text-xs font-bold text-gray-500 mt-1">خمن الـ 3 أرقام. 🟢=صحيح، 🟡=في مكان خطأ، 🔴=غير موجود</p>
                <p className="text-[10px] font-black text-emerald-600 bg-emerald-50 inline-block px-3 py-1 rounded-full mt-2">المحاولات المتبقية: {MAX_GUESSES - guesses.length}</p>
            </div>

            <div className="space-y-3 mb-6">
                {guesses.map((g, i) => (
                    <div key={i} className="flex justify-center gap-2">
                        {g.guess.split('').map((num, idx) => (
                            <div key={idx} className={`w-12 h-12 flex items-center justify-center text-xl font-black text-white rounded-xl shadow-sm
                                ${g.feedback[idx] === 'green' ? 'bg-emerald-500' : g.feedback[idx] === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'}`}>
                                {num}
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            {guesses.length < MAX_GUESSES && (
                <div className="flex gap-2 justify-center">
                    <input 
                        type="number" 
                        maxLength={3}
                        value={currentGuess}
                        onChange={e => setCurrentGuess(e.target.value.slice(0,3))}
                        className="w-32 text-center text-2xl font-black p-3 bg-gray-100 border-2 border-transparent focus:border-emerald-500 outline-none rounded-2xl"
                        placeholder="123"
                    />
                    <button onClick={submitGuess} className="bg-emerald-600 text-white px-6 rounded-2xl font-black hover:bg-emerald-700 shadow-md active:scale-95 transition-all">جرب</button>
                </div>
            )}
        </div>
    );
}
