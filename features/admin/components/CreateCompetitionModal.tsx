import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../../supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { X, Loader2, Users, Trash2, Search, BookOpen, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

// نوع السؤال في الفورم
type QuestionForm = {
    text: string;
    a: string;
    b: string;
    c: string;
    d: string; // أضفنا الخيار الرابع لدعم البنك
    correct: string;
};

export default function CreateCompetitionModal({ onClose }: { onClose: () => void }) {
    // --- States ---
    const [team1, setTeam1] = useState<string[]>([]);
    const [team2, setTeam2] = useState<string[]>([]);
    const [points, setPoints] = useState(50);
    const [loading, setLoading] = useState(false);
    const [selectedEmp, setSelectedEmp] = useState('');
    
    // 6 أسئلة (3 لكل فريق)
    const [questions, setQuestions] = useState<QuestionForm[]>(
        Array(6).fill({ text: '', a: '', b: '', c: '', d: '', correct: 'a' })
    );

    // Bank Modal State
    const [showBank, setShowBank] = useState(false);
    const [targetQIndex, setTargetQIndex] = useState<number | null>(null);
    const [bankPage, setBankPage] = useState(0);
    const [bankSpecialty, setBankSpecialty] = useState('الكل');

    // --- Queries ---
    
    // 1. الموظفين
    const { data: employees = [] } = useQuery({
        queryKey: ['active_employees'],
        queryFn: async () => {
            const { data } = await supabase.from('employees').select('id, name').eq('status', 'نشط');
            return data || [];
        }
    });

    // 2. تخصصات البنك (للفلترة)
    const { data: specialties = [] } = useQuery({
        queryKey: ['bank_specialties'],
        queryFn: async () => {
            const { data } = await supabase.from('quiz_questions').select('specialty');
            const unique = Array.from(new Set(data?.map((i: any) => i.specialty).filter(Boolean)));
            return ['الكل', ...unique];
        },
        staleTime: 1000 * 60 * 5
    });

    // 3. أسئلة البنك (مع Pagination والفلترة)
    const { data: bankQuestionsData, isLoading: loadingBank } = useQuery({
        queryKey: ['bank_questions', bankPage, bankSpecialty],
        queryFn: async () => {
            let query = supabase
                .from('quiz_questions')
                .select('*', { count: 'exact' });
            
            if (bankSpecialty !== 'الكل') {
                query = query.eq('specialty', bankSpecialty);
            }

            const { data, count, error } = await query
                .range(bankPage * 5, (bankPage * 5) + 4) // 5 أسئلة في الصفحة
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            return { data, count };
        },
        enabled: showBank // لا يجلب إلا لما نفتح النافذة
    });

    // --- Functions ---

    const addToTeam = (teamNum: 1 | 2) => {
        if (!selectedEmp) return;
        if (team1.includes(selectedEmp) || team2.includes(selectedEmp)) return toast.error('الموظف مضاف بالفعل!');
        if (teamNum === 1) setTeam1([...team1, selectedEmp]);
        else setTeam2([...team2, selectedEmp]);
        setSelectedEmp('');
    };

    const updateQuestion = (index: number, field: keyof QuestionForm, value: string) => {
        const newQs = [...questions];
        newQs[index] = { ...newQs[index], [field]: value };
        setQuestions(newQs);
    };

    // اختيار سؤال من البنك
    const selectFromBank = (bankQ: any) => {
        if (targetQIndex === null) return;

        let options: string[] = [];
        try {
            options = typeof bankQ.options === 'string' ? JSON.parse(bankQ.options) : bankQ.options;
        } catch (e) {
            options = [];
        }

        // تحديد الحرف الصحيح بناءً على نص الإجابة
        const correctIndex = options.findIndex((o: string) => o === bankQ.correct_answer);
        const correctChar = ['a', 'b', 'c', 'd'][correctIndex] || 'a';

        const newQ: QuestionForm = {
            text: bankQ.question_text,
            a: options[0] || '',
            b: options[1] || '',
            c: options[2] || '',
            d: options[3] || '',
            correct: correctChar
        };

        const newQs = [...questions];
        newQs[targetQIndex] = newQ;
        setQuestions(newQs);
        setShowBank(false);
        toast.success('تم اختيار السؤال');
    };

const handleCreate = async () => {
        if (team1.length === 0 || team2.length === 0) return toast.error('يجب اختيار فرق');
        // التحقق من تعبئة جميع الأسئلة
        if (questions.some(q => !q.text || !q.a || !q.b)) return toast.error('يرجى إكمال جميع الأسئلة (على الأقل نص السؤال وأول خيارين)');

        setLoading(true);
        try {
            // 1. إنشاء المسابقة
            const { data: comp, error } = await supabase.from('competitions').insert({
                team1_ids: team1, team2_ids: team2, current_turn_team: 1, reward_points: points, status: 'active'
            }).select().single();

            if (error) throw error;

            // 2. إدخال الأسئلة
            const dbQuestions = questions.map((q, idx) => ({
                competition_id: comp.id,
                assigned_to_team: idx < 3 ? 1 : 2, // أول 3 للفريق 1، والباقي للفريق 2
                question_text: q.text,
                option_a: q.a, option_b: q.b, option_c: q.c, option_d: q.d,
                correct_option: q.correct,
                order_index: idx + 1
            }));

            await supabase.from('competition_questions').insert(dbQuestions);

            // -------------------------------------------------------
            // 3. ✅ إرسال الإشعارات للمتسابقين (الخطوة الجديدة)
            // -------------------------------------------------------
            const allPlayers = [...team1, ...team2]; // دمج الفريقين
            
            const notificationsPayload = allPlayers.map(playerId => ({
                user_id: playerId, // تأكد أن اسم العمود في جدولك هو user_id
                title: '🔥 تحدي جديد!',
                message: `تم اختيارك للمشاركة في مسابقة جديدة ضد الفريق المنافس. استعد وأثبت وجودك! 🏆`,
                type: 'competition', // نوع الإشعار للتوجيه لاحقاً
                is_read: false
            }));

            if (notificationsPayload.length > 0) {
                await supabase.from('notifications').insert(notificationsPayload);
            }
            // -------------------------------------------------------

            toast.success('تم إطلاق المسابقة وإشعار اللاعبين! 🚀');
            onClose();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            
            {/* --- النافذة الرئيسية --- */}
            <div className="bg-white w-full max-w-4xl rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 max-h-[95vh] overflow-y-auto flex flex-col md:flex-row gap-6">
                
                {/* الجزء الأيمن: الفرق والإعدادات */}
                <div className="w-full md:w-1/3 space-y-4 shrink-0">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-black text-gray-800">إعداد الفرق</h3>
                        <button onClick={onClose} className="md:hidden"><X/></button>
                    </div>

                    <div className="bg-gray-50 p-3 rounded-xl border">
                        <select className="w-full p-2 bg-white rounded-lg border text-sm mb-2" value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)}>
                            <option value="">اختر موظفاً...</option>
                            {employees.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                        <div className="flex gap-2">
                            <button onClick={() => addToTeam(1)} className="flex-1 bg-red-100 text-red-700 py-1.5 rounded-lg text-xs font-bold hover:bg-red-200">فريق 1 🔴</button>
                            <button onClick={() => addToTeam(2)} className="flex-1 bg-blue-100 text-blue-700 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-200">فريق 2 🔵</button>
                        </div>
                    </div>

                    <div className="space-y-2 max-h-40 overflow-y-auto">
                        <div className="border border-red-100 rounded-lg p-2 bg-red-50/50">
                            <p className="text-xs font-bold text-red-600 mb-1">الفريق الأحمر ({team1.length})</p>
                            {team1.map(id => <div key={id} className="text-[10px] flex justify-between">{employees.find((e:any)=>e.id===id)?.name} <X size={10} className="cursor-pointer" onClick={() => setTeam1(team1.filter(x => x !== id))}/></div>)}
                        </div>
                        <div className="border border-blue-100 rounded-lg p-2 bg-blue-50/50">
                            <p className="text-xs font-bold text-blue-600 mb-1">الفريق الأزرق ({team2.length})</p>
                            {team2.map(id => <div key={id} className="text-[10px] flex justify-between">{employees.find((e:any)=>e.id===id)?.name} <X size={10} className="cursor-pointer" onClick={() => setTeam2(team2.filter(x => x !== id))}/></div>)}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-500">النقاط</label>
                        <input type="number" value={points} onChange={e => setPoints(Number(e.target.value))} className="w-full p-2 bg-gray-50 rounded-lg border text-center font-bold"/>
                    </div>

                    <button onClick={handleCreate} disabled={loading} className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-purple-700 disabled:opacity-50">
                        {loading ? <Loader2 className="animate-spin w-5 h-5 mx-auto"/> : 'إطلاق المسابقة 🔥'}
                    </button>
                </div>

                {/* الجزء الأيسر: الأسئلة */}
                <div className="flex-1 border-t md:border-t-0 md:border-r border-gray-100 md:pr-6 pt-4 md:pt-0 overflow-y-auto custom-scrollbar pr-2">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-black text-gray-800">أسئلة التحدي (6)</h3>
                        <button onClick={onClose} className="hidden md:block p-1 bg-gray-100 rounded-full hover:bg-red-100 hover:text-red-500"><X size={18}/></button>
                    </div>

                    <div className="space-y-6">
                        {questions.map((q, idx) => (
                            <div key={idx} className={`p-4 rounded-2xl border ${idx < 3 ? 'bg-red-50/30 border-red-100' : 'bg-blue-50/30 border-blue-100'}`}>
                                <div className="flex justify-between items-center mb-2">
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${idx < 3 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                        سؤال {idx + 1} ({idx < 3 ? 'فريق أحمر' : 'فريق أزرق'})
                                    </span>
                                    <button 
                                        onClick={() => { setTargetQIndex(idx); setShowBank(true); }}
                                        className="text-[10px] flex items-center gap-1 bg-white border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-50 shadow-sm"
                                    >
                                        <BookOpen size={12}/> اختر من البنك
                                    </button>
                                </div>
                                
                                <input 
                                    type="text" placeholder="نص السؤال..." className="w-full p-2 text-sm border rounded-lg mb-2 focus:ring-2 ring-purple-100 outline-none"
                                    value={q.text} onChange={e => updateQuestion(idx, 'text', e.target.value)}
                                />
                                
                                <div className="grid grid-cols-2 gap-2">
                                    {['a', 'b', 'c', 'd'].map((opt) => (
                                        <div key={opt} className="relative">
                                            <input 
                                                type="text" placeholder={`خيار ${opt.toUpperCase()}`} 
                                                className={`w-full p-1.5 text-xs border rounded-lg pl-6 ${q.correct === opt ? 'bg-green-50 border-green-300' : ''}`}
                                                value={(q as any)[opt]} onChange={e => updateQuestion(idx, opt as any, e.target.value)}
                                            />
                                            <input 
                                                type="radio" name={`correct-${idx}`} checked={q.correct === opt} 
                                                onChange={() => updateQuestion(idx, 'correct', opt)}
                                                className="absolute left-2 top-2 cursor-pointer accent-green-600"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* --- نافذة بنك الأسئلة (Modal فوق الـ Modal) --- */}
            {showBank && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
                    <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
                            <h4 className="font-bold flex items-center gap-2"><BookOpen className="text-purple-600"/> بنك الأسئلة</h4>
                            <button onClick={() => setShowBank(false)}><X/></button>
                        </div>
                        
                        <div className="p-3 border-b flex gap-2 overflow-x-auto custom-scrollbar">
                            {specialties.map((spec: any) => (
                                <button 
                                    key={spec} 
                                    onClick={() => { setBankSpecialty(spec); setBankPage(0); }}
                                    className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${bankSpecialty === spec ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                >
                                    {spec}
                                </button>
                            ))}
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
                            {loadingBank ? (
                                <div className="text-center py-10"><Loader2 className="animate-spin mx-auto text-purple-600"/></div>
                            ) : bankQuestionsData?.data?.length === 0 ? (
                                <div className="text-center py-10 text-gray-400">لا توجد أسئلة بهذا التصنيف</div>
                            ) : (
                                bankQuestionsData?.data?.map((bq: any) => (
                                    <div 
                                        key={bq.id} 
                                        onClick={() => selectFromBank(bq)}
                                        className="bg-white p-3 rounded-xl border hover:border-purple-400 cursor-pointer shadow-sm hover:shadow-md transition-all group"
                                    >
                                        <p className="font-bold text-sm text-gray-800 mb-1 group-hover:text-purple-700">{bq.question_text}</p>
                                        <div className="flex gap-2 text-[10px] text-gray-500">
                                            <span className="bg-gray-100 px-2 py-0.5 rounded">{bq.specialty}</span>
                                            <span className="bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded border border-yellow-100">{bq.points} نقطة</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-3 border-t flex justify-between items-center bg-white rounded-b-2xl">
                            <button 
                                disabled={bankPage === 0} onClick={() => setBankPage(p => p - 1)}
                                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30"
                            >
                                <ChevronRight/>
                            </button>
                            <span className="text-xs font-bold text-gray-500">صفحة {bankPage + 1}</span>
                            <button 
                                disabled={!bankQuestionsData?.data || bankQuestionsData.data.length < 5} 
                                onClick={() => setBankPage(p => p + 1)}
                                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30"
                            >
                                <ChevronLeft/>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
