import React, { useState, useRef, useEffect } from 'react';
import { Flame, Timer, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
    onStart: () => Promise<void>;
    onComplete: (points: number, isWin: boolean) => void;
}

// ─── Layout constants ─────────────────────────────────────────────────────────
const DW = 54, DH = 90, OY = 22, OP_W = 30;
const SNAP_R   = 22;
const TIME_LIMIT = 60;

// Stick visuals — very dark for contrast on light bg
const STICK_BODY  = '#92400e';   // very dark brown
const STICK_EDGE  = '#451a03';   // almost black-brown outline
const STICK_DRAG  = '#b45309';   // slightly lighter when dragging
const TIP_COLOR   = '#b91c1c';   // dark red tip
const TIP_INNER   = '#fca5a5';
const SW          = 8;           // strokeWidth

// ─── 7-segment geometry ───────────────────────────────────────────────────────
function digitSlots(ox: number, oy: number) {
    const p = 7;
    const hh = DH / 2;
    return [
        { x1:ox+p,       y1:oy+p*0.5,     x2:ox+DW-p,     y2:oy+p*0.5     }, // 0 top
        { x1:ox+p*0.5,   y1:oy+p,         x2:ox+p*0.5,    y2:oy+hh-p      }, // 1 top-left
        { x1:ox+DW-p*0.5,y1:oy+p,         x2:ox+DW-p*0.5, y2:oy+hh-p      }, // 2 top-right
        { x1:ox+p,       y1:oy+hh,        x2:ox+DW-p,     y2:oy+hh        }, // 3 middle
        { x1:ox+p*0.5,   y1:oy+hh+p,      x2:ox+p*0.5,    y2:oy+DH-p      }, // 4 bot-left
        { x1:ox+DW-p*0.5,y1:oy+hh+p,      x2:ox+DW-p*0.5, y2:oy+DH-p      }, // 5 bot-right
        { x1:ox+p,       y1:oy+DH-p*0.5,  x2:ox+DW-p,     y2:oy+DH-p*0.5  }, // 6 bottom
    ];
}

const DIGIT_ON: Record<number,number[]> = {
    0:[0,1,2,4,5,6], 1:[2,5], 2:[0,2,3,4,6], 3:[0,2,3,5,6],
    4:[1,2,3,5], 5:[0,1,3,5,6], 6:[0,1,3,4,5,6], 7:[0,2,5],
    8:[0,1,2,3,4,5,6], 9:[0,1,2,3,5,6],
};

function opSlots(ox: number, oy: number) {
    const cx = ox+OP_W/2, cy = oy+DH/2;
    return [
        { x1:cx-12, y1:cy,    x2:cx+12, y2:cy    },
        { x1:cx,    y1:cy-12, x2:cx,    y2:cy+12 },
    ];
}

function eqSlots(ox: number, oy: number) {
    const cx = ox+OP_W/2, cy = oy+DH/2;
    return [
        { x1:cx-12, y1:cy-8, x2:cx+12, y2:cy-8 },
        { x1:cx-12, y1:cy+8, x2:cx+12, y2:cy+8 },
    ];
}

// ─── Layout ───────────────────────────────────────────────────────────────────
interface Token { type:'digit'|'op'|'eq'; value:number|string; ox:number; oy:number }
function buildLayout(eq:(number|string)[]): { tokens:Token[]; totalW:number } {
    let x = 16;
    const tokens:Token[] = [];
    eq.forEach(tok => {
        if (typeof tok==='number') { tokens.push({type:'digit',value:tok,ox:x,oy:OY}); x+=DW+16; }
        else if (tok==='=')        { tokens.push({type:'eq',value:'=',ox:x,oy:OY});    x+=OP_W+16; }
        else                       { tokens.push({type:'op',value:tok,ox:x,oy:OY});    x+=OP_W+16; }
    });
    return { tokens, totalW:x+10 };
}

// ─── Stick ────────────────────────────────────────────────────────────────────
interface Stick { id:string; tokenIdx:number; slotIdx:number; active:boolean; draggable:boolean; x1:number; y1:number; x2:number; y2:number }

function buildSticks(eq:(number|string)[]): Stick[] {
    const {tokens} = buildLayout(eq);
    const out:Stick[] = [];
    tokens.forEach((tok,ti) => {
        if (tok.type==='digit') {
            const slots = digitSlots(tok.ox,tok.oy);
            const on = DIGIT_ON[tok.value as number]??[];
            slots.forEach((sl,si) => out.push({id:`t${ti}_s${si}`,tokenIdx:ti,slotIdx:si,active:on.includes(si),draggable:true,...sl}));
        } else if (tok.type==='op') {
            const slots = opSlots(tok.ox,tok.oy);
            const isPlus = tok.value==='+';
            slots.forEach((sl,si) => out.push({id:`t${ti}_s${si}`,tokenIdx:ti,slotIdx:si,active:si===0||(isPlus&&si===1),draggable:true,...sl}));
        } else {
            eqSlots(tok.ox,tok.oy).forEach((sl,si) =>
                out.push({id:`t${ti}_s${si}`,tokenIdx:ti,slotIdx:si,active:true,draggable:false,...sl})
            );
        }
    });
    return out;
}

function readEq(sticks:Stick[], eq:(number|string)[]): (number|string)[]|null {
    const {tokens} = buildLayout(eq);
    const res:(number|string)[] = [];
    for (let ti=0;ti<tokens.length;ti++) {
        const tok=tokens[ti];
        const ts=sticks.filter(s=>s.tokenIdx===ti&&s.active);
        if (tok.type==='eq') { res.push('='); continue; }
        if (tok.type==='op') {
            const h=ts.some(s=>s.slotIdx===0), v=ts.some(s=>s.slotIdx===1);
            if(h&&v) res.push('+'); else if(h&&!v) res.push('-'); else return null;
            continue;
        }
        const segs=[...ts.map(s=>s.slotIdx)].sort((a,b)=>a-b);
        let d=-1;
        for(let n=0;n<=9;n++){
            const s=[...DIGIT_ON[n]].sort((a,b)=>a-b);
            if(s.length===segs.length&&s.every((v,i)=>v===segs[i])){d=n;break;}
        }
        if(d===-1) return null;
        res.push(d);
    }
    return res;
}

function isValid(eq:(number|string)[]): boolean {
    const ei=eq.indexOf('='); if(ei<0) return false;
    const calc=(side:(number|string)[]):number|null=>{
        let v=typeof side[0]==='number'?side[0]:null; if(v===null) return null;
        for(let i=1;i<side.length;i+=2){
            const op=side[i],n=side[i+1]; if(typeof n!=='number') return null;
            if(op==='+') v+=n; else if(op==='-') v-=n; else return null;
        }
        return v;
    };
    const lv=calc(eq.slice(0,ei)), rv=calc(eq.slice(ei+1));
    return lv!==null&&rv!==null&&lv===rv&&rv>=0;
}

// ─── 45 puzzles from user tables (negatives excluded: #10,24,31,42,50) ───────
const PUZZLES = [
    { id: 1, eq:[6,'+',4,'=',4],   hint:'نقل العود الأوسط من 6 ليصبح 0',                sol:'0+4=4'  },
    { id: 2, eq:[8,'-',3,'=',3],   hint:'إزالة العود السفلي الأيسر من 8 لتصبح 6',       sol:'6-3=3'  },
    { id: 3, eq:[9,'-',5,'=',8],   hint:'نقل عود من 9 لتحويلها 3 وتحويل - إلى +',      sol:'3+5=8'  },
    { id: 4, eq:[5,'+',3,'=',9],   hint:'إزالة العود العلوي الأيسر من 9 لتصبح 8',       sol:'5+3=8'  },
    { id: 5, eq:[9,'+',1,'=',5],   hint:'نقل عود من 9 لتصبح 3 ويتحول الناتج إلى 4',    sol:'3+1=4'  },
    { id: 6, eq:[8,'+',1,'=',10],  hint:'إزالة العود السفلي الأيسر من 8 لتصبح 6',       sol:'6+1=7'  },
    { id: 7, eq:[6,'-',2,'=',8],   hint:'نقل عود من 6 للأعلى لتصبح 8 ويتحول الناتج',   sol:'8-2=6'  },
    { id: 8, eq:[8,'-',1,'=',9],   hint:'إزالة عود من 8 لتصبح 6 والناتج يصبح 5',       sol:'6-1=5'  },
    { id: 9, eq:[2,'+',3,'=',9],   hint:'إزالة عود من 9 لتصبح 5',                      sol:'2+3=5'  },
    { id:11, eq:[8,'-',5,'=',1],   hint:'إزالة عود من 8 لتصبح 6',                      sol:'6-5=1'  },
    { id:12, eq:[3,'+',5,'=',9],   hint:'إزالة عود من 9 لتصبح 8',                      sol:'3+5=8'  },
    { id:13, eq:[6,'+',1,'=',9],   hint:'نقل عود من 6 للأعلى لتصبح 8',                 sol:'8+1=9'  },
    { id:14, eq:[7,'+',3,'=',1],   hint:'نقل عود من 7 ليصبح 1 والناتج يصبح 4',         sol:'1+3=4'  },
    { id:15, eq:[5,'-',2,'=',9],   hint:'إزالة عود من 9 لتصبح 3',                      sol:'5-2=3'  },
    { id:16, eq:[8,'+',2,'=',3],   hint:'إزالة عود من 8 ونقله للناتج ليصبح 8',         sol:'6+2=8'  },
    { id:17, eq:[4,'+',4,'=',6],   hint:'إضافة عود داخل 6 من أحد الأرقام لتصبح 8',     sol:'4+4=8'  },
    { id:18, eq:[8,'-',2,'=',1],   hint:'إزالة عود من 8 لتصبح 6 والناتج يصبح 4',       sol:'6-2=4'  },
    { id:19, eq:[9,'+',4,'=',8],   hint:'نقل عود من 9 لتصبح 3 والناتج يصبح 7',         sol:'3+4=7'  },
    { id:20, eq:[8,'+',3,'=',6],   hint:'نقل عود من 8 للناتج، 8 تصبح 6 والناتج 9',     sol:'6+3=9'  },
    { id:21, eq:[6,'-',4,'=',9],   hint:'نقل عود من 6 لتصبح 8 والناتج يصبح 4',         sol:'8-4=4'  },
    { id:22, eq:[8,'+',4,'=',5],   hint:'نقل عود من 8 للناتج، 8 تصبح 6 والناتج 10',    sol:'6+4=10' },
    { id:23, eq:[9,'-',1,'=',7],   hint:'نقل عود من 9 لتصبح 3 والناتج يصبح 2',         sol:'3-1=2'  },
    { id:25, eq:[5,'+',1,'=',9],   hint:'إزالة عود من 9 لتصبح 6',                      sol:'5+1=6'  },
    { id:26, eq:[8,'-',4,'=',6],   hint:'نقل عود من 8 للناتج، 8 تصبح 6 والناتج 2',     sol:'6-4=2'  },
    { id:27, eq:[6,'+',2,'=',6],   hint:'نقل عود من 6 لتصبح 8 والناتج يصبح 10',        sol:'8+2=10' },
    { id:28, eq:[9,'-',3,'=',5],   hint:'نقل عود من 9 لتصبح 3 والناتج يصبح 0',         sol:'3-3=0'  },
    { id:29, eq:[8,'+',5,'=',9],   hint:'نقل عود من 8 لتصبح 6 والناتج يصبح 11',        sol:'6+5=11' },
    { id:30, eq:[5,'+',5,'=',3],   hint:'نقل عود لأحد الرقمين للناتج ليصبح 10',        sol:'5+5=10' },
    { id:32, eq:[8,'-',6,'=',8],   hint:'نقل عود من 8 لتصبح 6 والناتج يصبح 0',         sol:'6-6=0'  },
    { id:33, eq:[9,'+',2,'=',3],   hint:'نقل عود من 9 لتصبح 3 والناتج يصبح 5',         sol:'3+2=5'  },
    { id:34, eq:[6,'-',1,'=',9],   hint:'نقل عود من 6 لتصبح 8 والناتج يصبح 7',         sol:'8-1=7'  },
    { id:35, eq:[8,'+',1,'=',6],   hint:'إزالة عود من 8 لتصبح 6 والناتج يصبح 7',       sol:'6+1=7'  },
    { id:36, eq:[9,'-',2,'=',7],   hint:'نقل عود من 9 لتصبح 3 والناتج يصبح 1',         sol:'3-2=1'  },
    { id:37, eq:[8,'+',3,'=',4],   hint:'نقل عود من 8 للناتج، 8 تصبح 6 والناتج 9',     sol:'6+3=9'  },
    { id:38, eq:[6,'+',3,'=',5],   hint:'نقل عود من 6 لتصبح 8 والناتج يصبح 11',        sol:'8+3=11' },
    { id:39, eq:[8,'-',3,'=',9],   hint:'نقل عود من 8 لتصبح 6 والناتج يصبح 3',         sol:'6-3=3'  },
    { id:40, eq:[4,'+',2,'=',9],   hint:'نقل عود من 9 لتصبح 6',                        sol:'4+2=6'  },
    { id:41, eq:[8,'+',6,'=',9],   hint:'نقل عود من 8 لتصبح 6 والناتج يصبح 12',        sol:'6+6=12' },
    { id:43, eq:[3,'+',3,'=',9],   hint:'نقل عود من 9 لتصبح 6',                        sol:'3+3=6'  },
    { id:44, eq:[8,'-',1,'=',3],   hint:'نقل عود من 8 لتصبح 6 والناتج يصبح 5',         sol:'6-1=5'  },
    { id:45, eq:[5,'+',4,'=',1],   hint:'نقل عود للناتج ليصبح 9',                      sol:'5+4=9'  },
    { id:46, eq:[6,'+',4,'=',8],   hint:'نقل عود من 6 لتصبح 8 والناتج يصبح 12',        sol:'8+4=12' },
    { id:47, eq:[8,'-',2,'=',4],   hint:'نقل عود من 8 لتصبح 6 والناتج يصبح 4',         sol:'6-2=4'  },
    { id:48, eq:[9,'+',5,'=',5],   hint:'نقل عود من 9 لتصبح 3 والناتج يصبح 8',         sol:'3+5=8'  },
    { id:49, eq:[8,'+',2,'=',6],   hint:'نقل عود من 8 لتصبح 6 والناتج يصبح 8',         sol:'6+2=8'  },
];

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MoveTheMatch({ onStart, onComplete }: Props) {
    const [puzzle, setPuzzle] = useState<typeof PUZZLES[0]|null>(null);
    const [sticks, setSticks] = useState<Stick[]>([]);
    const [origSticks, setOrigSticks] = useState<Stick[]>([]);
    const [movesMade, setMovesMade] = useState(0);
    const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
    const [isActive, setIsActive] = useState(false);
    const [starting, setStarting] = useState(false);
    const [answered, setAnswered] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);
    const [usedIds, setUsedIds] = useState<number[]>([]);
    const [dragging, setDragging] = useState<string|null>(null);
    const [dragPos, setDragPos] = useState<{x:number;y:number}|null>(null);
    const [snapTarget, setSnapTarget] = useState<string|null>(null);
    const svgRef = useRef<SVGSVGElement>(null);

    const startGame = async () => {
        setStarting(true);
        try { await onStart(); } catch { setStarting(false); return; }
        const avail = PUZZLES.filter(p => !usedIds.includes(p.id));
        const pool = avail.length > 0 ? avail : PUZZLES;
        const p = pool[Math.floor(Math.random() * pool.length)];
        setUsedIds(prev => [...prev, p.id]);
        setPuzzle(p);
        const s = buildSticks(p.eq);
        setSticks(s); setOrigSticks(s.map(x=>({...x})));
        setMovesMade(0); setTimeLeft(TIME_LIMIT);
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
        setTimeout(() => { toast.error('⏰ انتهى الوقت!'); onComplete(0, false); }, 300);
    };

    const toSVG = (cx:number, cy:number) => {
        const svg = svgRef.current; if(!svg) return {x:0,y:0};
        const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
        return { x:(cx-r.left)*vb.width/r.width, y:(cy-r.top)*vb.height/r.height };
    };

    const findSnap = (x:number, y:number, excl:string): string|null => {
        if (!puzzle) return null;
        const {tokens} = buildLayout(puzzle.eq);
        let best:string|null=null, bestD=SNAP_R;
        tokens.forEach((tok,ti) => {
            if (tok.type==='eq') return;
            const slots = tok.type==='digit' ? digitSlots(tok.ox,tok.oy) : opSlots(tok.ox,tok.oy);
            slots.forEach((sl,si) => {
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
        if (answered||!isActive||dragging) return;
        const st = sticks.find(s=>s.id===sid);
        if (!st||!st.active||!st.draggable) return;
        e.preventDefault();
        (e.target as Element).setPointerCapture(e.pointerId);
        setDragging(sid);
        setDragPos(toSVG(e.clientX, e.clientY));
        setSticks(prev => prev.map(s => s.id===sid ? {...s,active:false} : s));
    };

    const onPMove = (e:React.PointerEvent) => {
        if (!dragging) return;
        e.preventDefault();
        const pt = toSVG(e.clientX, e.clientY);
        setDragPos(pt);
        setSnapTarget(findSnap(pt.x, pt.y, dragging));
    };

    const onPUp = (e:React.PointerEvent) => {
        if (!dragging||!puzzle) return;
        e.preventDefault();
        const pt = toSVG(e.clientX, e.clientY);
        const snap = findSnap(pt.x, pt.y, dragging);

        if (snap && snap!==dragging) {
            const {tokens} = buildLayout(puzzle.eq);
            const [tStr,sStr] = snap.split('_s');
            const ti = parseInt(tStr.replace('t',''));
            const si = parseInt(sStr);
            const tok = tokens[ti];
            const slots = tok.type==='digit' ? digitSlots(tok.ox,tok.oy) : opSlots(tok.ox,tok.oy);
            const sl = slots[si];
            setMovesMade(m => m+1);
            setSticks(prev => {
                const next = prev.map(s => {
                    if (s.id===snap) return {...s,active:true,x1:sl.x1,y1:sl.y1,x2:sl.x2,y2:sl.y2,tokenIdx:ti,slotIdx:si};
                    return s;
                });
                setTimeout(() => {
                    setSticks(cur => {
                        const ev = readEq(cur, puzzle.eq);
                        if (ev && isValid(ev)) {
                            setAnswered(true); setIsCorrect(true); setIsActive(false);
                            const pts = Math.max(20, Math.floor(timeLeft*0.85));
                            setTimeout(() => { toast.success(`🔥 عبقري! +${pts} نقطة`); onComplete(pts, true); }, 350);
                        }
                        return cur;
                    });
                }, 80);
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
        setMovesMade(0); setDragging(null); setDragPos(null); setSnapTarget(null);
    };


    // ── IDLE ──────────────────────────────────────────────────────────────────
    if (!isActive && !answered) return (
        <div className="text-center py-8 px-4">
            <div className="w-20 h-20 bg-gradient-to-br from-amber-500 to-orange-700 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-2xl">
                <Flame className="w-12 h-12 text-white"/>
            </div>
            <h3 className="text-2xl font-black text-gray-800 mb-2">حرك عود ثقاب! 🔥</h3>
            <p className="text-sm font-bold text-gray-500 mb-4 max-w-sm mx-auto">
                اسحب العيدان من مكانها إلى مكان جديد لتصحح المعادلة — حركة واحدة فقط!
            </p>
            <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-3 mb-6 text-xs font-bold text-amber-900 max-w-xs mx-auto">
                👆 اضغط على العود واسحبه للموضع المناسب
            </div>
            <button onClick={startGame} disabled={starting}
                className="bg-gradient-to-r from-amber-500 to-orange-700 text-white px-10 py-4 rounded-2xl font-black text-lg shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50">
                {starting ? '⏳ جاري البدء...' : '🔥 ابدأ التحدي'}
            </button>
        </div>
    );

    if (!puzzle) return null;

    const {tokens, totalW} = buildLayout(puzzle.eq);
    const SVG_W = Math.max(totalW, 280);
    const SVG_H = OY + DH + 30;
    const movesLeft = 1 - movesMade;
    const dragOrig = dragging ? origSticks.find(s=>s.id===dragging) : null;

    return (
        <div className="max-w-lg mx-auto py-3 px-2 space-y-3 select-none" dir="rtl">

            {/* Header */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Flame className="w-5 h-5 text-orange-700"/>
                    <span className="font-black text-sm text-gray-800">عود الثقاب</span>
                    <span className={`px-2 py-0.5 rounded-lg text-xs font-black border ${movesLeft>0 ? 'bg-amber-100 text-amber-900 border-amber-400' : 'bg-red-100 text-red-800 border-red-400'}`}>
                        {movesLeft > 0 ? '١ حركة متاحة' : 'استُنفدت الحركة'}
                    </span>
                </div>
                <div className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-black text-sm border ${timeLeft<=15 ? 'bg-red-100 text-red-800 border-red-400 animate-pulse' : 'bg-amber-100 text-amber-900 border-amber-400'}`}>
                    <Timer className="w-4 h-4"/> {timeLeft}
                </div>
            </div>

            {/* Hint */}
            <div className="bg-orange-50 border-2 border-orange-400 rounded-xl p-3">
                <p className="text-xs font-bold text-orange-900">💡 {puzzle.hint}</p>
                <p className="text-[11px] text-orange-700 mt-0.5 font-semibold">اسحب العود إلى الموضع الصحيح • الموضع المتاح يتلون عند الاقتراب</p>
            </div>

            {/* SVG Board */}
            <div className="rounded-3xl overflow-hidden shadow-2xl border-4 border-amber-500"
                style={{ touchAction:'none', backgroundColor:'#fffbeb' }}>
                <svg ref={svgRef}
                    viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                    style={{ width:'100%', height:'auto', display:'block', touchAction:'none' }}
                    onPointerMove={onPMove} onPointerUp={onPUp} onPointerCancel={onPUp}>

                    <defs>
                        <filter id="sf" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="0.8" result="b"/>
                            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                        </filter>
                        <filter id="df" x="-40%" y="-40%" width="180%" height="180%">
                            <feGaussianBlur stdDeviation="2.5" result="b"/>
                            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                        </filter>
                    </defs>

                    {/* Warm board background */}
                    <rect width={SVG_W} height={SVG_H} fill="#fffbeb" rx="20"/>
                    {/* subtle wood lines */}
                    {[0,1,2,3,4,5,6,7].map(i=>(
                        <line key={i} x1={0} y1={i*18+6} x2={SVG_W} y2={i*18+6}
                            stroke="#fde68a" strokeWidth={1.5} opacity={0.6}/>
                    ))}

                    {/* Empty slot guides */}
                    {tokens.map((tok,ti) => {
                        if (tok.type==='eq') return null;
                        const slots = tok.type==='digit' ? digitSlots(tok.ox,tok.oy) : opSlots(tok.ox,tok.oy);
                        return slots.map((sl,si) => {
                            const id = `t${ti}_s${si}`;
                            const filled = sticks.find(s=>s.id===id&&s.active);
                            const isSnap = snapTarget===id;
                            if (filled) return null;
                            return (
                                <line key={id}
                                    x1={sl.x1} y1={sl.y1} x2={sl.x2} y2={sl.y2}
                                    stroke={isSnap ? '#d97706' : '#92400e'}
                                    strokeWidth={isSnap ? SW+1 : SW-3}
                                    strokeLinecap="round"
                                    opacity={isSnap ? 0.8 : 0.18}
                                    strokeDasharray={isSnap ? 'none' : '5,4'}
                                />
                            );
                        });
                    })}

                    {/* = sign (never draggable) */}
                    {tokens.filter(t=>t.type==='eq').map((tok,i)=>
                        eqSlots(tok.ox,tok.oy).map((sl,si)=>(
                            <g key={`eq${i}${si}`}>
                                <line x1={sl.x1+1.5} y1={sl.y1+1.5} x2={sl.x2+1.5} y2={sl.y2+1.5}
                                    stroke="#451a03" strokeWidth={SW+2} strokeLinecap="round" opacity={0.25}/>
                                <line x1={sl.x1} y1={sl.y1} x2={sl.x2} y2={sl.y2}
                                    stroke={STICK_BODY} strokeWidth={SW} strokeLinecap="round"/>
                                <line x1={sl.x1} y1={sl.y1} x2={sl.x2} y2={sl.y2}
                                    stroke={STICK_EDGE} strokeWidth={2} strokeLinecap="round" opacity={0.5}/>
                            </g>
                        ))
                    )}

                    {/* Active sticks */}
                    {sticks.filter(s=>s.active).map(s=>(
                        <g key={s.id}
                            onPointerDown={e=>onPDown(e,s.id)}
                            style={{ cursor:s.draggable&&!answered&&isActive?'grab':'default' }}>
                            {/* drop shadow */}
                            <line x1={s.x1+2} y1={s.y1+2} x2={s.x2+2} y2={s.y2+2}
                                stroke="#451a03" strokeWidth={SW+3} strokeLinecap="round" opacity={0.22}/>
                            {/* body */}
                            <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                                stroke={answered ? (isCorrect?'#15803d':'#dc2626') : STICK_BODY}
                                strokeWidth={SW+1} strokeLinecap="round"/>
                            {/* top highlight stripe */}
                            <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                                stroke={answered ? (isCorrect?'#4ade80':'#fca5a5') : '#d97706'}
                                strokeWidth={3} strokeLinecap="round" opacity={0.55}/>
                            {/* sharp edge */}
                            <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                                stroke={STICK_EDGE} strokeWidth={1.5} strokeLinecap="round" opacity={0.6}/>
                            {/* tip */}
                            {s.draggable && !answered && (
                                <>
                                    <circle cx={s.x1} cy={s.y1} r={7} fill="#7f1d1d" opacity={0.3}/>
                                    <circle cx={s.x1} cy={s.y1} r={5.5} fill={TIP_COLOR}/>
                                    <circle cx={s.x1} cy={s.y1} r={2.5} fill={TIP_INNER}/>
                                </>
                            )}
                        </g>
                    ))}

                    {/* Floating dragged stick */}
                    {dragging && dragPos && dragOrig && (() => {
                        const isH = Math.abs(dragOrig.x2-dragOrig.x1) > Math.abs(dragOrig.y2-dragOrig.y1);
                        const hl = isH ? (dragOrig.x2-dragOrig.x1)/2 : 0;
                        const vl = !isH ? (dragOrig.y2-dragOrig.y1)/2 : 0;
                        const x1=dragPos.x-hl, y1=dragPos.y-vl, x2=dragPos.x+hl, y2=dragPos.y+vl;
                        return (
                            <g style={{pointerEvents:'none'}}>
                                <line x1={x1+2} y1={y1+2} x2={x2+2} y2={y2+2}
                                    stroke="#451a03" strokeWidth={SW+5} strokeLinecap="round" opacity={0.2}/>
                                <line x1={x1} y1={y1} x2={x2} y2={y2}
                                    stroke={STICK_DRAG} strokeWidth={SW+3} strokeLinecap="round" filter="url(#df)"/>
                                <line x1={x1} y1={y1} x2={x2} y2={y2}
                                    stroke="#fbbf24" strokeWidth={3} strokeLinecap="round" opacity={0.6}/>
                                <line x1={x1} y1={y1} x2={x2} y2={y2}
                                    stroke={STICK_EDGE} strokeWidth={1.5} strokeLinecap="round" opacity={0.7}/>
                                <circle cx={x1} cy={y1} r={7} fill="#7f1d1d" opacity={0.3}/>
                                <circle cx={x1} cy={y1} r={5.5} fill={TIP_COLOR} filter="url(#df)"/>
                                <circle cx={x1} cy={y1} r={2.5} fill={TIP_INNER}/>
                            </g>
                        );
                    })()}

                    {answered && isCorrect && (
                        <rect x={0} y={0} width={SVG_W} height={SVG_H} fill="#22c55e" opacity={0.07} rx={20}/>
                    )}
                </svg>
            </div>

            {/* Result */}
            {answered && (
                <div className={`rounded-2xl p-4 text-center font-black text-base border-2 ${isCorrect ? 'bg-emerald-50 text-emerald-900 border-emerald-400' : 'bg-red-50 text-red-800 border-red-400'}`}>
                    {isCorrect
                        ? <><CheckCircle className="inline w-5 h-5 ml-1"/>معادلة صحيحة! 🎉</>
                        : <><XCircle className="inline w-5 h-5 ml-1"/>الحل: <span className="font-mono bg-white px-2 py-0.5 rounded-lg border">{puzzle.sol}</span></>}
                </div>
            )}

            {/* Controls */}
            {!answered && (
                <button onClick={reset}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-100 active:scale-95 transition-all border-2 border-gray-300">
                    <RotateCcw className="w-4 h-4" /> إعادة الوضع الأصلي
                </button>
            )}
        </div>
    );
}
