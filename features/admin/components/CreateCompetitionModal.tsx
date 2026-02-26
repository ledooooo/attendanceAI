import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { useQuery, useQueryClient } from '@tanstack/react-query'; // تمت الإضافة
import { X, Loader2, Users, Trash2, BookOpen, ChevronLeft, ChevronRight, Image as ImageIcon, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

type QuestionForm = {
    text: string;
    image_url: string; 
    a: string;
    b: string;
    c: string;
    d: string;
    correct: string;
};

export default function CreateCompetitionModal({ onClose }: { onClose: () => void }) {
    const queryClient = useQueryClient(); // لتحديث الواجهة فوراً
    
    const [team1, setTeam1] = useState<string[]>([]);
    const [team2, setTeam2] = useState<string[]>([]);
    const [points, setPoints] = useState(50);
    const [drawPoints, setDrawPoints] = useState(20); // 🔥 تمت إضافة حالة نقاط التعادل
    const [timeLimit, setTimeLimit] = useState(30);
    const [questionsPerTeam, setQuestionsPerTeam] = useState(3);
    const [loading, setLoading] = useState(false);
    const [selectedEmp, setSelectedEmp] = useState('');
    const [questions, setQuestions] = useState<QuestionForm[]>([]);

    useEffect(() => {
        const totalQuestions = questionsPerTeam * 2;
        setQuestions(prev => {
            if (totalQuestions > prev.length) {
                const newQuestions = Array(totalQuestions - prev.length).fill({ text: '', image_url: '', a: '', b: '', c: '', d: '', correct: 'a' });
                return [...prev, ...newQuestions];
            } else if (totalQuestions < prev.length) {
                return prev.slice(0, totalQuestions);
            }
            return prev;
        });
    }, [questionsPerTeam]);

    const [showBank, setShowBank] = useState(false);
    const [targetQIndex, setTargetQIndex] = useState<number | null>(null);
    const [bankPage, setBankPage] = useState(0);
    const [bankSpecialty, setBankSpecialty] = useState('الكل');

    const { data: employees = [] } = useQuery({
        queryKey: ['active_employees'],
        queryFn: async () => {
            const { data } = await supabase.from('employees').select('id, employee_id, name, specialty').eq('status', 'نشط');
            return data || [];
        }
    });

    const { data: specialties = [] } = useQuery({
        queryKey: ['bank_specialties'],
        queryFn: async () => {
            const { data: q1 } = await supabase.from('quiz_questions').select('specialty');
            const { data: q2 } = await supabase.from('arcade_quiz_questions').select('specialty');
            const allSpecs = [...(q1?.map((i: any) => i.specialty) || []), ...(q2?.map((i: any) => i.specialty) || [])];
            
            const rawSpecs = allSpecs.flat().filter(Boolean);
            const normalized = new Set<string>();
            
            rawSpecs.forEach(s => {
                if (typeof s !== 'string') return;
                const lowerS = s.toLowerCase();
                if (lowerS === 'all' || lowerS === 'الكل') return;
                
                if (s.includes('بشر') || s.includes('طبيب عام')) normalized.add('بشري');
                else if (s.includes('سنان')) normalized.add('أسنان');
                else if (s.includes('تمريض') || s.includes('ممرض')) normalized.add('تمريض');
                else if (s.includes('صيدل')) normalized.add('صيدلة');
                else if (s.includes('معمل') || s.includes('مختبر')) normalized.add('معمل');
                else if (s.includes('جود')) normalized.add('جودة');
                else if (s.includes('عدوى')) normalized.add('مكافحة عدوى');
                else normalized.add(s);
            });
            return ['الكل', ...Array.from(normalized)];
        },
        staleTime: 1000 * 60 * 5
    });

    const getSpecialtyVariations = (spec: string) => {
        if (spec === 'بشري') return ['طبيب بشرى', 'طبيب بشري', 'بشري', 'بشرى', 'طبيب عام'];
        if (spec === 'أسنان') return ['طبيب أسنان', 'طبيب اسنان', 'أسنان', 'اسنان'];
        if (spec === 'تمريض') return ['تمريض', 'ممرض', 'ممرضة'];
        if (spec === 'صيدلة') return ['صيدلة', 'صيدلي', 'صيدلاني'];
        if (spec === 'معمل') return ['معمل', 'فني معمل', 'مختبر'];
        if (spec === 'جودة') return ['جودة', 'الجودة'];
        if (spec === 'مكافحة عدوى') return ['مكافحة عدوى', 'مكافحه عدوى'];
        return [spec];
    };

    const { data: bankQuestionsData, isLoading: loadingBank } = useQuery({
        queryKey: ['bank_questions', bankPage, bankSpecialty],
        queryFn: async () => {
            const variations = getSpecialtyVariations(bankSpecialty);
            const orFilter = variations.map(v => `specialty.ilike.%${v}%`).join(',');

            let query = supabase.from('arcade_quiz_questions').select('*', { count: 'exact' });
            if (bankSpecialty !== 'الكل') query = query.or(orFilter);
            
            const { data, count, error } = await query.range(bankPage * 5, (bankPage * 5) + 4).order('created_at', { ascending: false });
            
            if (error || !data || data.length === 0) {
                let oldQuery = supabase.from('quiz_questions').select('*', { count: 'exact' });
                if (bankSpecialty !== 'الكل') oldQuery = oldQuery.or(orFilter);
                
                const { data: oldData, count: oldCount } = await oldQuery.range(bankPage * 5, (bankPage * 5) + 4).order('created_at', { ascending: false });
                return { data: oldData || [], count: oldCount || 0 };
            }
            return { data, count };
        },
        enabled: showBank
    });

    const addToTeam = (teamNum: 1 | 2) => {
        if (!selectedEmp) return;
        if (team1.includes(selectedEmp) || team2.includes(selectedEmp)) return toast.error('الموظف مضاف بالفعل!');
        if (teamNum === 1) setTeam1([...team1, selectedEmp]);
        else setTeam2([...team2, selectedEmp]);
        setSelectedEmp('');
    };

    const removeFromTeam = (teamNum: 1 | 2, id: string) => {
        if (teamNum === 1) setTeam1(team1.filter(m => m !== id));
        else setTeam2(team2.filter(m => m !== id));
    };

    const updateQuestion = (index: number, field: keyof QuestionForm, value: string) => {
        const newQs = [...questions];
        newQs[index] = { ...newQs[index], [field]: value };
        setQuestions(newQs);
    };

    const selectFromBank = (bankQ: any) => {
        if (targetQIndex === null) return;
        let questionText = bankQ.question || bankQ.question_text || '';
        let options: { a: string, b: string, c: string, d: string, correct: string } = { a: '', b: '', c: '', d: '', correct: 'a' };

        if (bankQ.option_a) {
            options = {
                a: bankQ.option_a, b: bankQ.option_b, c: bankQ.option_c || '', d: bankQ.option_d || '',
                correct: ['a', 'b', 'c', 'd'][bankQ.correct_index] || 'a'
            };
        } 
        else if (bankQ.options) {
            let optsArr: string[] = [];
            try { optsArr = typeof bankQ.options === 'string' ? JSON.parse(bankQ.options) : bankQ.options; } catch (e) { }
            const correctIdx = optsArr.findIndex((o: string) => o.trim() === bankQ.correct_answer?.trim());
            options = {
                a: optsArr[0] || '', b: optsArr[1] || '', c: optsArr[2] || '', d: optsArr[3] || '',
                correct: ['a', 'b', 'c', 'd'][correctIdx !== -1 ? correctIdx : 0]
            };
        }

        const newQs = [...questions];
        newQs[targetQIndex] = { text: questionText, image_url: bankQ.image_url || '', ...options };
        setQuestions(newQs);
        setShowBank(false);
        setTargetQIndex(null);
        toast.success('✅ تم إدراج السؤال بنجاح');
    };

    const handleCreate = async () => {
        if (team1.length === 0 || team2.length === 0) return toast.error('يجب اختيار فرق');
        if (points <= 0) return toast.error('تأكد من قيمة الجائزة');
        if (timeLimit < 10) return toast.error('يجب أن تكون المهلة 10 ثوانٍ على الأقل');
        if (questions.some(q => !q.text || !q.a || !q.b)) return toast.error('يرجى إكمال جميع نصوص وخيارات الأسئلة');

        setLoading(true);
        try {
            const { data: comp, error: compError } = await supabase.from('competitions').insert({
                team1_ids: team1, 
                team2_ids: team2, 
                current_turn_team: 1, 
                reward_points: points, 
                draw_points: drawPoints, // 🔥 تسجيل نقاط التعادل في الداتا بيز
                time_limit_seconds: timeLimit,
                status: 'active',
                team1_score: 0, 
                team2_score: 0
            }).select().single();

            if (compError) throw compError;

            const dbQuestions = questions.map((q, idx) => ({
                competition_id: comp.id,
                assigned_to_team: idx < questionsPerTeam ? 1 : 2,
                question_text: q.text,
                image_url: q.image_url || null, 
                option_a: q.a, option_b: q.b, option_c: q.c, option_d: q.d,
                correct_option: q.correct,
                order_index: idx + 1
            }));

            const { error: qError } = await supabase.from('competition_questions').insert(dbQuestions);
            if (qError) throw qError;

            const allPlayers = [...team1, ...team2];
            const allPlayerEmpIds = allPlayers.map(id => employees.find((e: any) => e.id === id)?.employee_id || id);

            const notificationsPayload = allPlayerEmpIds.map(empId => ({
                user_id: String(empId),
                title: '🔥 تحدي جديد!',
                message: `تم اختيارك للمشاركة في مسابقة جديدة جائزتها ${points} نقطة. استعد وأثبت وجودك! 🏆`,
                type: 'competition',
                is_read: false
            }));

            if (notificationsPayload.length > 0) {
                await supabase.from('notifications').insert(notificationsPayload);
                Promise.all(allPlayerEmpIds.map(empId => 
                    supabase.functions.invoke('send-push-notification', {
                        body: { userId: String(empId), title: '🔥 تحدي جديد!', body: 'لديك مسابقة جديدة', url: '/staff?tab=arcade' }
                    })
                )).catch(() => {});
            }

            toast.success('تم إطلاق المسابقة بنجاح! 🚀');
            
            // 🔥 تحديث الواجهة فوراً
            queryClient.invalidateQueries({ queryKey: ['admin_competitions'] });
            queryClient.invalidateQueries({ queryKey: ['news_feed_mixed'] });
            
            onClose();
        } catch (err: any) {
            toast.error(err.message || 'حدث خطأ');
        } finally {
            setLoading(false);
        }
    };
    
    const getEmpName = (id: string) => employees.find((e: any) => e.id === id)?.name || 'غير معروف';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="bg-white w-full max-w-5xl rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 max-h-[95vh] overflow-y-auto flex flex-col md:flex-row gap-6">
                
                {/* العمود الأيمن */}
                <div className="w-full md:w-1/3 space-y-4 shrink-0">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-black text-gray-800">إعداد الفرق</h3>
                        <button onClick={onClose} className="md:hidden"><X/></button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-2">
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 block">الجائزة (نقاط)</label>
                            <input type="number" min="10" value={points} onChange={e => setPoints(Number(e.target.value))} className="w-full p-2 bg-yellow-50 border border-yellow-200 rounded-lg text-center font-bold text-yellow-800"/>
                        </div>
                        {/* حقل نقاط التعادل الجديد */}
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 block">نقاط التعادل</label>
                            <input type="number" min="0" value={drawPoints} onChange={e => setDrawPoints(Number(e.target.value))} className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-center font-bold text-gray-800"/>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 block">أسئلة لكل فريق</label>
                            <input type="number" min="1" max="10" value={questionsPerTeam} onChange={e => setQuestionsPerTeam(Number(e.target.value))} className="w-full p-2 bg-purple-50 border border-purple-200 rounded-lg text-center font-bold text-purple-800"/>
                        </div>
                        <div className="col-span-2">
                            <label className="text-[10px] font-bold text-gray-500 flex items-center gap-1"><Clock size={12}/> الوقت للسؤال (ثواني)</label>
                            <input type="number" min="10" max="300" value={timeLimit} onChange={e => setTimeLimit(Number(e.target.value))} className="w-full p-2 bg-blue-50 border border-blue-200 rounded-lg text-center font-bold text-blue-800"/>
                        </div>
                    </div>

                    <div className="bg-gray-50 p-3 rounded-xl border">
                        <select className="w-full p-2 bg-white rounded-lg border text-sm mb-2" value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)}>
                            <option value="">اختر موظفاً...</option>
                            {employees.map((e: any) => <option key={e.id} value={e.id}>{e.name} ({e.specialty})</option>)}
                        </select>
                        <div className="flex gap-2">
                            <button onClick={() => addToTeam(1)} className="flex-1 bg-red-100 text-red-700 py-1.5 rounded-lg text-xs font-bold hover:bg-red-200">+ فريق 1</button>
                            <button onClick={() => addToTeam(2)} className="flex-1 bg-blue-100 text-blue-700 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-200">+ فريق 2</button>
                        </div>
                    </div>

                    <div className="space-y-2 max-h-32 overflow-y-auto">
                        <div className="border border-red-100 rounded-lg p-2 bg-red-50/50">
                            <p className="text-xs font-bold text-red-600 mb-1">الفريق الأول ({team1.length})</p>
                            {team1.map(id => (
                                <div key={id} className="text-[10px] flex justify-between items-center">
                                    {getEmpName(id)} <Trash2 size={12} className="cursor-pointer text-red-400" onClick={() => removeFromTeam(1, id)}/>
                                </div>
                            ))}
                        </div>
                        <div className="border border-blue-100 rounded-lg p-2 bg-blue-50/50">
                            <p className="text-xs font-bold text-blue-600 mb-1">الفريق الثاني ({team2.length})</p>
                            {team2.map(id => (
                                <div key={id} className="text-[10px] flex justify-between items-center">
                                    {getEmpName(id)} <Trash2 size={12} className="cursor-pointer text-red-400" onClick={() => removeFromTeam(2, id)}/>
                                </div>
                            ))}
                        </div>
                    </div>

                    <button onClick={handleCreate} disabled={loading} className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-purple-700 disabled:opacity-50">
                        {loading ? <Loader2 className="animate-spin w-5 h-5 mx-auto"/> : 'إطلاق المسابقة 🔥'}
                    </button>
                </div>

                {/* العمود الأيسر */}
                <div className="flex-1 border-t md:border-t-0 md:border-r border-gray-100 md:pr-6 pt-4 md:pt-0 overflow-y-auto custom-scrollbar pr-2">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-black text-gray-800">أسئلة التحدي ({questions.length})</h3>
                        <button onClick={onClose} className="hidden md:block p-1 bg-gray-100 rounded-full hover:bg-red-100 hover:text-red-500"><X size={18}/></button>
                    </div>

                    <div className="space-y-6">
                        {questions.map((q, idx) => (
                            <div key={idx} className={`p-4 rounded-2xl border ${idx < questionsPerTeam ? 'bg-red-50/30 border-red-100' : 'bg-blue-50/30 border-blue-100'}`}>
                                <div className="flex justify-between items-center mb-2">
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${idx < questionsPerTeam ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                        سؤال {idx < questionsPerTeam ? idx + 1 : idx - questionsPerTeam + 1} ({idx < questionsPerTeam ? 'فريق 1' : 'فريق 2'})
                                    </span>
                                    <button 
                                        onClick={() => { setTargetQIndex(idx); setShowBank(true); }}
                                        className="text-[10px] flex items-center gap-1 bg-white border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-50 shadow-sm transition-colors"
                                    >
                                        <BookOpen size={12}/> اختر من البنك
                                    </button>
                                </div>
                                <textarea 
                                    placeholder="اكتب نص السؤال هنا..." className="w-full p-2 text-sm border rounded-lg mb-2 focus:ring-2 ring-purple-100 outline-none resize-none h-14"
                                    value={q.text} onChange={e => updateQuestion(idx, 'text', e.target.value)}
                                />
                                <div className="grid grid-cols-2 gap-2">
                                    {['a', 'b', 'c', 'd'].map((opt) => (
                                        <div key={opt} className={`relative flex items-center gap-2 p-1.5 rounded-lg border bg-white ${q.correct === opt ? 'border-green-400 ring-1 ring-green-100' : ''}`}>
                                            <input 
                                                type="radio" name={`correct-${idx}`} checked={q.correct === opt} 
                                                onChange={() => updateQuestion(idx, 'correct', opt)}
                                                className="cursor-pointer accent-green-600 w-4 h-4 shrink-0"
                                            />
                                            <input 
                                                type="text" placeholder={`خيار ${opt.toUpperCase()}`} 
                                                className="w-full text-xs outline-none font-bold"
                                                value={(q as any)[opt]} onChange={e => updateQuestion(idx, opt as any, e.target.value)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* نافذة بنك الأسئلة */}
            {showBank && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 animate-in fade-in backdrop-blur-sm">
                    <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
                            <h4 className="font-bold flex items-center gap-2"><BookOpen className="text-purple-600"/> بنك الأسئلة</h4>
                            <button onClick={() => setShowBank(false)} className="p-1 hover:text-red-500 bg-gray-200 rounded-full"><X size={18}/></button>
                        </div>
                        <div className="p-3 border-b flex gap-2 overflow-x-auto custom-scrollbar bg-white">
                            {specialties.map((spec: any) => (
                                <button key={spec} onClick={() => { setBankSpecialty(spec); setBankPage(0); }} className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${bankSpecialty === spec ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{spec}</button>
                            ))}
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
                            {loadingBank ? <div className="text-center py-10"><Loader2 className="animate-spin mx-auto text-purple-600"/></div>
                            : bankQuestionsData?.data?.length === 0 ? <div className="text-center py-10 text-gray-400 font-bold">لا توجد أسئلة</div>
                            : bankQuestionsData?.data?.map((bq: any) => (
                                <div key={bq.id} onClick={() => selectFromBank(bq)} className="bg-white p-4 rounded-xl border hover:border-purple-400 cursor-pointer shadow-sm">
                                    <p className="font-bold text-sm mb-2">{bq.question || bq.question_text}</p>
                                </div>
                            ))}
                        </div>
                        <div className="p-3 border-t flex justify-between items-center bg-white rounded-b-2xl">
                            <button disabled={bankPage === 0} onClick={() => setBankPage(p => p - 1)} className="p-2 border rounded-lg"><ChevronRight size={18}/></button>
                            <span className="text-xs font-bold text-gray-500 bg-gray-50 px-4 py-1 rounded-full">صفحة {bankPage + 1}</span>
                            <button disabled={!bankQuestionsData?.data || bankQuestionsData.data.length < 5} onClick={() => setBankPage(p => p + 1)} className="p-2 border rounded-lg"><ChevronLeft size={18}/></button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
