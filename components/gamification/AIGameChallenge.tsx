import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { Employee } from '../../types';
import { BrainCircuit, Clock, Zap, Target, Trophy, X, Loader2, Image as ImageIcon, FileText, Gamepad2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
    employee: Employee;
    onClose: () => void;
}

const DIFFICULTY_SETTINGS = {
    'سهل': { points: 15, time: 60, color: 'bg-green-500' },
    'متوسط': { points: 25, time: 45, color: 'bg-yellow-500' },
    'صعب': { points: 30, time: 30, color: 'bg-orange-500' },
    'صعب جداً': { points: 50, time: 20, color: 'bg-red-500' }
};

export default function AIGameChallenge({ employee, onClose }: Props) {
    const [step, setStep] = useState<'config' | 'generating' | 'playing' | 'result'>('config');
    const [difficulty, setDifficulty] = useState('متوسط');
    const [specialty, setSpecialty] = useState('تخصصي');
    const [format, setFormat] = useState('نصي');
    
    const [question, setQuestion] = useState<any>(null);
    const [timeLeft, setTimeLimit] = useState(0);
    const [resultData, setResultData] = useState<{status: string, points: number, timeTaken: number} | null>(null);

    const timerRef = useRef<any>(null);

    // 1. التحقق مما إذا كان الموظف قد بدأ أو لعب اليوم (لمنع الغش)
    useEffect(() => {
        checkExistingAttempt();
    }, []);

    const checkExistingAttempt = async () => {
        const today = new Date().toISOString().split('T')[0];
        const { data } = await supabase
            .from('ai_daily_challenges')
            .select('*')
            .eq('employee_id', employee.employee_id)
            .eq('attempt_date', today)
            .maybeSingle();

        if (data) {
            if (data.status === 'started') {
                // حساب الوقت المتبقي
                const elapsedSeconds = Math.floor((Date.now() - new Date(data.started_at).getTime()) / 1000);
                const assignedTime = DIFFICULTY_SETTINGS[data.difficulty as keyof typeof DIFFICULTY_SETTINGS].time;
                const remaining = assignedTime - elapsedSeconds;

                if (remaining <= 0) {
                    handleTimeUp(data.id);
                } else {
                    setQuestion(data.question_data);
                    setTimeLimit(remaining);
                    setDifficulty(data.difficulty);
                    setStep('playing');
                    startTimer(remaining, data.id);
                }
            } else {
                setResultData({ status: data.status, points: data.points_earned, timeTaken: data.time_taken });
                setStep('result');
            }
        }
    };

    // 2. بدء التحدي (توليد السؤال وحفظه في الداتابيز لحمايته من الـ Refresh)
// 2. بدء التحدي 
    const handleStartChallenge = async () => {
        setStep('generating');
        
        // محاكاة تفكير الذكاء الاصطناعي
        await new Promise(res => setTimeout(res, 2500));

        try {
            // توحيد مسميات التخصص للبحث (خوارزمية المترادفات التي استخدمناها سابقاً)
            const getSpecVariations = (spec: string) => {
                if (spec === 'بشري') return ['طبيب بشرى', 'طبيب بشري', 'بشري', 'بشرى', 'طبيب عام'];
                if (spec === 'أسنان') return ['طبيب أسنان', 'طبيب اسنان', 'أسنان', 'اسنان'];
                if (spec === 'تمريض') return ['تمريض', 'ممرض', 'ممرضة'];
                if (spec === 'صيدلة') return ['صيدلة', 'صيدلي', 'صيدلاني'];
                if (spec === 'معمل') return ['معمل', 'فني معمل', 'مختبر'];
                return [spec];
            };

            let allQuestions: any[] = [];
            const isSpecialized = specialty === 'تخصصي';
            const userSpec = employee.specialty || 'عام';
            const variations = getSpecVariations(userSpec);
            const orFilter = variations.map(v => `specialty.ilike.%${v}%`).join(',');

            // البحث في الجدول الجديد
            let q1 = supabase.from('arcade_quiz_questions').select('*');
            if (isSpecialized) q1 = q1.or(orFilter);
            const { data: data1 } = await q1;
            
            // البحث في الجدول القديم
            let q2 = supabase.from('quiz_questions').select('*');
            if (isSpecialized) q2 = q2.or(orFilter);
            const { data: data2 } = await q2;

            allQuestions = [...(data1 || []), ...(data2 || [])];

            // فلترة الأسئلة التي لعبها الموظف سابقاً (لضمان عدم التكرار)
            const { data: pastAttempts } = await supabase.from('ai_daily_challenges').select('question_data').eq('employee_id', employee.employee_id);
            const playedQuestionTexts = pastAttempts?.map(a => a.question_data?.text) || [];
            
            let availableQuestions = allQuestions.filter(q => {
                const text = q.question_text || q.question;
                return !playedQuestionTexts.includes(text);
            });

            // إذا انتهت الأسئلة المتاحة، نتيح له اللعب من الأسئلة القديمة عشوائياً
            if (availableQuestions.length === 0 && allQuestions.length > 0) {
                availableQuestions = allQuestions;
            }

            let selectedQ = availableQuestions.length > 0 
                ? availableQuestions[Math.floor(Math.random() * availableQuestions.length)] 
                : { // سؤال احتياطي نهائي
                    question_text: "ما هو الإجراء الأولي في حالة توقف القلب؟",
                    options: '["إعطاء صدمة كهربائية", "البدء بالإنعاش القلبي الرئوي (CPR)", "إعطاء أدرينالين", "انتظار الإسعاف"]',
                    correct_answer: "البدء بالإنعاش القلبي الرئوي (CPR)"
                };

            // معالجة خيارات السؤال باختلاف الجداول
            let options = [];
            let correct = '';
            let text = selectedQ.question_text || selectedQ.question;

            if (selectedQ.option_a) {
                options = [selectedQ.option_a, selectedQ.option_b, selectedQ.option_c, selectedQ.option_d].filter(Boolean);
                correct = [selectedQ.option_a, selectedQ.option_b, selectedQ.option_c, selectedQ.option_d][selectedQ.correct_index] || selectedQ.option_a;
            } else if (selectedQ.options) {
                try { options = typeof selectedQ.options === 'string' ? JSON.parse(selectedQ.options) : selectedQ.options; } catch(e){}
                correct = selectedQ.correct_answer;
            }

            // توحيد شكل السؤال النهائي
            const formattedQ = {
                text: text,
                options: options,
                correct: correct,
                image_url: format === 'صورة' ? 'https://via.placeholder.com/400x200?text=Medical+Case+Scan' : null
            };

            const today = new Date().toISOString().split('T')[0];
            
            // حفظ المحاولة
            const { data: attempt, error } = await supabase.from('ai_daily_challenges').insert({
                employee_id: employee.employee_id,
                attempt_date: today,
                difficulty, specialty, format,
                question_data: formattedQ,
                status: 'started'
            }).select().single();

            if (error) throw error;

            setQuestion(formattedQ);
            const assignedTime = DIFFICULTY_SETTINGS[difficulty as keyof typeof DIFFICULTY_SETTINGS].time;
            setTimeLimit(assignedTime);
            setStep('playing');
            startTimer(assignedTime, attempt.id);

        } catch (error: any) {
            toast.error(error.message || 'حدث خطأ أثناء الاتصال بالذكاء الاصطناعي');
            setStep('config');
        }
    };
    // 3. عداد الوقت
    const startTimer = (initialTime: number, attemptId: string) => {
        let current = initialTime;
        timerRef.current = setInterval(() => {
            current -= 1;
            setTimeLimit(current);
            if (current <= 0) {
                clearInterval(timerRef.current);
                handleTimeUp(attemptId);
            }
        }, 1000);
    };

    const handleTimeUp = async (attemptId: string) => {
        clearInterval(timerRef.current);
        await updateResult(attemptId, 'lost', 0, DIFFICULTY_SETTINGS[difficulty as keyof typeof DIFFICULTY_SETTINGS].time);
    };

    // 4. الإجابة على السؤال
    const handleAnswer = async (selectedOption: string) => {
        clearInterval(timerRef.current);
        const today = new Date().toISOString().split('T')[0];
        
        // جلب الـ ID الخاص بالمحاولة
        const { data: attempt } = await supabase.from('ai_daily_challenges').select('id, started_at').eq('employee_id', employee.employee_id).eq('attempt_date', today).single();
        if (!attempt) return;

        const isCorrect = selectedOption === question.correct;
        const timeTaken = Math.floor((Date.now() - new Date(attempt.started_at).getTime()) / 1000);
        const assignedTime = DIFFICULTY_SETTINGS[difficulty as keyof typeof DIFFICULTY_SETTINGS].time;

        let earnedPoints = 0;
        if (isCorrect) {
            earnedPoints = DIFFICULTY_SETTINGS[difficulty as keyof typeof DIFFICULTY_SETTINGS].points;
            // مكافأة سرعة: إذا أجاب في أقل من نصف الوقت يأخذ 10 نقاط إضافية
            if (timeTaken < (assignedTime / 2)) earnedPoints += 10;
        }

        await updateResult(attempt.id, isCorrect ? 'won' : 'lost', earnedPoints, timeTaken);
    };

    // 5. تحديث النتيجة وإضافة النقاط
    const updateResult = async (attemptId: string, status: string, points: number, timeTaken: number) => {
        await supabase.from('ai_daily_challenges').update({ status, points_earned: points, time_taken: timeTaken }).eq('id', attemptId);
        
        if (points > 0) {
            await supabase.rpc('increment_points', { emp_id: employee.employee_id, amount: points });
            await supabase.from('points_ledger').insert({ employee_id: employee.employee_id, points, reason: `فوز في تحدي الذكاء الاصطناعي (${difficulty}) 🤖` });
        }

        setResultData({ status, points, timeTaken });
        setStep('result');
        toast(status === 'won' ? 'عمل رائع! إجابة صحيحة 🎉' : 'للأسف، إجابة خاطئة أو انتهى الوقت 😔', { icon: status === 'won' ? '🏆' : '⏳' });
    };

    // التنظيف عند الإغلاق
    useEffect(() => { return () => clearInterval(timerRef.current); }, []);

    return (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-gradient-to-b from-slate-900 to-slate-800 w-full max-w-lg rounded-[2rem] shadow-2xl border border-slate-700 overflow-hidden relative text-white">
                
                {/* خلفية جمالية */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
                <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500 opacity-10 rounded-full blur-3xl"></div>

                <div className="p-6 border-b border-slate-700 flex justify-between items-center relative z-10">
                    <h2 className="text-xl font-black flex items-center gap-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                        <BrainCircuit className="text-purple-400"/> التحدي الذكي (AI)
                    </h2>
                    <button onClick={onClose} className="p-2 bg-slate-800 hover:bg-red-500/20 hover:text-red-400 rounded-full transition-colors"><X size={18}/></button>
                </div>

                <div className="p-6 relative z-10">
                    {/* المرحلة 1: الإعدادات */}
                    {step === 'config' && (
                        <div className="space-y-6 animate-in fade-in">
                            <div className="text-center mb-6">
                                <p className="text-slate-300 text-sm">تحدي يومي يولد أسئلة طبية مخصصة لك. اختر إعداداتك لتبدأ، تذكر: <strong className="text-red-400">لديك محاولة واحدة فقط يومياً!</strong></p>
                            </div>

                            <div className="space-y-3">
                                <label className="text-xs font-bold text-slate-400">مستوى الصعوبة (يحدد النقاط والوقت):</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {Object.entries(DIFFICULTY_SETTINGS).map(([level, data]) => (
                                        <button key={level} onClick={() => setDifficulty(level)} className={`p-3 rounded-xl border transition-all ${difficulty === level ? `${data.color} border-transparent text-white font-black shadow-lg scale-105` : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}>
                                            {level} <span className="block text-[10px] opacity-80 mt-1">{data.points} نقطة | {data.time} ثانية</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-xs font-bold text-slate-400">مجال التحدي:</label>
                                <div className="flex gap-2">
                                    <button onClick={() => setSpecialty('تخصصي')} className={`flex-1 p-3 rounded-xl border text-sm font-bold transition-all ${specialty === 'تخصصي' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>🎯 من صميم تخصصي</button>
                                    <button onClick={() => setSpecialty('رعاية أساسية')} className={`flex-1 p-3 rounded-xl border text-sm font-bold transition-all ${specialty === 'رعاية أساسية' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>🏥 رعاية طبية عامة</button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-xs font-bold text-slate-400">نوع التحدي:</label>
                                <div className="flex gap-2">
                                    <button onClick={() => setFormat('نصي')} className={`flex-1 py-2 rounded-xl border flex justify-center items-center gap-1 text-xs font-bold transition-all ${format === 'نصي' ? 'bg-purple-600 border-purple-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'}`}><FileText size={14}/> نصي</button>
                                    <button onClick={() => setFormat('صورة')} className={`flex-1 py-2 rounded-xl border flex justify-center items-center gap-1 text-xs font-bold transition-all ${format === 'صورة' ? 'bg-purple-600 border-purple-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'}`}><ImageIcon size={14}/> صورة</button>
                                    <button onClick={() => setFormat('لعبة')} className={`flex-1 py-2 rounded-xl border flex justify-center items-center gap-1 text-xs font-bold transition-all ${format === 'لعبة' ? 'bg-purple-600 border-purple-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'}`}><Gamepad2 size={14}/> حالة تفاعلية</button>
                                </div>
                            </div>

                            <button onClick={handleStartChallenge} className="w-full bg-gradient-to-r from-blue-500 to-purple-600 py-4 rounded-xl font-black text-lg shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:shadow-[0_0_30px_rgba(168,85,247,0.6)] transition-all active:scale-95 flex justify-center items-center gap-2">
                                <Zap size={20} className="fill-current"/> توليد التحدي وبدء اللعب
                            </button>
                        </div>
                    )}

                    {/* المرحلة 2: التحميل (وهمي للذكاء الاصطناعي) */}
                    {step === 'generating' && (
                        <div className="py-20 text-center space-y-6 animate-in zoom-in">
                            <div className="relative w-24 h-24 mx-auto">
                                <div className="absolute inset-0 border-t-4 border-blue-500 rounded-full animate-spin"></div>
                                <div className="absolute inset-2 border-r-4 border-purple-500 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                                <BrainCircuit className="absolute inset-0 m-auto text-purple-400 w-10 h-10 animate-pulse"/>
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white">الذكاء الاصطناعي يعمل...</h3>
                                <p className="text-slate-400 text-sm mt-2 font-mono">Analyzing {specialty} parameters...</p>
                                <p className="text-slate-400 text-sm font-mono">Generating {difficulty} scenario...</p>
                            </div>
                        </div>
                    )}

                    {/* المرحلة 3: اللعب */}
                    {step === 'playing' && question && (
                        <div className="space-y-6 animate-in slide-in-from-right">
                            <div className="flex justify-between items-center bg-slate-800 p-4 rounded-2xl border border-slate-700">
                                <div className="flex items-center gap-2 text-slate-300">
                                    <Target size={18} className="text-blue-400"/>
                                    <span className="font-bold text-sm">مستوى: {difficulty}</span>
                                </div>
                                <div className={`flex items-center gap-2 font-black text-xl px-4 py-1.5 rounded-xl ${timeLeft <= 10 ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-slate-900 text-white'}`}>
                                    <Clock size={20}/> {timeLeft}s
                                </div>
                            </div>

                            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-inner">
                                {question.image_url && (
                                    <img src={question.image_url} alt="Medical Case" className="w-full h-40 object-cover rounded-xl mb-4 border border-slate-700" />
                                )}
                                <h3 className="text-lg font-bold leading-relaxed">{question.text}</h3>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                {question.options.map((opt: string, idx: number) => (
                                    <button 
                                        key={idx} 
                                        onClick={() => handleAnswer(opt)}
                                        className="bg-slate-800 hover:bg-blue-600 border border-slate-700 hover:border-blue-500 text-right p-4 rounded-xl font-bold transition-all text-sm group"
                                    >
                                        <span className="inline-block w-6 h-6 text-center bg-slate-700 group-hover:bg-blue-500 rounded-md ml-3 text-xs leading-6">{String.fromCharCode(65 + idx)}</span>
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* المرحلة 4: النتيجة */}
                    {step === 'result' && resultData && (
                        <div className="py-10 text-center space-y-6 animate-in zoom-in">
                            {resultData.status === 'won' ? (
                                <div className="w-24 h-24 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                                    <Trophy size={40}/>
                                </div>
                            ) : (
                                <div className="w-24 h-24 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-red-500">
                                    <AlertTriangle size={40}/>
                                </div>
                            )}

                            <h2 className="text-2xl font-black">
                                {resultData.status === 'won' ? 'نجاح مبهر! 🌟' : 'حاول مرة أخرى غداً 😔'}
                            </h2>
                            
                            <div className="bg-slate-800 p-6 rounded-2xl inline-block text-right space-y-3 border border-slate-700">
                                <p className="flex justify-between gap-10 text-sm"><span className="text-slate-400">النتيجة:</span> <strong className={resultData.status === 'won' ? 'text-green-400' : 'text-red-400'}>{resultData.status === 'won' ? 'إجابة صحيحة' : 'خسارة'}</strong></p>
                                <p className="flex justify-between gap-10 text-sm"><span className="text-slate-400">الوقت المستغرق:</span> <strong>{resultData.timeTaken} ثانية</strong></p>
                                <p className="flex justify-between gap-10 text-sm"><span className="text-slate-400">النقاط المكتسبة:</span> <strong className="text-yellow-400">+{resultData.points} نقطة</strong></p>
                                {resultData.points > DIFFICULTY_SETTINGS[difficulty as keyof typeof DIFFICULTY_SETTINGS].points && (
                                    <p className="text-[10px] text-blue-400 bg-blue-500/10 p-2 rounded text-center mt-2 flex items-center justify-center gap-1"><Zap size={12}/> متضمنة مكافأة السرعة الخارقة!</p>
                                )}
                            </div>

                            <button onClick={onClose} className="w-full bg-slate-800 hover:bg-slate-700 py-4 rounded-xl font-bold text-white transition-colors border border-slate-600">
                                إغلاق النافذة
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
