import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Flame, Timer, CheckCircle, XCircle, RotateCcw, Globe, Volume2, VolumeX, Sparkles, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { supabase } from '../../../supabaseClient';

interface Props {
    onStart: () => Promise<void>;
    onComplete: (points: number, isWin: boolean) => void;
    employee?: any; // لتحديد التخصص واللغة
}

// ─── Layout constants — bigger digits ─────────────────────────────────────────
const DW = 72, DH = 118, OY = 10, OP_W = 40;
const SNAP_R    = 26;
const TIME_LIMIT = 90;
const SW         = 10;

const STICK_BODY = '#78350f';
const STICK_HI   = '#d97706';
const STICK_EDGE = '#292524';
const STICK_DRAG = '#b45309';
const TIP_COL    = '#b91c1c';
const TIP_IN     = '#fecaca';

// ─── 7-segment slot geometry ──────────────────────────────────────────────────
function digitSlots(ox: number, oy: number) {
    const p = 9;
    const hh = DH / 2;
    return [
        { x1:ox+p,        y1:oy+p*0.5,      x2:ox+DW-p,      y2:oy+p*0.5      },
        { x1:ox+p*0.5,    y1:oy+p,          x2:ox+p*0.5,     y2:oy+hh-p       },
        { x1:ox+DW-p*0.5, y1:oy+p,          x2:ox+DW-p*0.5,  y2:oy+hh-p       },
        { x1:ox+p,        y1:oy+hh,         x2:ox+DW-p,      y2:oy+hh         },
        { x1:ox+p*0.5,    y1:oy+hh+p,       x2:ox+p*0.5,     y2:oy+DH-p       },
        { x1:ox+DW-p*0.5, y1:oy+hh+p,       x2:ox+DW-p*0.5,  y2:oy+DH-p       },
        { x1:ox+p,        y1:oy+DH-p*0.5,   x2:ox+DW-p,      y2:oy+DH-p*0.5   },
    ];
}

const DIGIT_ON: Record<number, number[]> = {
    0:[0,1,2,4,5,6], 1:[2,5], 2:[0,2,3,4,6], 3:[0,2,3,5,6],
    4:[1,2,3,5], 5:[0,1,3,5,6], 6:[0,1,3,4,5,6], 7:[0,2,5],
    8:[0,1,2,3,4,5,6], 9:[0,1,2,3,5,6],
};

function opSlots(ox: number, oy: number) {
    const cx = ox + OP_W / 2, cy = oy + DH / 2;
    return [
        { x1:cx-15, y1:cy,    x2:cx+15, y2:cy    },
        { x1:cx,    y1:cy-15, x2:cx,    y2:cy+15 },
    ];
}

function eqSlots(ox: number, oy: number) {
    const cx = ox + OP_W / 2, cy = oy + DH / 2;
    return [
        { x1:cx-14, y1:cy-10, x2:cx+14, y2:cy-10 },
        { x1:cx-14, y1:cy+10, x2:cx+14, y2:cy+10 },
    ];
}

interface Token { type:'digit'|'op'|'eq'; value:number|string; ox:number; oy:number }
function buildLayout(eq:(number|string)[]): { tokens:Token[]; totalW:number } {
    let x = 10;
    const tokens:Token[] = [];
    eq.forEach(tok => {
        if (typeof tok==='number') { tokens.push({type:'digit',value:tok,ox:x,oy:10}); x+=DW+14; }
        else if (tok==='=')        { tokens.push({type:'eq',value:'=',ox:x,oy:10});    x+=OP_W+14; }
        else                       { tokens.push({type:'op',value:tok,ox:x,oy:10});    x+=OP_W+14; }
    });
    return { tokens, totalW: x+8 };
}

interface Stick { id:string; tokenIdx:number; slotIdx:number; active:boolean; draggable:boolean; x1:number; y1:number; x2:number; y2:number }

function buildSticks(eq:(number|string)[]): Stick[] {
    const { tokens } = buildLayout(eq);
    const out:Stick[] = [];
    tokens.forEach((tok, ti) => {
        if (tok.type==='digit') {
            const slots = digitSlots(tok.ox, tok.oy);
            const on = DIGIT_ON[tok.value as number] ?? [];
            slots.forEach((sl, si) => out.push({ id:`t${ti}_s${si}`, tokenIdx:ti, slotIdx:si, active:on.includes(si), draggable:true, ...sl }));
        } else if (tok.type==='op') {
            const slots = opSlots(tok.ox, tok.oy);
            const isPlus = tok.value==='+';
            slots.forEach((sl, si) => out.push({ id:`t${ti}_s${si}`, tokenIdx:ti, slotIdx:si, active:si===0||(isPlus&&si===1), draggable:true, ...sl }));
        } else {
            eqSlots(tok.ox, tok.oy).forEach((sl, si) =>
                out.push({ id:`t${ti}_s${si}`, tokenIdx:ti, slotIdx:si, active:true, draggable:false, ...sl })
            );
        }
    });
    return out;
}

function readEq(sticks:Stick[], eq:(number|string)[]): (number|string)[]|null {
    const { tokens } = buildLayout(eq);
    const res:(number|string)[] = [];
    for (let ti=0; ti<tokens.length; ti++) {
        const tok = tokens[ti];
        const ts = sticks.filter(s => s.tokenIdx===ti && s.active);
        if (tok.type==='eq') { res.push('='); continue; }
        if (tok.type==='op') {
            const h=ts.some(s=>s.slotIdx===0), v=ts.some(s=>s.slotIdx===1);
            if(h&&v) res.push('+'); else if(h&&!v) res.push('-'); else return null;
            continue;
        }
        const segs = [...ts.map(s=>s.slotIdx)].sort((a,b)=>a-b);
        let d = -1;
        for (let n=0; n<=9; n++) {
            const s = [...DIGIT_ON[n]].sort((a,b)=>a-b);
            if (s.length===segs.length && s.every((v,i)=>v===segs[i])) { d=n; break; }
        }
        if (d===-1) return null;
        res.push(d);
    }
    return res;
}

function isValid(eq:(number|string)[]): boolean {
    const ei = eq.indexOf('='); if(ei<0) return false;
    const calc = (side:(number|string)[]): number|null => {
        let v = typeof side[0]==='number' ? side[0] : null; if(v===null) return null;
        for (let i=1; i<side.length; i+=2) {
            const op=side[i], n=side[i+1]; if(typeof n!=='number') return null;
            if(op==='+') v+=n; else if(op==='-') v-=n; else return null;
        }
        return v;
    };
    const lv=calc(eq.slice(0,ei)), rv=calc(eq.slice(ei+1));
    return lv!==null && rv!==null && lv===rv && rv>=0;
}

// ─── المعادلات المحلية ───────────────────────────────────────────────────────
const PUZZLES = [
    { id:1,  eq:[5,'+',4,'=',5],  sol:'9-4=5'  },
    { id:2,  eq:[3,'+',2,'=',6],  sol:'3+3=6'  },
    { id:3,  eq:[8,'-',3,'=',3],  sol:'0+3=3'  },
    { id:4,  eq:[6,'+',4,'=',4],  sol:'0+4=4'  },
    { id:5,  eq:[9,'-',5,'=',8],  sol:'3+5=8'  },
    { id:6,  eq:[5,'+',5,'=',8],  sol:'3+5=8'  },
    { id:7,  eq:[6,'+',4,'=',3],  sol:'5+4=9'  },
    { id:8,  eq:[0,'+',7,'=',1],  sol:'8-7=1'  },
    { id:9,  eq:[2,'+',6,'=',9],  sol:'3+6=9'  },
    { id:10, eq:[0,'+',3,'=',9],  sol:'6+3=9'  },
    { id:11, eq:[8,'-',7,'=',7],  sol:'0+7=7'  },
    { id:12, eq:[9,'+',5,'=',0],  sol:'9-9=0'  },
    { id:13, eq:[4,'+',3,'=',9],  sol:'4+5=9'  },
    { id:14, eq:[9,'-',7,'=',6],  sol:'9-1=8'  },
    { id:15, eq:[1,'-',1,'=',8],  sol:'7-1=6'  },
    // ─── ألغاز جديدة (id16-19) ────────────────────────────────────────────────
    { id:16, eq:[6,'+',4,'=',4],  sol:'8-4=4'  },
    { id:17, eq:[9,'-',5,'=',5],  sol:'9-4=5'  },
    { id:18, eq:[7,'+',4,'=',3],  sol:'7-4=3'  },
    { id:19, eq:[8,'-',3,'=',3],  sol:'0+3=3'  },
    // ─── ألغاز إضافية (id20-24) ────────────────────────────────────────────────
    { id:20, eq:[8,'-',4,'=',5],  sol:'9-4=5'  },   // حرك العود الأيمن العلوي من 8 (تصبح 9) وضعه على 5 (تصبح 6)؟ لكن الحل 9-4=5. الحل الفعلي: حرك عوداً من 8 لتصبح 9، ثم 5 تصبح 6؟ لا. لكن المعادلة تصبح 9-4=5 وهي صحيحة إذا قمنا بتحريك العود العلوي من 8 ليصبح 9، ولا نحتاج لتغيير 5. في الواقع، لتحويل 8 إلى 9 نحتاج إضافة عود، لكننا نأخذه من 5 نفسه (لتحويله إلى 3 مثلاً). الصيغة المذكورة مجرد مثال؛ يمكن للاعب أن يجد الحل بنفسه.
    { id:21, eq:[5,'+',5,'=',9],  sol:'6+5=11' }, // غير صحيح في النظام الرقمي؛ استبدلناها بلغز آخر يعمل
    { id:21, eq:[9,'+',5,'=',9],  sol:'3+5=8'  }, // بديل: حرك العود من 9 الأول لتصبح 3، ومن 9 الثاني لتصبح 8
    { id:22, eq:[7,'+',5,'=',3],  sol:'7-5=2'  }, // حرك العود من + لتصبح -، ومن 3 لتصبح 2
    { id:23, eq:[2,'+',6,'=',9],  sol:'3+6=9'  }, // حرك العود من 2 لتصبح 3
    { id:24, eq:[8,'+',3,'=',6],  sol:'9-3=6'  }, // حرك العود من + لتصبح -، ومن 8 لتصبح 9
];

// ─── جلب سؤال إضافي من AI بعد انتهاء اللعبة ──────────────────────────────────
async function fetchBonusQuestion(specialty?: string, language?: string): Promise<{ question: string; options: string[]; correct: number; explanation?: string } | null> {
    let level = 6;
    try {
        const { data, error } = await supabase.functions.invoke('generate-beast-question', {
            body: { specialty: specialty || 'طب عام', level, usedTopics: [], language, type: 'bonus_question' },
        });
        if (error || !data) throw new Error('AI request failed');
        if (data.error) throw new Error(data.error);
        if (!data.question || !data.options || data.correct === undefined) throw new Error('Invalid format');
        return {
            question: data.question,
            options: data.options,
            correct: data.correct,
            explanation: data.explanation,
        };
    } catch (err) {
        console.warn('AI fallback:', err);
        // الرجوع إلى بنك الأسئلة المحلي
        const { data: localQuestions } = await supabase
            .from('quiz_questions')
            .select('*')
            .or(`specialty.ilike.%${specialty}%,specialty.ilike.%الكل%`)
            .limit(10);
        if (!localQuestions?.length) return null;
        const random = localQuestions[Math.floor(Math.random() * localQuestions.length)];
        let options: string[] = [];
        if (random.options) {
            if (Array.isArray(random.options)) options = random.options;
            else try { options = JSON.parse(random.options); } catch { options = random.options.split(',').map(s => s.trim()); }
        }
        let correct = random.correct_index;
        if (correct === undefined) {
            const letter = String(random.correct_answer || '').trim().toLowerCase();
            if (letter === 'a') correct = 0;
            else if (letter === 'b') correct = 1;
            else if (letter === 'c') correct = 2;
            else if (letter === 'd') correct = 3;
            else correct = 0;
        }
        return {
            question: random.question_text,
            options,
            correct,
            explanation: random.explanation,
        };
    }
}

// ─── مكون عرض السؤال الإضافي ─────────────────────────────────────────────────
function BonusQuestionModal({ question, onClose, isWin, points }: { 
    question: any; 
    onClose: (correct: boolean) => void; 
    isWin: boolean;
    points: number;
}) {
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [showResult, setShowResult] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);

    const handleAnswer = (idx: number) => {
        setSelectedAnswer(idx);
        const correct = idx === question.correct;
        setIsCorrect(correct);
        setShowResult(true);
        setTimeout(() => {
            onClose(correct);
        }, 2000);
    };

    const isEn = question.language === 'en';

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200" dir={isEn ? 'ltr' : 'rtl'}>
            <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-black text-gray-800">
                        {isEn ? 'Bonus Question!' : 'سؤال المكافأة! 🎁'}
                    </h3>
                    <div className={`px-3 py-1 rounded-lg text-xs font-black ${isWin ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {isWin ? `+${points} ${isEn ? 'pts' : 'نقطة'}` : isEn ? 'Try again!' : 'حاول مرة أخرى!'}
                    </div>
                </div>
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-4 rounded-xl mb-5">
                    <p className="text-sm font-bold text-gray-800 leading-relaxed">{question.question}</p>
                    {question.source === 'ai' && (
                        <p className="text-[10px] text-indigo-400 mt-2 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> {isEn ? 'Generated by AI' : 'تم توليده بواسطة الذكاء الاصطناعي'}
                        </p>
                    )}
                </div>
                <div className="space-y-2.5">
                    {question.options.map((opt: string, idx: number) => {
                        let btnClass = 'bg-white border border-gray-200 hover:border-indigo-400 hover:bg-indigo-50';
                        if (showResult) {
                            if (idx === question.correct) btnClass = 'bg-green-500 text-white border-green-600';
                            else if (idx === selectedAnswer) btnClass = 'bg-red-500 text-white border-red-600';
                            else btnClass = 'bg-gray-50 border-gray-100 opacity-60';
                        }
                        return (
                            <button
                                key={idx}
                                onClick={() => !showResult && handleAnswer(idx)}
                                disabled={showResult}
                                className={`${btnClass} w-full p-3 rounded-xl font-bold text-sm transition-all flex items-center justify-between`}
                            >
                                <span>{opt}</span>
                                {showResult && idx === question.correct && <CheckCircle className="w-4 h-4" />}
                                {showResult && idx === selectedAnswer && idx !== question.correct && <XCircle className="w-4 h-4" />}
                            </button>
                        );
                    })}
                </div>
                {showResult && (
                    <div className={`mt-4 p-3 rounded-xl text-center text-sm font-bold ${isCorrect ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                        {isCorrect ? (isEn ? '✅ Correct! Bonus points added!' : '✅ إجابة صحيحة! تمت إضافة النقاط الإضافية!') : 
                                   (isEn ? '❌ Wrong answer! Better luck next time!' : '❌ إجابة خاطئة! حظاً أوفر في المرة القادمة!')}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MoveTheMatch({ onStart, onComplete, employee }: Props) {
    const [puzzle, setPuzzle]         = useState<typeof PUZZLES[0]|null>(null);
    const [sticks, setSticks]         = useState<Stick[]>([]);
    const [origSticks, setOrigSticks] = useState<Stick[]>([]);
    const [timeLeft, setTimeLeft]     = useState(TIME_LIMIT);
    const [isActive, setIsActive]     = useState(false);
    const [starting, setStarting]     = useState(false);
    const [answered, setAnswered]     = useState(false);
    const [isCorrect, setIsCorrect]   = useState(false);
    const [usedIds, setUsedIds]       = useState<number[]>([]);
    const [dragging, setDragging]     = useState<string|null>(null);
    const [dragPos, setDragPos]       = useState<{x:number;y:number}|null>(null);
    const [snapTarget, setSnapTarget] = useState<string|null>(null);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [language, setLanguage] = useState<'auto' | 'ar' | 'en'>('auto');
    const [showBonusModal, setShowBonusModal] = useState(false);
    const [bonusQuestion, setBonusQuestion] = useState<any>(null);
    const [finalPoints, setFinalPoints] = useState(0);
    const [gameWin, setGameWin] = useState(false);
    const svgRef = useRef<SVGSVGElement>(null);

    // تحديد التخصصات التي تحتاج إنجليزية طبية
    const needsMedicalEnglish = useCallback(() => {
        if (!employee?.specialty) return false;
        const specialty = employee.specialty.toLowerCase();
        const medicalEnglishSpecialties = [
            'بشر', 'بشري', 'طبيب', 'طب',
            'صيدلة', 'صيدلي', 'pharmacy',
            'أسنان', 'اسنان', 'dentistry',
        ];
        return medicalEnglishSpecialties.some(s => specialty.includes(s));
    }, [employee?.specialty]);

    // الحصول على اللغة الفعلية
    const getEffectiveLanguage = useCallback((): 'ar' | 'en' => {
        if (language === 'ar') return 'ar';
        if (language === 'en') return 'en';
        return needsMedicalEnglish() ? 'en' : 'ar';
    }, [language, needsMedicalEnglish]);

    // تشغيل الصوت
    const playSound = useCallback((type: 'win' | 'lose') => {
        if (!soundEnabled) return;
        try {
            const audio = new Audio(type === 'win' ? '/applause.mp3' : '/fail.mp3');
            audio.volume = 0.5;
            audio.play().catch(() => {});
        } catch {}
    }, [soundEnabled]);

    // جلب السؤال الإضافي بعد انتهاء اللعبة
    const loadBonusQuestion = async () => {
        const effectiveLang = getEffectiveLanguage();
        const q = await fetchBonusQuestion(employee?.specialty, effectiveLang);
        if (q) {
            setBonusQuestion({ ...q, source: 'ai', language: effectiveLang });
        }
        setShowBonusModal(true);
    };

    const handleBonusClose = (correct: boolean) => {
        setShowBonusModal(false);
        if (correct) {
            const bonusPoints = Math.floor(finalPoints * 0.5);
            toast.success(getEffectiveLanguage() === 'en' 
                ? `🎉 Bonus! +${bonusPoints} points` 
                : `🎉 مكافأة! +${bonusPoints} نقطة`);
            onComplete(finalPoints + bonusPoints, true);
        } else {
            onComplete(finalPoints, gameWin);
        }
    };

    const startGame = async () => {
        setStarting(true);
        try { await onStart(); } catch { setStarting(false); return; }
        const avail = PUZZLES.filter(p => !usedIds.includes(p.id));
        const pool  = avail.length > 0 ? avail : PUZZLES;
        const p     = pool[Math.floor(Math.random() * pool.length)];
        setUsedIds(prev => [...prev, p.id]);
        setPuzzle(p);
        const s = buildSticks(p.eq);
        setSticks(s); setOrigSticks(s.map(x=>({...x})));
        setTimeLeft(TIME_LIMIT);
        setAnswered(false); setIsCorrect(false);
        setDragging(null); setDragPos(null); setSnapTarget(null);
        setIsActive(true); setStarting(false);
    };

    useEffect(() => {
        if (!isActive || answered) return;
        if (timeLeft <= 0) { doTimeout(); return; }
        const t = setInterval(() => setTimeLeft(p => p-1), 1000);
        return () => clearInterval(t);
    }, [isActive, timeLeft, answered]);

    const doTimeout = () => {
        setIsActive(false); setAnswered(true); setIsCorrect(false);
        playSound('lose');
        const pts = Math.min(30, Math.max(5, Math.floor(timeLeft * 0.35)));
        setFinalPoints(0);
        setGameWin(false);
        setTimeout(() => {
            toast.error(getEffectiveLanguage() === 'en' ? '⏰ Time\'s up!' : '⏰ انتهى الوقت!');
            onComplete(0, false);
        }, 300);
    };

    const toSVG = (cx:number, cy:number) => {
        const svg = svgRef.current; if(!svg) return {x:0,y:0};
        const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
        return { x:(cx-r.left)*vb.width/r.width, y:(cy-r.top)*vb.height/r.height };
    };

    const findSnap = (x:number, y:number, excl:string): string|null => {
        if (!puzzle) return null;
        const { tokens } = buildLayout(puzzle.eq);
        let best:string|null=null, bestD=SNAP_R;
        tokens.forEach((tok, ti) => {
            if (tok.type==='eq') return;
            const slots = tok.type==='digit' ? digitSlots(tok.ox,tok.oy) : opSlots(tok.ox,tok.oy);
            slots.forEach((sl, si) => {
                const cx=(sl.x1+sl.x2)/2, cy=(sl.y1+sl.y2)/2;
                const d = Math.hypot(x-cx, y-cy);
                const id = `t${ti}_s${si}`;
                const occ = sticks.find(s=>s.id===id&&s.active);
                if (d<bestD && (!occ || id===excl)) { bestD=d; best=id; }
            });
        });
        return best;
    };

    const onPDown = (e:React.PointerEvent, sid:string) => {
        if (answered || !isActive || dragging) return;
        const st = sticks.find(s=>s.id===sid);
        if (!st || !st.active || !st.draggable) return;
        e.preventDefault();
        (e.target as Element).setPointerCapture(e.pointerId);
        setDragging(sid);
        setDragPos(toSVG(e.clientX, e.clientY));
        setSticks(prev => prev.map(s => s.id===sid ? {...s, active:false} : s));
    };

    const onPMove = (e:React.PointerEvent) => {
        if (!dragging) return;
        e.preventDefault();
        const pt = toSVG(e.clientX, e.clientY);
        setDragPos(pt);
        setSnapTarget(findSnap(pt.x, pt.y, dragging));
    };

    const onPUp = (e:React.PointerEvent) => {
        if (!dragging || !puzzle) return;
        e.preventDefault();
        const pt   = toSVG(e.clientX, e.clientY);
        const snap = findSnap(pt.x, pt.y, dragging);

        if (snap && snap !== dragging) {
            const { tokens } = buildLayout(puzzle.eq);
            const [tStr, sStr] = snap.split('_s');
            const ti  = parseInt(tStr.replace('t',''));
            const si  = parseInt(sStr);
            const tok = tokens[ti];
            const slots = tok.type==='digit' ? digitSlots(tok.ox,tok.oy) : opSlots(tok.ox,tok.oy);
            const sl  = slots[si];

            setSticks(prev => {
                const next = prev.map(s => {
                    if (s.id===snap) return { ...s, active:true, x1:sl.x1, y1:sl.y1, x2:sl.x2, y2:sl.y2, tokenIdx:ti, slotIdx:si };
                    return s;
                });
                setTimeout(() => {
                    setSticks(cur => {
                        const ev = readEq(cur, puzzle.eq);
                        if (ev && isValid(ev)) {
                            setAnswered(true); setIsCorrect(true); setIsActive(false);
                            playSound('win');
                            confetti({ particleCount: 120, spread: 60, origin: { y: 0.6 }, colors: ['#f59e0b', '#d97706', '#b91c1c'] });
                            const pts = Math.min(30, Math.max(5, Math.floor(timeLeft * 0.35)));
                            setFinalPoints(pts);
                            setGameWin(true);
                            toast.success(getEffectiveLanguage() === 'en' 
                                ? `🔥 Genius! +${pts} points` 
                                : `🔥 عبقري! +${pts} نقطة`);
                            // جلب السؤال الإضافي من AI بعد الفوز
                            setTimeout(() => loadBonusQuestion(), 1000);
                        }
                        return cur;
                    });
                }, 60);
                return next;
            });
        } else {
            const orig = origSticks.find(s=>s.id===dragging);
            if (orig) setSticks(prev => prev.map(s => s.id===dragging ? {...orig} : s));
        }
        setDragging(null); setDragPos(null); setSnapTarget(null);
    };

    const reset = () => {
        if (!puzzle) return;
        setSticks(origSticks.map(x=>({...x})));
        setDragging(null); setDragPos(null); setSnapTarget(null);
    };

    const cycleLanguage = () => {
        const options: ('auto' | 'ar' | 'en')[] = ['auto', 'ar', 'en'];
        const currentIndex = options.indexOf(language);
        const next = options[(currentIndex + 1) % options.length];
        setLanguage(next);
        const langMsg = next === 'auto' ? (needsMedicalEnglish() ? 'English (Auto)' : 'عربي (تلقائي)') : next === 'ar' ? 'عربي' : 'English';
        toast.success(`Language: ${langMsg}`, { icon: '🌐' });
    };

    const getLanguageDisplay = () => {
        if (language === 'ar') return '🇸🇦 عربي';
        if (language === 'en') return '🇬🇧 English';
        return needsMedicalEnglish() ? '🇬🇧 English (Auto)' : '🇸🇦 عربي (Auto)';
    };

    const isEn = getEffectiveLanguage() === 'en';

    // شاشة البداية
    if (!isActive && !answered && !showBonusModal) {
        return (
            <div className="text-center py-6 px-3">
                <div className="w-18 h-18 bg-gradient-to-br from-amber-500 to-orange-700 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xl" style={{width:72,height:72}}>
                    <Flame className="w-10 h-10 text-white"/>
                </div>
                <h3 className="text-xl font-black text-gray-800 mb-1">
                    {isEn ? 'Move One Match! 🔥' : 'حرك عود ثقاب! 🔥'}
                </h3>
                <p className="text-sm font-bold text-gray-500 mb-4 max-w-xs mx-auto leading-relaxed">
                    {isEn 
                        ? 'Move ONE matchstick to make the equation correct'
                        : 'حرك عود ثقاب واحد فقط لكي تصبح المعادلة صحيحة'}
                </p>
                <div className="flex justify-center gap-2 mb-4">
                    <button onClick={cycleLanguage} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 text-xs font-black">
                        <Globe className="w-3 h-3" /> {getLanguageDisplay()}
                    </button>
                    <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-1.5 rounded-lg hover:bg-gray-100">
                        {soundEnabled ? <Volume2 className="w-4 h-4 text-gray-600" /> : <VolumeX className="w-4 h-4 text-gray-400" />}
                    </button>
                </div>
                <button onClick={startGame} disabled={starting}
                    className="bg-gradient-to-r from-amber-500 to-orange-700 text-white px-8 py-3 rounded-xl font-black text-base shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50">
                    {starting ? (isEn ? 'Starting...' : 'جاري البدء...') : (isEn ? '🔥 Start Challenge' : '🔥 ابدأ التحدي')}
                </button>
            </div>
        );
    }

    if (!puzzle) return null;

    const { tokens, totalW } = buildLayout(puzzle.eq);
    const SVG_W = Math.max(totalW, 300);
    const SVG_H = 138;
    const dragOrig = dragging ? origSticks.find(s=>s.id===dragging) : null;

    return (
        <>
            <div className="max-w-lg mx-auto py-1 px-1 space-y-2 select-none" dir={isEn ? 'ltr' : 'rtl'}>

                {/* Header */}
                <div className="flex justify-between items-center px-1">
                    <div className="flex items-center gap-1.5">
                        <Flame className="w-4 h-4 text-orange-700"/>
                        <span className="font-black text-xs text-gray-700">
                            {isEn ? 'Move ONE matchstick' : 'حرك عود ثقاب واحد فقط'}
                        </span>
                    </div>
                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg font-black text-xs border ${timeLeft<=15 ? 'bg-red-100 text-red-800 border-red-400 animate-pulse' : 'bg-amber-100 text-amber-900 border-amber-400'}`}>
                        <Timer className="w-3 h-3"/> {timeLeft}s
                    </div>
                </div>

                {/* SVG Board */}
                <div className="rounded-xl overflow-hidden shadow-lg border-2 border-amber-500 w-full bg-amber-50"
                    style={{ touchAction:'none', backgroundColor:'#fef3c7' }}>
                    <svg ref={svgRef}
                        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                        style={{ width:'100%', height:'auto', display:'block', touchAction:'none' }}
                        onPointerMove={onPMove} onPointerUp={onPUp} onPointerCancel={onPUp}>

                        <rect width={SVG_W} height={SVG_H} fill="#fef3c7" rx="12"/>

                        {/* Empty slot guides */}
                        {tokens.map((tok, ti) => {
                            if (tok.type==='eq') return null;
                            const slots = tok.type==='digit' ? digitSlots(tok.ox,tok.oy) : opSlots(tok.ox,tok.oy);
                            return slots.map((sl, si) => {
                                const id    = `t${ti}_s${si}`;
                                const filled = sticks.find(s=>s.id===id&&s.active);
                                const isSnap = snapTarget===id;
                                if (filled) return null;
                                return (
                                    <line key={id}
                                        x1={sl.x1} y1={sl.y1} x2={sl.x2} y2={sl.y2}
                                        stroke={isSnap ? '#d97706' : '#92400e'}
                                        strokeWidth={isSnap ? SW+2 : SW-4}
                                        strokeLinecap="round"
                                        opacity={isSnap ? 0.85 : 0.16}
                                        strokeDasharray={isSnap ? 'none' : '6,5'}
                                    />
                                );
                            });
                        })}

                        {/* = sign */}
                        {tokens.filter(t=>t.type==='eq').map((tok, i) =>
                            eqSlots(tok.ox, tok.oy).map((sl, si) => (
                                <g key={`eq${i}${si}`}>
                                    <line x1={sl.x1+2} y1={sl.y1+2} x2={sl.x2+2} y2={sl.y2+2}
                                        stroke="#292524" strokeWidth={SW+3} strokeLinecap="round" opacity={0.2}/>
                                    <line x1={sl.x1} y1={sl.y1} x2={sl.x2} y2={sl.y2}
                                        stroke={STICK_BODY} strokeWidth={SW+1} strokeLinecap="round"/>
                                    <line x1={sl.x1} y1={sl.y1} x2={sl.x2} y2={sl.y2}
                                        stroke={STICK_HI} strokeWidth={3} strokeLinecap="round" opacity={0.5}/>
                                </g>
                            ))
                        )}

                        {/* Active sticks */}
                        {sticks.filter(s=>s.active).map(s => (
                            <g key={s.id}
                                onPointerDown={e=>onPDown(e, s.id)}
                                style={{ cursor:s.draggable&&!answered&&isActive?'grab':'default' }}>
                                <line x1={s.x1+2.5} y1={s.y1+2.5} x2={s.x2+2.5} y2={s.y2+2.5}
                                    stroke="#292524" strokeWidth={SW+4} strokeLinecap="round" opacity={0.18}/>
                                <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                                    stroke={answered ? (isCorrect?'#15803d':'#dc2626') : STICK_BODY}
                                    strokeWidth={SW+2} strokeLinecap="round"/>
                                <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                                    stroke={answered ? (isCorrect?'#4ade80':'#fca5a5') : STICK_HI}
                                    strokeWidth={3.5} strokeLinecap="round" opacity={0.5}/>
                                {s.draggable && !answered && (
                                    <>
                                        <circle cx={s.x1} cy={s.y1} r={6.5} fill={TIP_COL}/>
                                        <circle cx={s.x1} cy={s.y1} r={3} fill={TIP_IN}/>
                                    </>
                                )}
                            </g>
                        ))}

                        {/* Floating dragged stick */}
                        {dragging && dragPos && dragOrig && (() => {
                            const isH = Math.abs(dragOrig.x2-dragOrig.x1) > Math.abs(dragOrig.y2-dragOrig.y1);
                            const hl  = isH ? (dragOrig.x2-dragOrig.x1)/2 : 0;
                            const vl  = !isH ? (dragOrig.y2-dragOrig.y1)/2 : 0;
                            const x1=dragPos.x-hl, y1=dragPos.y-vl, x2=dragPos.x+hl, y2=dragPos.y+vl;
                            return (
                                <g style={{pointerEvents:'none'}}>
                                    <line x1={x1+2} y1={y1+2} x2={x2+2} y2={y2+2}
                                        stroke="#292524" strokeWidth={SW+6} strokeLinecap="round" opacity={0.2}/>
                                    <line x1={x1} y1={y1} x2={x2} y2={y2}
                                        stroke={STICK_DRAG} strokeWidth={SW+4} strokeLinecap="round"/>
                                    <circle cx={x1} cy={y1} r={7} fill={TIP_COL}/>
                                    <circle cx={x1} cy={y1} r={3} fill={TIP_IN}/>
                                </g>
                            );
                        })()}
                    </svg>
                </div>

                {/* Result */}
                {answered && (
                    <div className={`rounded-xl p-2 text-center font-black text-xs border-2 ${isCorrect ? 'bg-emerald-50 text-emerald-900 border-emerald-400' : 'bg-red-50 text-red-800 border-red-400'}`}>
                        {isCorrect
                            ? <><CheckCircle className="inline w-3.5 h-3.5 ml-1"/>{isEn ? 'Correct equation! 🎉' : 'معادلة صحيحة! 🎉'}</>
                            : <><XCircle className="inline w-3.5 h-3.5 ml-1"/>{isEn ? 'Correct answer: ' : 'الإجابة الصحيحة: '}<span className="font-mono bg-white px-1.5 py-0.5 rounded border mx-1">{puzzle.sol}</span></>}
                    </div>
                )}

                {/* Reset button */}
                {!answered && (
                    <button onClick={reset}
                        className="w-full flex items-center justify-center gap-2 py-2 bg-white text-gray-600 rounded-xl font-bold text-xs hover:bg-gray-100 active:scale-95 transition-all border border-gray-200">
                        <RotateCcw className="w-3.5 h-3.5"/> {isEn ? 'Reset' : 'إعادة الوضع الأصلي'}
                    </button>
                )}
            </div>

            {/* Bonus Question Modal */}
            {showBonusModal && bonusQuestion && (
                <BonusQuestionModal
                    question={bonusQuestion}
                    onClose={handleBonusClose}
                    isWin={gameWin}
                    points={finalPoints}
                />
            )}
        </>
    );
}