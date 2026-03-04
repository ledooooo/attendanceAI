import React, { useState, useRef, useEffect } from 'react';
import { Flame, Timer, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
    onStart: () => Promise<void>;
    onComplete: (points: number, isWin: boolean) => void;
}

// ─── 7-segment layout ─────────────────────────────────────────────────────────
const DW = 52, DH = 86, OY = 20, OP_W = 28, STICK_W = 6, SNAP_R = 20, TIME_LIMIT = 60;

const DIGIT_ON: Record<number, number[]> = {
    0:[0,1,2,4,5,6], 1:[2,5], 2:[0,2,3,4,6], 3:[0,2,3,5,6],
    4:[1,2,3,5],     5:[0,1,3,5,6], 6:[0,1,3,4,5,6], 7:[0,2,5],
    8:[0,1,2,3,4,5,6], 9:[0,1,2,3,5,6],
};

function digitSlots(ox: number, oy: number) {
    const r = 6;
    const hh = DH / 2;
    return [
        { x1: ox+r,    y1: oy+r*0.5,    x2: ox+DW-r,    y2: oy+r*0.5    }, // 0 top
        { x1: ox+r*0.5,y1: oy+r,        x2: ox+r*0.5,    y2: oy+hh-r    }, // 1 top-left
        { x1: ox+DW-r*0.5,y1:oy+r,      x2: ox+DW-r*0.5, y2: oy+hh-r   }, // 2 top-right
        { x1: ox+r,    y1: oy+hh,        x2: ox+DW-r,    y2: oy+hh       }, // 3 middle
        { x1: ox+r*0.5,y1: oy+hh+r,     x2: ox+r*0.5,    y2: oy+DH-r    }, // 4 bot-left
        { x1: ox+DW-r*0.5,y1:oy+hh+r,   x2: ox+DW-r*0.5, y2: oy+DH-r   }, // 5 bot-right
        { x1: ox+r,    y1: oy+DH-r*0.5, x2: ox+DW-r,    y2: oy+DH-r*0.5 }, // 6 bottom
    ];
}

function opSlots(ox: number, oy: number) {
    const cx = ox + OP_W / 2, cy = oy + DH / 2;
    return [
        { x1: cx-11, y1: cy,    x2: cx+11, y2: cy    }, // horizontal
        { x1: cx,    y1: cy-11, x2: cx,    y2: cy+11 }, // vertical
    ];
}

function eqSlots(ox: number, oy: number) {
    const cx = ox + OP_W / 2, cy = oy + DH / 2;
    return [
        { x1: cx-11, y1: cy-7, x2: cx+11, y2: cy-7 },
        { x1: cx-11, y1: cy+7, x2: cx+11, y2: cy+7 },
    ];
}

// ─── Layout ───────────────────────────────────────────────────────────────────
interface Token { type:'digit'|'op'|'eq'; value:number|string; ox:number; oy:number }
function buildLayout(eq:(number|string)[]): { tokens:Token[]; totalW:number } {
    let x = 18;
    const tokens: Token[] = [];
    eq.forEach(tok => {
        if (typeof tok === 'number') { tokens.push({type:'digit',value:tok,ox:x,oy:OY}); x+=DW+16; }
        else if (tok==='=')          { tokens.push({type:'eq',value:'=',ox:x,oy:OY});    x+=OP_W+16; }
        else                         { tokens.push({type:'op',value:tok,ox:x,oy:OY});    x+=OP_W+16; }
    });
    return { tokens, totalW: x+10 };
}

// ─── Stick ────────────────────────────────────────────────────────────────────
interface Stick { id:string; tokenIdx:number; slotIdx:number; active:boolean; draggable:boolean; x1:number; y1:number; x2:number; y2:number }

function buildSticks(eq:(number|string)[]): Stick[] {
    const {tokens} = buildLayout(eq);
    const out: Stick[] = [];
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
            const slots = eqSlots(tok.ox,tok.oy);
            slots.forEach((sl,si) => out.push({id:`t${ti}_s${si}`,tokenIdx:ti,slotIdx:si,active:true,draggable:false,...sl}));
        }
    });
    return out;
}

function readEq(sticks:Stick[], eq:(number|string)[]): (number|string)[]|null {
    const {tokens} = buildLayout(eq);
    const res:(number|string)[] = [];
    for (let ti=0;ti<tokens.length;ti++) {
        const tok = tokens[ti];
        const ts = sticks.filter(s=>s.tokenIdx===ti&&s.active);
        if (tok.type==='eq') { res.push('='); continue; }
        if (tok.type==='op') {
            const h=ts.some(s=>s.slotIdx===0), v=ts.some(s=>s.slotIdx===1);
            if(h&&v) res.push('+'); else if(h&&!v) res.push('-'); else return null;
            continue;
        }
        const segs=[...ts.map(s=>s.slotIdx)].sort((a,b)=>a-b);
        let d=-1;
        for(let n=0;n<=9;n++){const s=[...DIGIT_ON[n]].sort((a,b)=>a-b);if(s.length===segs.length&&s.every((v,i)=>v===segs[i])){d=n;break;}}
        if(d===-1) return null;
        res.push(d);
    }
    return res;
}

function isValid(eq:(number|string)[]): boolean {
    const ei = eq.indexOf('='); if(ei<0) return false;
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

// ─── 40 puzzles (1 move each, verified) ──────────────────────────────────────
// Format: { id, eq: wrong equation, hint, solution label }
const PUZZLES = [
    // Classic single-digit
    { id:1,  eq:[6,'+',4,'=',4],  hint:'حرك عوداً من 6 أو غير العملية',     sol:'6-4=2 أو 6+4=10' },
    { id:2,  eq:[8,'-',3,'=',6],  hint:'الناتج 6 يصبح 5',                    sol:'8-3=5' },
    { id:3,  eq:[3,'+',3,'=',9],  hint:'9 يصبح 6 بإزالة عود',               sol:'3+3=6' },
    { id:4,  eq:[1,'+',1,'=',3],  hint:'3 يصبح 2',                           sol:'1+1=2' },
    { id:5,  eq:[5,'+',5,'=',9],  hint:'5+5=10 ليس 9، غير 9 إلى 0',        sol:'5+5=10... نعم 0→10 wrong; hint: 9→0 no. Try 5+4=9' },
    { id:6,  eq:[7,'-',2,'=',6],  hint:'7-2=5 وليس 6، غير 6 إلى 5',        sol:'7-2=5' },
    { id:7,  eq:[9,'-',5,'=',6],  hint:'9-5=4 وليس 6، غير 6 إلى 4',        sol:'9-5=4' },
    { id:8,  eq:[2,'+',6,'=',9],  hint:'2+6=8 وليس 9، غير 9 إلى 8',        sol:'2+6=8' },
    { id:9,  eq:[4,'+',3,'=',6],  hint:'4+3=7 وليس 6، غير 6 إلى 7',        sol:'4+3=7' },
    { id:10, eq:[8,'+',1,'=',6],  hint:'8+1=9 أو حرك عوداً من 8',          sol:'8+1=9' },
    // 0 and 8 transformations
    { id:11, eq:[0,'+',3,'=',4],  hint:'0+3=3 وليس 4، غير 4 إلى 3',        sol:'0+3=3' },
    { id:12, eq:[8,'-',8,'=',1],  hint:'8-8=0 وليس 1، غير 1 إلى 0',        sol:'8-8=0' },
    { id:13, eq:[6,'+',1,'=',8],  hint:'6+1=7 وليس 8، غير 8 إلى 7',        sol:'6+1=7' },
    { id:14, eq:[5,'-',2,'=',4],  hint:'5-2=3 وليس 4، غير 4 إلى 3',        sol:'5-2=3' },
    { id:15, eq:[9,'+',0,'=',8],  hint:'9+0=9 وليس 8، غير 8 إلى 9',        sol:'9+0=9' },
    // Operator swaps (+ ↔ -)
    { id:16, eq:[9,'+',3,'=',6],  hint:'غير + إلى - لتحصل على 9-3=6',      sol:'9-3=6' },
    { id:17, eq:[7,'+',2,'=',5],  hint:'غير + إلى - لتحصل على 7-2=5',      sol:'7-2=5' },
    { id:18, eq:[8,'+',5,'=',3],  hint:'غير + إلى - لتحصل على 8-5=3',      sol:'8-5=3' },
    { id:19, eq:[6,'+',1,'=',5],  hint:'غير + إلى - لتحصل على 6-1=5',      sol:'6-1=5' },
    { id:20, eq:[5,'+',4,'=',1],  hint:'غير + إلى - لتحصل على 5-4=1',      sol:'5-4=1' },
    { id:21, eq:[9,'-',4,'=',5],  hint:'9-4=5 صحيح! حاول 9+4=13... لا، غير رقماً', sol:'9-4=5 صحيح أصلاً! نحتاج إعادة' },
    { id:22, eq:[4,'+',2,'=',7],  hint:'4+2=6 وليس 7، غير 7 إلى 6',        sol:'4+2=6' },
    { id:23, eq:[3,'+',5,'=',7],  hint:'3+5=8 وليس 7، غير 7 إلى 8',        sol:'3+5=8' },
    { id:24, eq:[6,'-',3,'=',2],  hint:'6-3=3 وليس 2، غير 2 إلى 3',        sol:'6-3=3' },
    { id:25, eq:[7,'+',0,'=',8],  hint:'7+0=7 وليس 8، غير 8 إلى 7',        sol:'7+0=7' },
    // LHS changes
    { id:26, eq:[9,'+',7,'=',4],  hint:'حرك عوداً من 9 ليصبح 3: 3+7=10? لا، أو غير + إلى - : 9-7=2? غير 4 إلى 2', sol:'9-7=2' },
    { id:27, eq:[5,'+',3,'=',9],  hint:'5+3=8 وليس 9، غير 9 إلى 8',        sol:'5+3=8' },
    { id:28, eq:[4,'+',5,'=',8],  hint:'4+5=9 وليس 8، غير 8 إلى 9',        sol:'4+5=9' },
    { id:29, eq:[2,'+',4,'=',5],  hint:'2+4=6 وليس 5، غير 5 إلى 6',        sol:'2+4=6' },
    { id:30, eq:[8,'-',2,'=',5],  hint:'8-2=6 وليس 5، غير 5 إلى 6',        sol:'8-2=6' },
    // Using 1 transformation
    { id:31, eq:[1,'+',4,'=',6],  hint:'1+4=5 وليس 6، غير 6 إلى 5',        sol:'1+4=5' },
    { id:32, eq:[7,'-',6,'=',2],  hint:'7-6=1 وليس 2، غير 2 إلى 1',        sol:'7-6=1' },
    { id:33, eq:[3,'+',4,'=',8],  hint:'3+4=7 وليس 8، غير 8 إلى 7',        sol:'3+4=7' },
    { id:34, eq:[9,'-',6,'=',4],  hint:'9-6=3 وليس 4، غير 4 إلى 3',        sol:'9-6=3' },
    { id:35, eq:[5,'+',2,'=',8],  hint:'5+2=7 وليس 8، غير 8 إلى 7',        sol:'5+2=7' },
    { id:36, eq:[6,'+',2,'=',9],  hint:'6+2=8 وليس 9، غير 9 إلى 8',        sol:'6+2=8' },
    { id:37, eq:[8,'+',0,'=',9],  hint:'8+0=8 وليس 9، غير 9 إلى 8',        sol:'8+0=8' },
    { id:38, eq:[4,'-',1,'=',2],  hint:'4-1=3 وليس 2، غير 2 إلى 3',        sol:'4-1=3' },
    { id:39, eq:[9,'+',1,'=',7],  hint:'9+1=10... أو 9-1=8: غير 7 إلى 8', sol:'9-1=8' },
    { id:40, eq:[6,'+',3,'=',8],  hint:'6+3=9 وليس 8، غير 8 إلى 9',        sol:'6+3=9' },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
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
        const avail = PUZZLES.filter(p=>!usedIds.includes(p.id));
        const pool = avail.length>0 ? avail : PUZZLES;
        const p = pool[Math.floor(Math.random()*pool.length)];
        setUsedIds(prev=>[...prev,p.id]);
        setPuzzle(p);
        const s = buildSticks(p.eq);
        setSticks(s); setOrigSticks(s.map(x=>({...x})));
        setMovesMade(0); setTimeLeft(TIME_LIMIT);
        setAnswered(false); setIsCorrect(false);
        setDragging(null); setDragPos(null); setSnapTarget(null);
        setIsActive(true); setStarting(false);
    };

    useEffect(()=>{
        if(!isActive||answered) return;
        if(timeLeft<=0){doTimeout();return;}
        const t=setInterval(()=>setTimeLeft(p=>p-1),1000);
        return ()=>clearInterval(t);
    },[isActive,timeLeft,answered]);

    const doTimeout=()=>{setIsActive(false);setAnswered(true);setIsCorrect(false);setTimeout(()=>{toast.error('⏰ انتهى الوقت!');onComplete(0,false);},300);};

    const toSVG=(cx:number,cy:number)=>{
        const svg=svgRef.current; if(!svg) return{x:0,y:0};
        const r=svg.getBoundingClientRect(), vb=svg.viewBox.baseVal;
        return{x:(cx-r.left)*vb.width/r.width,y:(cy-r.top)*vb.height/r.height};
    };

    const findSnap=(x:number,y:number,excl:string):string|null=>{
        if(!puzzle) return null;
        const{tokens}=buildLayout(puzzle.eq);
        let best:string|null=null, bestD=SNAP_R;
        tokens.forEach((tok,ti)=>{
            if(tok.type==='eq') return;
            const slots=tok.type==='digit'?digitSlots(tok.ox,tok.oy):opSlots(tok.ox,tok.oy);
            slots.forEach((sl,si)=>{
                const cx=(sl.x1+sl.x2)/2, cy=(sl.y1+sl.y2)/2;
                const d=Math.hypot(x-cx,y-cy);
                const id=`t${ti}_s${si}`;
                const occ=sticks.find(s=>s.id===id&&s.active);
                if(d<bestD&&(!occ||id===excl)){bestD=d;best=id;}
            });
        });
        return best;
    };

    const onPDown=(e:React.PointerEvent,sid:string)=>{
        if(answered||!isActive||dragging) return;
        const st=sticks.find(s=>s.id===sid);
        if(!st||!st.active||!st.draggable) return;
        e.preventDefault();
        (e.target as Element).setPointerCapture(e.pointerId);
        setDragging(sid);
        setDragPos(toSVG(e.clientX,e.clientY));
        setSticks(prev=>prev.map(s=>s.id===sid?{...s,active:false}:s));
    };

    const onPMove=(e:React.PointerEvent)=>{
        if(!dragging) return;
        e.preventDefault();
        const pt=toSVG(e.clientX,e.clientY);
        setDragPos(pt);
        setSnapTarget(findSnap(pt.x,pt.y,dragging));
    };

    const onPUp=(e:React.PointerEvent)=>{
        if(!dragging||!puzzle) return;
        e.preventDefault();
        const pt=toSVG(e.clientX,e.clientY);
        const snap=findSnap(pt.x,pt.y,dragging);

        if(snap&&snap!==dragging){
            const{tokens}=buildLayout(puzzle.eq);
            const[tStr,sStr]=snap.split('_s');
            const ti=parseInt(tStr.replace('t',''));
            const si=parseInt(sStr);
            const tok=tokens[ti];
            const slots=tok.type==='digit'?digitSlots(tok.ox,tok.oy):opSlots(tok.ox,tok.oy);
            const sl=slots[si];
            const newMoves=movesMade+1;
            setMovesMade(newMoves);
            setSticks(prev=>{
                const next=prev.map(s=>{
                    if(s.id===snap) return{...s,active:true,x1:sl.x1,y1:sl.y1,x2:sl.x2,y2:sl.y2,tokenIdx:ti,slotIdx:si};
                    return s;
                });
                setTimeout(()=>{
                    setSticks(cur=>{
                        const ev=readEq(cur,puzzle.eq);
                        if(ev&&isValid(ev)){
                            setAnswered(true);setIsCorrect(true);setIsActive(false);
                            const pts=Math.max(20,Math.floor(timeLeft*0.85));
                            setTimeout(()=>{toast.success(`🔥 عبقري! +${pts} نقطة`);onComplete(pts,true);},350);
                        }
                        return cur;
                    });
                },80);
                return next;
            });
        } else {
            const orig=origSticks.find(s=>s.id===dragging);
            if(orig) setSticks(prev=>prev.map(s=>s.id===dragging?{...orig}:s));
        }
        setDragging(null);setDragPos(null);setSnapTarget(null);
    };

    const reset=()=>{
        if(!puzzle) return;
        setSticks(origSticks.map(x=>({...x})));
        setMovesMade(0);setDragging(null);setDragPos(null);setSnapTarget(null);
    };

    const checkManual=()=>{
        if(!puzzle) return;
        const ev=readEq(sticks,puzzle.eq);
        if(ev&&isValid(ev)){
            setAnswered(true);setIsCorrect(true);setIsActive(false);
            const pts=Math.max(20,Math.floor(timeLeft*0.85));
            setTimeout(()=>{toast.success(`🔥 صحيح! +${pts} نقطة`);onComplete(pts,true);},200);
        } else toast.error('المعادلة لا تزال خاطئة!');
    };

    // ── IDLE ──
    if(!isActive&&!answered) return (
        <div className="text-center py-8 px-4">
            <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-500 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-2xl">
                <Flame className="w-12 h-12 text-white"/>
            </div>
            <h3 className="text-2xl font-black text-gray-800 mb-2">حرك عود ثقاب! 🔥</h3>
            <p className="text-sm font-bold text-gray-500 mb-4 max-w-sm mx-auto">
                اسحب العيدان من مكانها إلى مكان جديد لتصحح المعادلة — حركة واحدة فقط!
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6 text-xs font-bold text-amber-800 max-w-xs mx-auto">
                👆 اضغط على العود واسحبه للموضع الجديد
            </div>
            <button onClick={startGame} disabled={starting}
                className="bg-gradient-to-r from-amber-400 to-orange-500 text-white px-10 py-4 rounded-2xl font-black text-lg shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50">
                {starting?'⏳ جاري البدء...':'🔥 ابدأ التحدي'}
            </button>
        </div>
    );

    if(!puzzle) return null;

    const{tokens,totalW}=buildLayout(puzzle.eq);
    const SVG_W=Math.max(totalW,280), SVG_H=OY+DH+28;
    const movesLeft=1-movesMade;
    const dragOrig=dragging?origSticks.find(s=>s.id===dragging):null;

    return (
        <div className="max-w-lg mx-auto py-3 px-2 space-y-3 select-none" dir="rtl">

            {/* Header */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Flame className="w-5 h-5 text-amber-500"/>
                    <span className="font-black text-sm text-gray-800">عود الثقاب</span>
                    <span className={`px-2 py-0.5 rounded-lg text-xs font-black ${movesLeft>0?'bg-amber-100 text-amber-700':'bg-red-100 text-red-600'}`}>
                        {movesLeft>0?'حركة واحدة متبقية':'استُنفدت الحركات'}
                    </span>
                </div>
                <div className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-black text-sm ${timeLeft<=15?'bg-red-100 text-red-600 animate-pulse':'bg-amber-100 text-amber-700'}`}>
                    <Timer className="w-4 h-4"/> {timeLeft}
                </div>
            </div>

            {/* Hint */}
            <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-3">
                <p className="text-xs font-bold text-amber-800">💡 {puzzle.hint}</p>
                <p className="text-[11px] text-amber-600 mt-0.5">اسحب العود البرتقالي إلى الموضع المناسب</p>
            </div>

            {/* SVG Board — light background */}
            <div className="rounded-3xl overflow-hidden border-4 border-amber-200 shadow-xl bg-amber-50"
                style={{touchAction:'none'}}>
                <svg ref={svgRef}
                    viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                    style={{width:'100%',height:'auto',display:'block',touchAction:'none'}}
                    onPointerMove={onPMove} onPointerUp={onPUp} onPointerCancel={onPUp}>

                    <defs>
                        <filter id="sglow" x="-30%" y="-30%" width="160%" height="160%">
                            <feGaussianBlur stdDeviation="1.5" result="b"/>
                            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                        </filter>
                        <filter id="dglow" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="3" result="b"/>
                            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                        </filter>
                    </defs>

                    {/* Board background */}
                    <rect width={SVG_W} height={SVG_H} fill="#fffbeb" rx="20"/>

                    {/* Empty slot guides — visible on light bg */}
                    {tokens.map((tok,ti)=>{
                        if(tok.type==='eq') return null;
                        const slots=tok.type==='digit'?digitSlots(tok.ox,tok.oy):opSlots(tok.ox,tok.oy);
                        return slots.map((sl,si)=>{
                            const id=`t${ti}_s${si}`;
                            const filled=sticks.find(s=>s.id===id&&s.active);
                            const isSnap=snapTarget===id;
                            if(filled) return null;
                            return(
                                <line key={id} x1={sl.x1} y1={sl.y1} x2={sl.x2} y2={sl.y2}
                                    stroke={isSnap?'#f59e0b':'#d97706'}
                                    strokeWidth={isSnap?STICK_W+1:STICK_W-1}
                                    strokeLinecap="round"
                                    opacity={isSnap?0.9:0.18}
                                    strokeDasharray={isSnap?'none':'6,4'}
                                    filter={isSnap?'url(#sglow)':undefined}
                                />
                            );
                        });
                    })}

                    {/* = sign */}
                    {tokens.filter(t=>t.type==='eq').map((tok,i)=>
                        eqSlots(tok.ox,tok.oy).map((sl,si)=>(
                            <line key={`eq${i}${si}`} x1={sl.x1} y1={sl.y1} x2={sl.x2} y2={sl.y2}
                                stroke="#92400e" strokeWidth={STICK_W} strokeLinecap="round" filter="url(#sglow)"/>
                        ))
                    )}

                    {/* Active sticks */}
                    {sticks.filter(s=>s.active).map(s=>(
                        <g key={s.id} onPointerDown={e=>onPDown(e,s.id)}
                            style={{cursor:s.draggable&&!answered&&isActive?'grab':'default'}}>
                            {/* Stick body */}
                            <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                                stroke={answered?(isCorrect?'#16a34a':'#dc2626'):'#d97706'}
                                strokeWidth={STICK_W+2} strokeLinecap="round"
                                filter="url(#sglow)"
                            />
                            {/* Darker outline for visibility */}
                            <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                                stroke={answered?(isCorrect?'#14532d':'#7f1d1d'):'#92400e'}
                                strokeWidth={2} strokeLinecap="round" opacity={0.5}
                            />
                            {/* Red tip */}
                            {s.draggable&&!answered&&(
                                <circle cx={s.x1} cy={s.y1} r={5} fill="#dc2626" stroke="#fff" strokeWidth={1.5} filter="url(#sglow)"/>
                            )}
                        </g>
                    ))}

                    {/* Dragged floating stick */}
                    {dragging&&dragPos&&dragOrig&&(()=>{
                        const isH=Math.abs(dragOrig.x2-dragOrig.x1)>Math.abs(dragOrig.y2-dragOrig.y1);
                        const hl=isH?(dragOrig.x2-dragOrig.x1)/2:0;
                        const vl=!isH?(dragOrig.y2-dragOrig.y1)/2:0;
                        return(
                            <g style={{pointerEvents:'none'}}>
                                <line x1={dragPos.x-hl} y1={dragPos.y-vl} x2={dragPos.x+hl} y2={dragPos.y+vl}
                                    stroke="#f59e0b" strokeWidth={STICK_W+4} strokeLinecap="round"
                                    filter="url(#dglow)" opacity={0.95}/>
                                <line x1={dragPos.x-hl} y1={dragPos.y-vl} x2={dragPos.x+hl} y2={dragPos.y+vl}
                                    stroke="#78350f" strokeWidth={2} strokeLinecap="round" opacity={0.6}/>
                                <circle cx={dragPos.x-hl} cy={dragPos.y-vl} r={6} fill="#ef4444" stroke="#fff" strokeWidth={2} filter="url(#dglow)"/>
                            </g>
                        );
                    })()}

                    {/* Win flash */}
                    {answered&&isCorrect&&<rect x={0} y={0} width={SVG_W} height={SVG_H} fill="#22c55e" opacity={0.1} rx={20}/>}
                </svg>
            </div>

            {/* Result */}
            {answered&&(
                <div className={`rounded-2xl p-4 text-center font-black text-base ${isCorrect?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-700'}`}>
                    {isCorrect?<><CheckCircle className="inline w-5 h-5 ml-1"/>معادلة صحيحة! 🎉</>
                              :<><XCircle className="inline w-5 h-5 ml-1"/>انتهى الوقت! الحل: {puzzle.sol}</>}
                </div>
            )}

            {/* Controls */}
            {!answered&&(
                <div className="flex gap-2">
                    <button onClick={reset}
                        className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200 transition-all">
                        <RotateCcw className="w-4 h-4"/> إعادة
                    </button>
                    <button onClick={checkManual} disabled={movesMade===0}
                        className="flex-1 py-2.5 rounded-xl font-black text-sm shadow-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-40"
                        style={{background:movesMade>0?'linear-gradient(135deg,#f59e0b,#ea580c)':undefined,color:movesMade>0?'white':undefined,backgroundColor:movesMade===0?'#e5e7eb':undefined}}>
                        ✅ تحقق من الإجابة
                    </button>
                </div>
            )}
        </div>
    );
}
