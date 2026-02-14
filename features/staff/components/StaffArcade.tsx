import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Gamepad2, Lock, Timer, Trophy, Loader2, Dices, HelpCircle, Star } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
    employee: Employee;
}

const COOLDOWN_HOURS = 5;

// كلمات لعبة فك الشفرة
const SCRAMBLE_WORDS = [
    { word: 'باراسيتامول', hint: 'مسكن وخافض للحرارة شهير' },
    { word: 'ميكروسكوب', hint: 'جهاز لتكبير الأشياء الدقيقة' },
    { word: 'أدرينالين', hint: 'هرمون يفرز في حالات الخوف والتوتر' },
    { word: 'أكسجين', hint: 'غاز ضروري للتنفس' },
    { word: 'مضادحيوي', hint: 'دواء لقتل البكتيريا' },
    { word: 'إستقبال', hint: 'أول مكان يدخله المريض' },
];

export default function StaffArcade({ employee }: Props) {
    const queryClient = useQueryClient();
    const [activeGame, setActiveGame] = useState<string | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);

    // 1. جلب آخر محاولة لمعرفة هل هو في فترة الانتظار أم لا
    const { data: lastPlay, isLoading: loadingPlay } = useQuery({
        queryKey: ['last_arcade_play', employee.employee_id],
        queryFn: async () => {
            const { data } = await supabase
                .from('arcade_scores')
                .select('played_at')
                .eq('employee_id', employee.employee_id)
                .order('played_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            return data;
        }
    });

    // 2. جلب لوحة الشرف (Top 10)
    const { data: leaderboard = [] } = useQuery({
        queryKey: ['arcade_leaderboard'],
        queryFn: async () => {
            const { data: scores } = await supabase
                .from('arcade_scores')
                .select('employee_id, points_earned, is_win, employees(name, photo_url)')
                .eq('is_win', true);
            
            if (!scores) return [];

            // تجميع النقاط لكل موظف
            const grouped: Record<string, any> = {};
            scores.forEach(s => {
                if (!grouped[s.employee_id]) {
                    grouped[s.employee_id] = { 
                        id: s.employee_id, 
                        name: s.employees?.name || 'مجهول', 
                        photo: s.employees?.photo_url, 
                        points: 0, 
                        wins: 0 
                    };
                }
                grouped[s.employee_id].points += s.points_earned;
                grouped[s.employee_id].wins += 1;
            });

            return Object.values(grouped).sort((a, b) => b.points - a.points).slice(0, 10);
        }
    });

    // حساب الوقت المتبقي
    const timeRemaining = useMemo(() => {
        if (!lastPlay?.played_at) return null;
        const lastPlayTime = new Date(lastPlay.played_at).getTime();
        const now = new Date().getTime();
        const diffHours = (now - lastPlayTime) / (1000 * 60 * 60);
        
        if (diffHours >= COOLDOWN_HOURS) return null; 
        
        const remainingMs = (COOLDOWN_HOURS * 60 * 60 * 1000) - (now - lastPlayTime);
        const hrs = Math.floor(remainingMs / (1000 * 60 * 60));
        const mins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        return { hrs, mins };
    }, [lastPlay]);

    // ✅ دالة الخصم الفوري: تسجل المحاولة فور ضغط زر ابدأ لتجنب التلاعب
    const consumeAttempt = async (gameName: string) => {
        const { data, error } = await supabase.from('arcade_scores').insert({
            employee_id: employee.employee_id,
            game_name: gameName,
            points_earned: 0,
            is_win: false
        }).select('id').single();

        if (error) throw error;
        setSessionId(data.id);
        // تحديث الكاش لتفعيل القفل المؤقت في الخلفية مباشرة
        queryClient.invalidateQueries({ queryKey: ['last_arcade_play'] });
    };

    // ✅ دالة تحديث النتيجة بعد انتهاء اللعبة
    const finishAttemptMutation = useMutation({
        mutationFn: async ({ points, isWin, gameName }: { points: number, isWin: boolean, gameName: string }) => {
            if (!sessionId) return;

            // تحديث السجل الذي تم إنشاؤه مسبقاً
            await supabase.from('arcade_scores').update({
                points_earned: points,
                is_win: isWin
            }).eq('id', sessionId);

            // إضافة النقاط للرصيد العام إذا فاز
            if (isWin && points > 0) {
                await supabase.rpc('increment_points', { emp_id: employee.employee_id, amount: points });
                await supabase.from('points_ledger').insert({
                    employee_id: employee.employee_id,
                    points: points,
                    reason: `فوز في لعبة: ${gameName} 🎮`
                });
            }
        },
        onSuccess: (_, variables) => {
            if (variables.isWin) {
                toast.success(`بطل! كسبت ${variables.points} نقطة 🎉`);
            } else {
                toast.error('حظ أوفر! تعال جرب تاني بعد 5 ساعات 💔', { duration: 4000 });
            }
            queryClient.invalidateQueries({ queryKey: ['arcade_leaderboard'] });
            queryClient.invalidateQueries({ queryKey: ['admin_employees'] }); 
            setActiveGame(null); 
            setSessionId(null);
        }
    });

    return (
        <div className="space-y-6 animate-in fade-in pb-10">
            {/* Header */}
            <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-[2rem] p-6 text-white shadow-lg">
                <h2 className="text-2xl font-black flex items-center gap-2">
                    <Gamepad2 className="w-8 h-8 text-fuchsia-300"/> صالة الألعاب (Arcade)
                </h2>
                <p className="text-violet-100 text-sm mt-1 font-bold">محاولة واحدة كل 5 ساعات. اختبر مهاراتك واجمع النقاط!</p>
            </div>

            {loadingPlay ? (
                <div className="text-center py-10"><Loader2 className="w-8 h-8 animate-spin mx-auto text-fuchsia-600"/></div>
            ) : activeGame !== null ? (
                /* 🕹️ شاشة اللعب النشطة (يجب أن تكون في الأعلى لكي لا تُخفى عند بدء العداد) */
                <div className="bg-white rounded-[30px] shadow-sm border border-gray-100 p-4 md:p-8">
                    <div className="flex justify-between items-center mb-6 border-b pb-4">
                        <h3 className="font-black text-lg text-violet-700">تحدي قيد التنفيذ 🎯</h3>
                        {/* تم إزالة زر الانسحاب للحفاظ على المحاولة */}
                    </div>
                    
                    {finishAttemptMutation.isPending ? (
                        <div className="text-center py-20"><Loader2 className="w-10 h-10 animate-spin mx-auto text-violet-600 mb-4"/><p className="font-bold text-gray-500">جاري تسجيل نتيجتك...</p></div>
                    ) : (
                        <>
                            {activeGame === 'spin' && <SpinAndAnswerGame employee={employee} onStart={() => consumeAttempt('عجلة الحظ')} onComplete={(pts, win) => finishAttemptMutation.mutate({ points: pts, isWin: win, gameName: 'عجلة الحظ' })} />}
                            {activeGame === 'scramble' && <WordScrambleGame onStart={() => consumeAttempt('فك الشفرة')} onComplete={(pts, win) => finishAttemptMutation.mutate({ points: pts, isWin: win, gameName: 'فك الشفرة' })} />}
                            {activeGame === 'safe' && <SafeCrackerGame onStart={() => consumeAttempt('الخزنة السرية')} onComplete={(pts, win) => finishAttemptMutation.mutate({ points: pts, isWin: win, gameName: 'الخزنة السرية' })} />}
                            {activeGame === 'memory' && <MemoryMatchGame onStart={() => consumeAttempt('تطابق الذاكرة')} onComplete={(pts, win) => finishAttemptMutation.mutate({ points: pts, isWin: win, gameName: 'تطابق الذاكرة' })} />}
                        </>
                    )}
                </div>
            ) : timeRemaining ? (
                /* 🔒 شاشة القفل المؤقت */
                <div className="bg-white p-10 rounded-[30px] text-center border border-gray-100 shadow-sm animate-in zoom-in-95">
                    <Timer className="w-20 h-20 text-gray-300 mx-auto mb-4 animate-pulse"/>
                    <h3 className="text-2xl font-black text-gray-800 mb-2">وقت الراحة!</h3>
                    <p className="text-gray-500 font-bold mb-4">لقد استهلكت محاولتك. تعيش وتلعب مرة تانية بعد:</p>
                    <div className="flex justify-center items-center gap-2 text-3xl font-black text-violet-600 bg-violet-50 py-3 px-6 rounded-2xl w-max mx-auto">
                        <span>{timeRemaining.hrs}</span> <span className="text-sm font-bold text-violet-400">ساعة</span>
                        <span>:</span>
                        <span>{timeRemaining.mins}</span> <span className="text-sm font-bold text-violet-400">دقيقة</span>
                    </div>
                </div>
            ) : (
                /* 🎮 قائمة الألعاب */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Game 1 */}
                    <button onClick={() => setActiveGame('spin')} className="bg-white border-2 border-transparent hover:border-fuchsia-200 p-6 rounded-3xl shadow-sm hover:shadow-md transition-all group text-right flex flex-col relative overflow-hidden">
                        <div className="w-14 h-14 bg-fuchsia-50 text-fuchsia-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-12 transition-transform">
                            <Dices className="w-8 h-8"/>
                        </div>
                        <h3 className="font-black text-gray-800 text-lg mb-1">عجلة الحظ المزدوجة</h3>
                        <p className="text-[10px] text-gray-500 font-bold leading-relaxed mb-4 flex-1">لف العجلة لتحديد الجائزة، ثم أجب على سؤال طبي من تخصصك لتفوز بها!</p>
                        <span className="text-[10px] bg-gray-100 text-gray-600 px-3 py-1 rounded-lg font-black w-max mt-auto">حظ + ذكاء</span>
                    </button>

                    {/* Game 2 */}
                    <button onClick={() => setActiveGame('scramble')} className="bg-white border-2 border-transparent hover:border-blue-200 p-6 rounded-3xl shadow-sm hover:shadow-md transition-all group text-right flex flex-col">
                        <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Timer className="w-8 h-8"/>
                        </div>
                        <h3 className="font-black text-gray-800 text-lg mb-1">فك الشفرة</h3>
                        <p className="text-[10px] text-gray-500 font-bold leading-relaxed mb-4 flex-1">حروف مبعثرة! رتبها بسرعة. النقاط تنقص كل ثانية تتأخر فيها (من 20 لـ 5).</p>
                        <span className="text-[10px] bg-gray-100 text-gray-600 px-3 py-1 rounded-lg font-black w-max mt-auto">سرعة بديهة</span>
                    </button>

                    {/* Game 3 */}
                    <button onClick={() => setActiveGame('safe')} className="bg-white border-2 border-transparent hover:border-emerald-200 p-6 rounded-3xl shadow-sm hover:shadow-md transition-all group text-right flex flex-col">
                        <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Lock className="w-8 h-8"/>
                        </div>
                        <h3 className="font-black text-gray-800 text-lg mb-1">الخزنة السرية</h3>
                        <p className="text-[10px] text-gray-500 font-bold leading-relaxed mb-4 flex-1">خمن الرقم السري (3 أرقام) بناءً على تلميحات الألوان في 5 محاولات فقط.</p>
                        <span className="text-[10px] bg-gray-100 text-gray-600 px-3 py-1 rounded-lg font-black w-max mt-auto">ذكاء ومنطق</span>
                    </button>

                    {/* Game 4 */}
                    <button onClick={() => setActiveGame('memory')} className="bg-white border-2 border-transparent hover:border-orange-200 p-6 rounded-3xl shadow-sm hover:shadow-md transition-all group text-right flex flex-col">
                        <div className="w-14 h-14 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Gamepad2 className="w-8 h-8"/>
                        </div>
                        <h3 className="font-black text-gray-800 text-lg mb-1">تطابق الذاكرة</h3>
                        <p className="text-[10px] text-gray-500 font-bold leading-relaxed mb-4 flex-1">اقلب الكروت وتذكر أماكنها لتطابق الأيقونات الطبية قبل انتهاء الوقت المخصص.</p>
                        <span className="text-[10px] bg-gray-100 text-gray-600 px-3 py-1 rounded-lg font-black w-max mt-auto">قوة ذاكرة</span>
                    </button>
                </div>
            )}

            {/* 🏆 لوحة الشرف */}
            {activeGame === null && (
                <div className="bg-white rounded-[30px] border border-gray-100 shadow-sm p-6 mt-8">
                    <h3 className="font-black text-xl text-gray-800 flex items-center gap-2 mb-6">
                        <Trophy className="w-6 h-6 text-yellow-500"/> أبطال الألعاب (Top 10)
                    </h3>
                    {leaderboard.length === 0 ? (
                        <p className="text-center text-gray-400 py-4 font-bold">لا يوجد فائزين حتى الآن. كن أنت الأول!</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {leaderboard.map((user, idx) => (
                                <div key={user.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-2xl border border-gray-100">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm text-white shadow-sm ${idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-amber-600' : 'bg-violet-400'}`}>
                                            {idx + 1}
                                        </div>
                                        <div className="w-10 h-10 rounded-full bg-white border shadow-sm overflow-hidden">
                                            {user.photo ? <img src={user.photo} className="w-full h-full object-cover"/> : <User className="w-full h-full p-2 text-gray-400"/>}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-sm text-gray-800">{user.name}</h4>
                                            <p className="text-[10px] text-gray-500">{user.wins} انتصارات</p>
                                        </div>
                                    </div>
                                    <div className="bg-white px-3 py-1 rounded-xl shadow-sm border font-black text-violet-600 text-sm">
                                        {user.points} <span className="text-[10px]">نقطة</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ==========================================
// 1️⃣ عجلة الحظ + سؤال (Spin & Answer)
// ==========================================
function SpinAndAnswerGame({ employee, onStart, onComplete }: { employee: Employee, onStart: () => Promise<void>, onComplete: (points: number, isWin: boolean) => void }) {
    const [phase, setPhase] = useState<'spin' | 'question'>('spin');
    const [pointsWon, setPointsWon] = useState(0);
    const [spinning, setSpinning] = useState(false);
    const [question, setQuestion] = useState<any>(null);
    const [timeLeft, setTimeLeft] = useState(15);
    const [starting, setStarting] = useState(false);

    const { data: questions } = useQuery({
        queryKey: ['arcade_question', employee.specialty],
        queryFn: async () => {
            const { data } = await supabase.from('quiz_questions').select('*');
            if (!data) return [];
            return data.filter(q => q.specialty.includes('all') || q.specialty.includes(employee.specialty));
        }
    });

    const startSpin = async () => {
        if (spinning || starting) return;
        setStarting(true);
        try {
            await onStart(); // تسجيل المحاولة الفوري
        } catch (e) {
            setStarting(false);
            return;
        }

        setSpinning(true);
        const options = [10, 20, 30, 40, 50];
        const result = options[Math.floor(Math.random() * options.length)];
        
        setTimeout(() => {
            setPointsWon(result);
            setSpinning(false);
            
            if (questions && questions.length > 0) {
                setQuestion(questions[Math.floor(Math.random() * questions.length)]);
                setPhase('question');
            } else {
                toast.success('ربحت مباشرة لعدم توفر أسئلة!');
                onComplete(result, true);
            }
        }, 3000); 
    };

    useEffect(() => {
        let timer: any;
        if (phase === 'question' && timeLeft > 0) {
            timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
        } else if (phase === 'question' && timeLeft === 0) {
            onComplete(0, false); 
        }
        return () => clearInterval(timer);
    }, [phase, timeLeft, onComplete]);

    const handleAnswer = (opt: string) => {
        if (opt.trim() === question.correct_answer.trim()) {
            onComplete(pointsWon, true);
        } else {
            onComplete(0, false);
        }
    };

    if (phase === 'spin') {
        return (
            <div className="text-center py-10 animate-in zoom-in-95">
                <h3 className="text-2xl font-black text-gray-800 mb-2">لف العجلة!</h3>
                <p className="text-sm font-bold text-gray-500 mb-8">سيتم خصم المحاولة بمجرد بدء اللف</p>
                
                <div className={`w-48 h-48 mx-auto rounded-full border-8 border-violet-200 flex items-center justify-center text-4xl shadow-xl transition-all duration-[3000ms] ${spinning ? 'rotate-[1080deg] blur-[2px]' : ''}`} style={{ background: 'conic-gradient(#fca5a5 0% 25%, #fcd34d 25% 50%, #86efac 50% 75%, #93c5fd 75% 100%)' }}>
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-inner z-10 font-black text-violet-700">
                        {spinning ? '?' : '🎁'}
                    </div>
                </div>
                
                <button onClick={startSpin} disabled={spinning || starting} className="mt-8 bg-violet-600 text-white px-10 py-4 rounded-2xl font-black shadow-lg hover:bg-violet-700 active:scale-95 transition-all disabled:opacity-50">
                    {spinning ? 'جاري اللف...' : starting ? 'جاري البدء...' : 'اضغط للّف (خصم محاولة)'}
                </button>
            </div>
        );
    }

    let parsedOptions: string[] = [];
    if (question && question.options) {
        if (Array.isArray(question.options)) parsedOptions = question.options;
        else if (typeof question.options === 'string') {
            try { parsedOptions = JSON.parse(question.options); } 
            catch (e) { parsedOptions = question.options.split(',').map((s: string) => s.trim()); }
        }
    }

    return (
        <div className="text-center py-8 animate-in slide-in-from-right">
            <div className="flex justify-between items-center mb-6 px-4">
                <span className="bg-red-50 text-red-600 px-4 py-2 rounded-xl font-black">⏳ {timeLeft} ثانية</span>
                <span className="bg-amber-50 text-amber-600 px-4 py-2 rounded-xl font-black flex items-center gap-1"><Star className="w-4 h-4"/> الجائزة: {pointsWon} نقطة</span>
            </div>
            <div className="bg-violet-50 p-6 rounded-3xl mb-6 border border-violet-100">
                <HelpCircle className="w-10 h-10 text-violet-400 mx-auto mb-3"/>
                <h3 className="text-xl font-black text-violet-900 leading-relaxed">{question.question_text}</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {parsedOptions.map((opt: string, i: number) => (
                    <button key={i} onClick={() => handleAnswer(opt)} className="bg-white border-2 border-gray-100 p-4 rounded-2xl font-bold text-gray-700 hover:border-violet-500 hover:bg-violet-50 transition-all active:scale-95">
                        {opt}
                    </button>
                ))}
            </div>
        </div>
    );
}

// ==========================================
// 2️⃣ فك الشفرة (Word Scramble)
// ==========================================
function WordScrambleGame({ onStart, onComplete }: { onStart: () => Promise<void>, onComplete: (points: number, isWin: boolean) => void }) {
    const [wordObj, setWordObj] = useState(SCRAMBLE_WORDS[0]);
    const [scrambledArray, setScrambledArray] = useState<string[]>([]);
    const [input, setInput] = useState('');
    const [timeLeft, setTimeLeft] = useState(20); 
    const [isActive, setIsActive] = useState(false);
    const [starting, setStarting] = useState(false);

    const startGame = async () => {
        setStarting(true);
        try {
            await onStart(); // تسجيل المحاولة الفوري
        } catch(e) {
            setStarting(false);
            return;
        }

        const randomWord = SCRAMBLE_WORDS[Math.floor(Math.random() * SCRAMBLE_WORDS.length)];
        setWordObj(randomWord);
        setScrambledArray(randomWord.word.split('').sort(() => 0.5 - Math.random()));
        setTimeLeft(20);
        setInput('');
        setIsActive(true);
        setStarting(false);
    };

    useEffect(() => {
        let timer: any;
        if (isActive && timeLeft > 0) {
            timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
        } else if (isActive && timeLeft === 0) {
            setIsActive(false);
            onComplete(0, false); 
        }
        return () => clearInterval(timer);
    }, [isActive, timeLeft, onComplete]);

    const checkAnswer = () => {
        if (input.trim() === wordObj.word) {
            setIsActive(false);
            const points = Math.max(5, Math.floor(timeLeft)); 
            onComplete(points, true);
        } else {
            toast.error('كلمة خاطئة!');
            setInput(''); 
        }
    };

    if (!isActive) {
        return (
            <div className="text-center py-10">
                <Timer className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-pulse"/>
                <h3 className="text-2xl font-black text-gray-800 mb-2">فك الشفرة!</h3>
                <p className="text-sm font-bold text-gray-500 mb-6 max-w-sm mx-auto">النقاط تتناقص كل ثانية! رتب الحروف المبعثرة واكتب الكلمة بأسرع ما يمكن.</p>
                <button onClick={startGame} disabled={starting} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black shadow-lg hover:bg-blue-700 hover:scale-105 transition-all disabled:opacity-50">
                    {starting ? 'جاري البدء...' : 'ابدأ التحدي (خصم محاولة)'}
                </button>
            </div>
        );
    }

    return (
        <div className="text-center py-8 max-w-md mx-auto animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-8">
                <span className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl font-black text-lg">⏳ {timeLeft} ث</span>
                <span className="text-xs font-bold text-gray-400 bg-gray-100 px-3 py-1 rounded-full">تلميح: {wordObj.hint}</span>
            </div>
            <div className="flex flex-wrap justify-center gap-2 mb-10" dir="ltr">
                {scrambledArray.map((letter, idx) => (
                    <div key={idx} className="w-12 h-12 bg-white border-2 border-gray-200 rounded-xl flex items-center justify-center text-2xl font-black text-gray-800 shadow-sm">
                        {letter}
                    </div>
                ))}
            </div>
            <input 
                type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && checkAnswer()}
                className="w-full text-center text-xl font-black p-4 bg-gray-100 border-2 border-transparent focus:border-blue-500 outline-none rounded-2xl mb-4 transition-all"
                placeholder="اكتب الكلمة مجمعة هنا..." autoFocus
            />
            <button onClick={checkAnswer} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-md hover:bg-blue-700 active:scale-95">
                تحقق (الجائزة الآن: {Math.max(5, timeLeft)} نقطة)
            </button>
        </div>
    );
}

// ==========================================
// 3️⃣ الخزنة السرية (Crack the Safe)
// ==========================================
function SafeCrackerGame({ onStart, onComplete }: { onStart: () => Promise<void>, onComplete: (points: number, isWin: boolean) => void }) {
    const [secretCode, setSecretCode] = useState('');
    const [guesses, setGuesses] = useState<{ guess: string, feedback: string[] }[]>([]);
    const [currentGuess, setCurrentGuess] = useState('');
    const [isActive, setIsActive] = useState(false);
    const [starting, setStarting] = useState(false);
    const MAX_GUESSES = 5;

    const startGame = async () => {
        setStarting(true);
        try {
            await onStart(); // تسجيل المحاولة الفوري
        } catch(e) {
            setStarting(false);
            return;
        }

        let code = '';
        while(code.length < 3) {
            const r = Math.floor(Math.random() * 9) + 1; 
            if(!code.includes(r.toString())) code += r;
        }
        setSecretCode(code);
        setIsActive(true);
        setStarting(false);
    };

    const submitGuess = () => {
        if (currentGuess.length !== 3) { toast.error('يجب إدخال 3 أرقام'); return; }

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
            setTimeout(() => onComplete(30, true), 1000); 
        } else if (newGuesses.length >= MAX_GUESSES) {
            toast.error(`الكود الصحيح كان: ${secretCode}`);
            setTimeout(() => onComplete(0, false), 2000);
        }
    };

    if (!isActive) {
        return (
            <div className="text-center py-10">
                <Lock className="w-16 h-16 text-emerald-500 mx-auto mb-4 animate-pulse"/>
                <h3 className="text-2xl font-black text-gray-800 mb-2">الخزنة السرية!</h3>
                <p className="text-sm font-bold text-gray-500 mb-6 max-w-sm mx-auto">خمن الرقم السري (3 أرقام مختلفة) في 5 محاولات فقط بناءً على تلميحات الألوان.</p>
                <button onClick={startGame} disabled={starting} className="bg-emerald-600 text-white px-8 py-3 rounded-2xl font-black shadow-lg hover:bg-emerald-700 hover:scale-105 transition-all disabled:opacity-50">
                    {starting ? 'جاري البدء...' : 'ابدأ المحاولة (خصم محاولة)'}
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto py-6 animate-in slide-in-from-bottom-4 text-center">
            <Lock className="w-12 h-12 text-emerald-500 mx-auto mb-2"/>
            <h3 className="text-xl font-black text-gray-800">اكسر الخزنة!</h3>
            <p className="text-xs font-bold text-gray-500 mt-1 mb-4">🟢 صح | 🟡 مكان خطأ | 🔴 غير موجود</p>
            
            <div className="space-y-3 mb-8">
                {guesses.map((g, i) => (
                    <div key={i} className="flex justify-center gap-2" dir="ltr">
                        {g.guess.split('').map((num, idx) => (
                            <div key={idx} className={`w-12 h-12 flex items-center justify-center text-xl font-black text-white rounded-xl shadow-sm ${g.feedback[idx] === 'green' ? 'bg-emerald-500' : g.feedback[idx] === 'yellow' ? 'bg-amber-500' : 'bg-red-500'}`}>
                                {num}
                            </div>
                        ))}
                    </div>
                ))}
                {[...Array(MAX_GUESSES - guesses.length)].map((_, i) => (
                    <div key={i} className="flex justify-center gap-2 opacity-30" dir="ltr">
                        {[1,2,3].map(n => <div key={n} className="w-12 h-12 bg-gray-200 rounded-xl"></div>)}
                    </div>
                ))}
            </div>

            {guesses.length < MAX_GUESSES && (
                <div className="flex gap-2 justify-center" dir="ltr">
                    <input 
                        type="number" maxLength={3} value={currentGuess} onChange={e => setCurrentGuess(e.target.value.slice(0,3))}
                        onKeyDown={e => e.key === 'Enter' && submitGuess()}
                        className="w-32 text-center text-2xl font-black p-3 bg-gray-100 border-2 border-transparent focus:border-emerald-500 outline-none rounded-2xl" placeholder="***" autoFocus
                    />
                    <button onClick={submitGuess} className="bg-emerald-600 text-white px-6 rounded-2xl font-black hover:bg-emerald-700 active:scale-95">جرب</button>
                </div>
            )}
        </div>
    );
}

// ==========================================
// 4️⃣ تطابق الذاكرة (Memory Match)
// ==========================================
const CARDS_DATA = ['🚑', '💊', '💉', '🔬', '🩺', '🦷'];

function MemoryMatchGame({ onStart, onComplete }: { onStart: () => Promise<void>, onComplete: (points: number, isWin: boolean) => void }) {
    const [cards, setCards] = useState<{ id: number, icon: string, isFlipped: boolean, isMatched: boolean }[]>([]);
    const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
    const [matches, setMatches] = useState(0);
    const [timeLeft, setTimeLeft] = useState(45); 
    const [isActive, setIsActive] = useState(false);
    const [starting, setStarting] = useState(false);

    const startGame = async () => {
        setStarting(true);
        try {
            await onStart(); // تسجيل المحاولة الفوري
        } catch(e) {
            setStarting(false);
            return;
        }

        const shuffled = [...CARDS_DATA, ...CARDS_DATA]
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
        let timer: any;
        if (isActive && timeLeft > 0) {
            timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
        } else if (isActive && timeLeft === 0) {
            setIsActive(false);
            onComplete(0, false); 
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
                        const newMatches = prev + 1;
                        if (newMatches === CARDS_DATA.length) {
                            setIsActive(false);
                            setTimeout(() => onComplete(25, true), 500); 
                        }
                        return newMatches;
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
            <div className="text-center py-10">
                <Gamepad2 className="w-16 h-16 text-orange-500 mx-auto mb-4 animate-bounce"/>
                <h3 className="text-2xl font-black text-gray-800 mb-2">تطابق الذاكرة</h3>
                <p className="text-sm font-bold text-gray-500 mb-6 max-w-sm mx-auto">لديك 45 ثانية لتطابق جميع الأيقونات الطبية معاً.</p>
                <button onClick={startGame} disabled={starting} className="bg-orange-500 text-white px-8 py-3 rounded-2xl font-black shadow-lg hover:bg-orange-600 active:scale-95 transition-all disabled:opacity-50">
                    {starting ? 'جاري البدء...' : 'ابدأ اللعب (خصم محاولة)'}
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto py-4 text-center animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
                <span className="bg-orange-50 text-orange-600 px-4 py-2 rounded-xl font-black text-lg">⏳ {timeLeft} ث</span>
                <span className="text-sm font-bold text-gray-500">التطابق: {matches} / 6</span>
            </div>
            <div className="grid grid-cols-4 gap-2 md:gap-3" dir="ltr">
                {cards.map((card, idx) => (
                    <div 
                        key={card.id} 
                        onClick={() => handleCardClick(idx)}
                        className={`aspect-square rounded-2xl cursor-pointer transition-all duration-300 transform preserve-3d flex items-center justify-center text-4xl shadow-sm
                            ${card.isFlipped || card.isMatched ? 'bg-orange-100 rotate-y-180 border border-orange-200' : 'bg-gray-800 hover:bg-gray-700 border-b-4 border-gray-900'}
                            ${card.isMatched ? 'opacity-50 scale-95' : ''}`}
                    >
                        {(card.isFlipped || card.isMatched) ? card.icon : <span className="text-white opacity-20 text-lg font-black">?</span>}
                    </div>
                ))}
            </div>
        </div>
    );
}
