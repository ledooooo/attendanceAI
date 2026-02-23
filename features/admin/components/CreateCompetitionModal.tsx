import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { X, Loader2, Users, Trash2, BookOpen, ChevronLeft, ChevronRight, Image as ImageIcon, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

// نوع السؤال في الفورم (تم إضافة رابط الصورة)
type QuestionForm = {
    text: string;
    image_url: string; // ✅ حقل جديد للصورة
    a: string;
    b: string;
    c: string;
    d: string;
    correct: string;
};

export default function CreateCompetitionModal({ onClose }: { onClose: () => void }) {
    // --- States ---
    const [team1, setTeam1] = useState<string[]>([]);
    const [team2, setTeam2] = useState<string[]>([]);
    const [points, setPoints] = useState(50);
    const [timeLimit, setTimeLimit] = useState(30); // ✅ المدة الزمنية لكل سؤال (بالثواني)
    const [questionsPerTeam, setQuestionsPerTeam] = useState(3); // ✅ عدد الأسئلة المخصصة لكل فريق
    const [loading, setLoading] = useState(false);
    const [selectedEmp, setSelectedEmp] = useState('');
    
    // بناء مصفوفة الأسئلة بناءً على العدد المختار (عدد أسئلة الفريق 1 + عدد أسئلة الفريق 2)
    const [questions, setQuestions] = useState<QuestionForm[]>([]);

    // تحديث مصفوفة الأسئلة عندما يتغير العدد
    useEffect(() => {
        const totalQuestions = questionsPerTeam * 2;
        setQuestions(prev => {
            // إذا كان العدد الجديد أكبر، نضيف أسئلة فارغة
            if (totalQuestions > prev.length) {
                const newQuestions = Array(totalQuestions - prev.length).fill({ text: '', image_url: '', a: '', b: '', c: '', d: '', correct: 'a' });
                return [...prev, ...newQuestions];
            } 
            // إذا كان العدد الجديد أقل، نقص المصفوفة
            else if (totalQuestions < prev.length) {
                return prev.slice(0, totalQuestions);
            }
            return prev;
        });
    }, [questionsPerTeam]);

    // Bank Modal State
    const [showBank, setShowBank] = useState(false);
    const [targetQIndex, setTargetQIndex] = useState<number | null>(null);
    const [bankPage, setBankPage] = useState(0);
    const [bankSpecialty, setBankSpecialty] = useState('الكل');

    // Fetch Employees
    const { data: employees = [], isLoading: empLoading } = useQuery({
        queryKey: ['active_employees_comp'],
        queryFn: async () => {
            const { data } = await supabase.from('employees').select('id, employee_id, name, specialty').eq('status', 'نشط');
            return data || [];
        }
    });

    // Fetch Bank Questions
    const { data: bankQuestionsData, isLoading: bankLoading } = useQuery({
        queryKey: ['bank_questions_comp', bankPage, bankSpecialty],
        queryFn: async () => {
            let q = supabase.from('question_bank').select('*', { count: 'exact' });
            if (bankSpecialty !== 'الكل') q = q.contains('specialty', [bankSpecialty]);
            const { data, count } = await q.range(bankPage * 5, (bankPage + 1) * 5 - 1).order('created_at', { ascending: false });
            return { data: data || [], count: count || 0 };
        },
        enabled: showBank
    });

    // Handlers
    const handleAddUser = (team: 1 | 2) => {
        if (!selectedEmp) return;
        if (team1.includes(selectedEmp) || team2.includes(selectedEmp)) {
            toast.error('الموظف مضاف بالفعل في أحد الفريقين');
            return;
        }
        if (team === 1) setTeam1([...team1, selectedEmp]);
        else setTeam2([...team2, selectedEmp]);
        setSelectedEmp('');
    };

    const handleRemoveUser = (team: 1 | 2, empId: string) => {
        if (team === 1) setTeam1(team1.filter(id => id !== empId));
        else setTeam2(team2.filter(id => id !== empId));
    };

    const updateQuestion = (idx: number, field: keyof QuestionForm, value: string) => {
        const newQ = [...questions];
        newQ[idx] = { ...newQ[idx], [field]: value };
        setQuestions(newQ);
    };

    const useBankQuestion = (bq: any) => {
        if (targetQIndex === null) return;
        updateQuestion(targetQIndex, 'text', bq.question_text);
        updateQuestion(targetQIndex, 'a', bq.option_a);
        updateQuestion(targetQIndex, 'b', bq.option_b);
        updateQuestion(targetQIndex, 'c', bq.option_c);
        updateQuestion(targetQIndex, 'd', bq.option_d);
        updateQuestion(targetQIndex, 'correct', bq.correct_option);
        // تحديث رابط الصورة إذا وجد في بنك الأسئلة (بافتراض إضافة حقل image_url لبنك الأسئلة مستقبلاً)
        if(bq.image_url) updateQuestion(targetQIndex, 'image_url', bq.image_url);
        
        setShowBank(false);
        setTargetQIndex(null);
        toast.success('تم إدراج السؤال بنجاح');
    };

    const handleSubmit = async () => {
        if (team1.length === 0 || team2.length === 0) return toast.error('يجب اختيار موظف واحد على الأقل لكل فريق');
        if (points <= 0) return toast.error('نقاط الجائزة غير صحيحة');
        if (questionsPerTeam < 1) return toast.error('يجب أن يكون هناك سؤال واحد على الأقل لكل فريق');
        if (timeLimit < 10) return toast.error('الحد الأدنى لوقت السؤال هو 10 ثوانٍ');

        // Validation
        const isIncomplete = questions.some(q => !q.text || !q.a || !q.b || !q.c || !q.d);
        if (isIncomplete) return toast.error('يرجى استكمال جميع نصوص وخيارات الأسئلة');

        setLoading(true);
        try {
            // 1. إنشاء المسابقة
            const { data: compData, error: compError } = await supabase.from('competitions').insert({
                team1_ids: team1,
                team2_ids: team2,
                points_reward: points,
                status: 'active',
                time_limit_seconds: timeLimit // ✅ إضافة المهلة الزمنية للمسابقة (يجب إضافتها في جدول competitions)
            }).select('id').single();

            if (compError) throw compError;
            const compId = compData.id;

            // 2. إدخال الأسئلة
            const dbQuestions = questions.map((q, idx) => ({
                competition_id: compId,
                assigned_to_team: idx < questionsPerTeam ? 1 : 2, // النصف الأول للفريق 1، النصف الثاني للفريق 2
                question_text: q.text,
                image_url: q.image_url || null, // ✅ حفظ رابط الصورة
                option_a: q.a, option_b: q.b, option_c: q.c, option_d: q.d,
                correct_option: q.correct
            }));

            // ✅ حفظ الأسئلة في جدول competition_questions (تأكد من وجود حقل image_url في الجدول)
            const { error: qError } = await supabase.from('competition_questions').insert(dbQuestions);
            if (qError) throw qError;

            // 3. إرسال الإشعارات
            const allParticipants = [...team1, ...team2];
            const notifs = allParticipants.map(empId => ({
                user_id: empId,
                title: '⚔️ تحدي جديد ينتظرك!',
                message: `تم اختيارك للمشاركة في مسابقة جديدة جائزتها ${points} نقطة. استعد!`,
                type: 'competition',
                is_read: false
            }));
            await supabase.from('notifications').insert(notifs);

            toast.success('تم إطلاق المسابقة بنجاح! 🚀');
            onClose();
            window.location.reload(); // للتحديث السريع

        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-4xl rounded-[2rem] shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-[2rem] shrink-0">
                    <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
                        <Users className="text-purple-600"/> إنشاء مسابقة جديدة
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X size={20}/></button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-8">
                    
                    {/* إعدادات المسابقة */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-100">
                            <label className="text-xs font-bold text-yellow-800 mb-2 block">جائزة المسابقة (نقاط)</label>
                            <input type="number" min="10" value={points} onChange={e => setPoints(Number(e.target.value))} className="w-full p-2.5 rounded-xl border border-yellow-200 outline-none focus:border-yellow-400 font-black text-center"/>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100">
                            <label className="text-xs font-bold text-purple-800 mb-2 block">عدد الأسئلة لكل فريق</label>
                            <input type="number" min="1" max="10" value={questionsPerTeam} onChange={e => setQuestionsPerTeam(Number(e.target.value))} className="w-full p-2.5 rounded-xl border border-purple-200 outline-none focus:border-purple-400 font-black text-center"/>
                        </div>
                        <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                            <label className="text-xs font-bold text-blue-800 mb-2 flex items-center gap-1"><Clock size={14}/> المهلة لكل سؤال (ثانية)</label>
                            <input type="number" min="10" max="300" value={timeLimit} onChange={e => setTimeLimit(Number(e.target.value))} className="w-full p-2.5 rounded-xl border border-blue-200 outline-none focus:border-blue-400 font-black text-center"/>
                        </div>
                    </div>

                    {/* اختيار الفرق */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* الفريق الأول */}
                        <div className="space-y-3">
                            <h3 className="font-black text-red-600 flex items-center gap-2 pb-2 border-b"><Users size={18}/> الفريق الأول</h3>
                            <div className="flex gap-2">
                                <select value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)} className="flex-1 p-2 rounded-xl border bg-gray-50 text-sm font-bold">
                                    <option value="">اختر موظف...</option>
                                    {employees.map((e: any) => <option key={e.employee_id} value={e.employee_id}>{e.name} ({e.specialty})</option>)}
                                </select>
                                <button onClick={() => handleAddUser(1)} className="bg-red-100 text-red-700 px-4 rounded-xl font-bold hover:bg-red-200">إضافة</button>
                            </div>
                            <div className="flex flex-wrap gap-2 pt-2">
                                {team1.map(id => {
                                    const emp = employees.find((e:any) => e.employee_id === id);
                                    return (
                                        <span key={id} className="bg-red-50 text-red-700 px-3 py-1 rounded-lg text-xs font-bold border border-red-100 flex items-center gap-2">
                                            {emp?.name.split(' ')[0]} <button onClick={() => handleRemoveUser(1, id)} className="hover:text-red-900"><X size={12}/></button>
                                        </span>
                                    );
                                })}
                            </div>
                        </div>

                        {/* الفريق الثاني */}
                        <div className="space-y-3">
                            <h3 className="font-black text-blue-600 flex items-center gap-2 pb-2 border-b"><Users size={18}/> الفريق الثاني</h3>
                            <div className="flex gap-2">
                                <select value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)} className="flex-1 p-2 rounded-xl border bg-gray-50 text-sm font-bold">
                                    <option value="">اختر موظف...</option>
                                    {employees.map((e: any) => <option key={e.employee_id} value={e.employee_id}>{e.name} ({e.specialty})</option>)}
                                </select>
                                <button onClick={() => handleAddUser(2)} className="bg-blue-100 text-blue-700 px-4 rounded-xl font-bold hover:bg-blue-200">إضافة</button>
                            </div>
                            <div className="flex flex-wrap gap-2 pt-2">
                                {team2.map(id => {
                                    const emp = employees.find((e:any) => e.employee_id === id);
                                    return (
                                        <span key={id} className="bg-blue-50 text-blue-700 px-3 py-1 rounded-lg text-xs font-bold border border-blue-100 flex items-center gap-2">
                                            {emp?.name.split(' ')[0]} <button onClick={() => handleRemoveUser(2, id)} className="hover:text-blue-900"><X size={12}/></button>
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* الأسئلة الموحدة */}
                    <div>
                        <h3 className="font-black text-gray-800 flex items-center gap-2 mb-4"><BookOpen className="text-purple-600"/> الأسئلة المخصصة للفريقين</h3>
                        <div className="space-y-6">
                            {questions.map((q, idx) => {
                                const isTeam1 = idx < questionsPerTeam;
                                const teamLabel = isTeam1 ? `سؤال ${idx + 1} (للفريق الأول)` : `سؤال ${idx - questionsPerTeam + 1} (للفريق الثاني)`;
                                const bgColor = isTeam1 ? 'bg-red-50/30 border-red-100' : 'bg-blue-50/30 border-blue-100';
                                const textColor = isTeam1 ? 'text-red-700' : 'text-blue-700';

                                return (
                                    <div key={idx} className={`p-5 rounded-2xl border shadow-sm ${bgColor}`}>
                                        <div className="flex justify-between items-center mb-4">
                                            <h4 className={`font-black text-sm ${textColor}`}>{teamLabel}</h4>
                                            <button 
                                                onClick={() => { setTargetQIndex(idx); setShowBank(true); }}
                                                className="text-xs bg-white border px-3 py-1.5 rounded-lg shadow-sm hover:bg-gray-50 flex items-center gap-1 font-bold"
                                            >
                                                <BookOpen size={14}/> استيراد من بنك الأسئلة
                                            </button>
                                        </div>
                                        
                                        <textarea placeholder="اكتب نص السؤال هنا..." value={q.text} onChange={e => updateQuestion(idx, 'text', e.target.value)} className="w-full p-3 rounded-xl border bg-white outline-none focus:border-purple-400 text-sm font-bold resize-none h-16 mb-3"/>
                                        
                                        {/* ✅ حقل إضافة رابط صورة للسؤال */}
                                        <div className="flex items-center gap-2 mb-4 bg-white p-2 rounded-xl border">
                                            <ImageIcon size={16} className="text-gray-400"/>
                                            <input type="url" placeholder="رابط صورة توضيحية (اختياري)..." value={q.image_url} onChange={e => updateQuestion(idx, 'image_url', e.target.value)} className="w-full text-xs outline-none bg-transparent" dir="ltr" />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {['a', 'b', 'c', 'd'].map(opt => (
                                                <div key={opt} className={`flex items-center gap-2 p-2 rounded-xl border bg-white ${q.correct === opt ? 'border-green-400 ring-1 ring-green-100' : ''}`}>
                                                    <input type="radio" name={`correct_${idx}`} checked={q.correct === opt} onChange={() => updateQuestion(idx, 'correct', opt)} className="w-4 h-4 accent-green-600"/>
                                                    <input type="text" placeholder={`الخيار ${opt.toUpperCase()}`} value={(q as any)[opt]} onChange={e => updateQuestion(idx, opt as any, e.target.value)} className="flex-1 text-sm outline-none font-bold"/>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t bg-gray-50 rounded-b-[2rem] flex justify-end gap-3 shrink-0">
                    <button onClick={onClose} className="px-6 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-200 transition-colors">إلغاء</button>
                    <button onClick={handleSubmit} disabled={loading} className="bg-purple-600 text-white px-8 py-2.5 rounded-xl font-black shadow-lg hover:bg-purple-700 transition-all flex items-center gap-2 disabled:opacity-50">
                        {loading ? <Loader2 size={18} className="animate-spin"/> : 'إطلاق المسابقة 🔥'}
                    </button>
                </div>
            </div>

            {/* --- بنك الأسئلة Modal --- */}
            {showBank && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
                            <h3 className="font-black flex items-center gap-2"><BookOpen className="text-indigo-600"/> بنك الأسئلة</h3>
                            <button onClick={() => setShowBank(false)} className="p-1 hover:bg-gray-200 rounded-lg"><X size={20}/></button>
                        </div>
                        
                        <div className="p-4 border-b">
                            <select value={bankSpecialty} onChange={e => { setBankSpecialty(e.target.value); setBankPage(0); }} className="w-full p-2 border rounded-xl outline-none text-sm font-bold bg-gray-50">
                                <option value="الكل">جميع التخصصات</option>
                                <option value="صيدلة">صيدلة</option>
                                <option value="اسنان">أسنان</option>
                                <option value="معمل">معمل</option>
                                <option value="مكافحة عدوى">مكافحة عدوى</option>
                                <option value="جودة">جودة</option>
                            </select>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                            {bankLoading ? <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600 mt-10"/> : (
                                bankQuestionsData?.data.map((bq: any) => (
                                    <div key={bq.id} className="p-4 border rounded-xl hover:border-indigo-300 transition-colors cursor-pointer group" onClick={() => useBankQuestion(bq)}>
                                        <p className="font-bold text-sm text-gray-800 mb-2">{bq.question_text}</p>
                                        <div className="flex gap-2 text-[10px] font-bold">
                                            <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100">{Array.isArray(bq.specialty) ? bq.specialty[0] : bq.specialty}</span>
                                            <span className="bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded border border-yellow-100">{bq.difficulty || 'medium'}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-3 border-t flex justify-between items-center bg-white rounded-b-2xl">
                            <button disabled={bankPage === 0} onClick={() => setBankPage(p => p - 1)} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30"><ChevronRight/></button>
                            <span className="text-xs font-bold text-gray-500">صفحة {bankPage + 1}</span>
                            <button disabled={!bankQuestionsData?.data || bankQuestionsData.data.length < 5} onClick={() => setBankPage(p => p + 1)} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30"><ChevronLeft/></button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
