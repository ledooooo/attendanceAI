import React, { useState, useRef, useEffect } from 'react';
import { Flame, Timer, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
    onStart: () => Promise<void>;
    onComplete: (points: number, isWin: boolean) => void;
}

// ─── Layout constants — bigger digits ─────────────────────────────────────────
const DW = 72, DH = 118, OY = 10, OP_W = 40;
const SNAP_R    = 26;
const TIME_LIMIT = 60;
const SW         = 10;           // stick stroke width

// Colours — very dark on warm-cream background
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
        { x1:ox+p,        y1:oy+p*0.5,      x2:ox+DW-p,      y2:oy+p*0.5      }, // 0 top
        { x1:ox+p*0.5,    y1:oy+p,          x2:ox+p*0.5,     y2:oy+hh-p       }, // 1 top-left
        { x1:ox+DW-p*0.5, y1:oy+p,          x2:ox+DW-p*0.5,  y2:oy+hh-p       }, // 2 top-right
        { x1:ox+p,        y1:oy+hh,         x2:ox+DW-p,      y2:oy+hh         }, // 3 middle
        { x1:ox+p*0.5,    y1:oy+hh+p,       x2:ox+p*0.5,     y2:oy+DH-p       }, // 4 bot-left
        { x1:ox+DW-p*0.5, y1:oy+hh+p,       x2:ox+DW-p*0.5,  y2:oy+DH-p       }, // 5 bot-right
        { x1:ox+p,        y1:oy+DH-p*0.5,   x2:ox+DW-p,      y2:oy+DH-p*0.5   }, // 6 bottom
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
        { x1:cx-15, y1:cy,    x2:cx+15, y2:cy    }, // horizontal (both + and -)
        { x1:cx,    y1:cy-15, x2:cx,    y2:cy+15 }, // vertical (only +)
    ];
}

function eqSlots(ox: number, oy: number) {
    const cx = ox + OP_W / 2, cy = oy + DH / 2;
    return [
        { x1:cx-14, y1:cy-10, x2:cx+14, y2:cy-10 },
        { x1:cx-14, y1:cy+10, x2:cx+14, y2:cy+10 },
    ];
}

// ─── Layout ───────────────────────────────────────────────────────────────────
interface Token { type:'digit'|'op'|'eq'; value:number|string; ox:number; oy:number }
function buildLayout(eq:(number|string)[]): { tokens:Token[]; totalW:number } {
    let x = 10;
    const tokens:Token[] = [];
    eq.forEach(tok => {
        if (typeof tok==='number') { tokens.push({type:'digit',value:tok,ox:x,oy:OY}); x+=DW+14; }
        else if (tok==='=')        { tokens.push({type:'eq',value:'=',ox:x,oy:OY});    x+=OP_W+14; }
        else                       { tokens.push({type:'op',value:tok,ox:x,oy:OY});    x+=OP_W+14; }
    });
    return { tokens, totalW: x+8 };
}

// ─── Stick ────────────────────────────────────────────────────────────────────
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

// ─── 10 exact puzzles from user ───────────────────────────────────────────────
// eq  = wrong equation shown on board
// sol = correct equation string shown on failure
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
];

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MoveTheMatch({ onStart, onComplete }: Props) {
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
    const svgRef = useRef<SVGSVGElement>(null);

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
        setTimeout(() => { toast.error('⏰ انتهى الوقت!'); onComplete(0, false); }, 300);
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
                // auto-check after state settles
                setTimeout(() => {
                    setSticks(cur => {
                        const ev = readEq(cur, puzzle.eq);
                        if (ev && isValid(ev)) {
                            setAnswered(true); setIsCorrect(true); setIsActive(false);
                            const pts = Math.max(20, Math.floor(timeLeft * 0.85));
                            setTimeout(() => { toast.success(`🔥 عبقري! +${pts} نقطة`); onComplete(pts, true); }, 300);
                        }
                        return cur;
                    });
                }, 60);
                return next;
            });
        } else {
            // Return stick home
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

    // ── IDLE ──────────────────────────────────────────────────────────────────
    if (!isActive && !answered) return (
        <div className="text-center py-6 px-3">
            <div className="w-18 h-18 bg-gradient-to-br from-amber-500 to-orange-700 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xl" style={{width:72,height:72}}>
                <Flame className="w-10 h-10 text-white"/>
            </div>
            <h3 className="text-xl font-black text-gray-800 mb-1">حرك عود ثقاب! 🔥</h3>
            <p className="text-sm font-bold text-gray-500 mb-4 max-w-xs mx-auto leading-relaxed">
                حرك عود ثقاب من مكانه إلى مكان آخر لكي تصبح المعادلة صحيحة
            </p>
            <button onClick={startGame} disabled={starting}
                className="bg-gradient-to-r from-amber-500 to-orange-700 text-white px-10 py-3.5 rounded-2xl font-black text-lg shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50">
                {starting ? '⏳ جاري البدء...' : '🔥 ابدأ التحدي'}
            </button>
        </div>
    );

    if (!puzzle) return null;

    const { tokens, totalW } = buildLayout(puzzle.eq);
    const SVG_W = Math.max(totalW, 300);
    const SVG_H = OY + DH + 16;
    const dragOrig = dragging ? origSticks.find(s=>s.id===dragging) : null;

    return (
        <div className="max-w-lg mx-auto py-1 px-1 space-y-2 select-none" dir="rtl">

            {/* Header — compact */}
            <div className="flex justify-between items-center px-1">
                <div className="flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-orange-700"/>
                    <span className="font-black text-xs text-gray-700">حرك عود ثقاب واحد فقط</span>
                </div>
                <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-black text-sm border ${timeLeft<=15 ? 'bg-red-100 text-red-800 border-red-400 animate-pulse' : 'bg-amber-100 text-amber-900 border-amber-400'}`}>
                    <Timer className="w-3.5 h-3.5"/> {timeLeft}
                </div>
            </div>

            {/* SVG Board — maximized */}
            <div className="rounded-2xl overflow-hidden shadow-2xl border-4 border-amber-500 w-full"
                style={{ touchAction:'none', backgroundColor:'#fef3c7' }}>
                <svg ref={svgRef}
                    viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                    style={{ width:'100%', height:'auto', display:'block', touchAction:'none' }}
                    onPointerMove={onPMove} onPointerUp={onPUp} onPointerCancel={onPUp}>

                    <defs>
                        <filter id="sf" x="-15%" y="-15%" width="130%" height="130%">
                            <feGaussianBlur stdDeviation="0.6" result="b"/>
                            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                        </filter>
                        <filter id="df" x="-40%" y="-40%" width="180%" height="180%">
                            <feGaussianBlur stdDeviation="3" result="b"/>
                            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                        </filter>
                    </defs>

                    {/* Board */}
                    <rect width={SVG_W} height={SVG_H} fill="#fef3c7" rx="16"/>
                    {[0,1,2,3,4,5,6,7,8].map(i=>(
                        <line key={i} x1={0} y1={i*20+8} x2={SVG_W} y2={i*20+8}
                            stroke="#fde68a" strokeWidth={1.5} opacity={0.5}/>
                    ))}

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
                                <line x1={sl.x1} y1={sl.y1} x2={sl.x2} y2={sl.y2}
                                    stroke={STICK_EDGE} strokeWidth={1.5} strokeLinecap="round" opacity={0.5}/>
                            </g>
                        ))
                    )}

                    {/* Active sticks */}
                    {sticks.filter(s=>s.active).map(s => (
                        <g key={s.id}
                            onPointerDown={e=>onPDown(e, s.id)}
                            style={{ cursor:s.draggable&&!answered&&isActive?'grab':'default' }}>
                            {/* shadow */}
                            <line x1={s.x1+2.5} y1={s.y1+2.5} x2={s.x2+2.5} y2={s.y2+2.5}
                                stroke="#292524" strokeWidth={SW+4} strokeLinecap="round" opacity={0.18}/>
                            {/* body */}
                            <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                                stroke={answered ? (isCorrect?'#15803d':'#dc2626') : STICK_BODY}
                                strokeWidth={SW+2} strokeLinecap="round"/>
                            {/* highlight */}
                            <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                                stroke={answered ? (isCorrect?'#4ade80':'#fca5a5') : STICK_HI}
                                strokeWidth={3.5} strokeLinecap="round" opacity={0.5}/>
                            {/* edge */}
                            <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                                stroke={STICK_EDGE} strokeWidth={1.5} strokeLinecap="round" opacity={0.55}/>
                            {/* tip */}
                            {s.draggable && !answered && (
                                <>
                                    <circle cx={s.x1} cy={s.y1} r={8} fill="#7f1d1d" opacity={0.25}/>
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
                                <line x1={x1+2.5} y1={y1+2.5} x2={x2+2.5} y2={y2+2.5}
                                    stroke="#292524" strokeWidth={SW+6} strokeLinecap="round" opacity={0.18}/>
                                <line x1={x1} y1={y1} x2={x2} y2={y2}
                                    stroke={STICK_DRAG} strokeWidth={SW+4} strokeLinecap="round" filter="url(#df)"/>
                                <line x1={x1} y1={y1} x2={x2} y2={y2}
                                    stroke="#fbbf24" strokeWidth={4} strokeLinecap="round" opacity={0.55}/>
                                <line x1={x1} y1={y1} x2={x2} y2={y2}
                                    stroke={STICK_EDGE} strokeWidth={2} strokeLinecap="round" opacity={0.65}/>
                                <circle cx={x1} cy={y1} r={9} fill="#7f1d1d" opacity={0.22}/>
                                <circle cx={x1} cy={y1} r={7} fill={TIP_COL} filter="url(#df)"/>
                                <circle cx={x1} cy={y1} r={3.5} fill={TIP_IN}/>
                            </g>
                        );
                    })()}

                    {answered && isCorrect && (
                        <rect x={0} y={0} width={SVG_W} height={SVG_H} fill="#22c55e" opacity={0.07} rx={16}/>
                    )}
                </svg>
            </div>

            {/* Result */}
            {answered && (
                <div className={`rounded-xl p-3 text-center font-black text-sm border-2 ${isCorrect ? 'bg-emerald-50 text-emerald-900 border-emerald-400' : 'bg-red-50 text-red-800 border-red-400'}`}>
                    {isCorrect
                        ? <><CheckCircle className="inline w-4 h-4 ml-1"/>معادلة صحيحة! 🎉</>
                        : <><XCircle className="inline w-4 h-4 ml-1"/>الإجابة الصحيحة: <span className="font-mono bg-white px-1.5 py-0.5 rounded border mx-1">{puzzle.sol}</span></>}
                </div>
            )}

            {/* Reset only */}
            {!answered && (
                <button onClick={reset}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-white text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-100 active:scale-95 transition-all border-2 border-gray-200">
                    <RotateCcw className="w-4 h-4"/> إعادة الوضع الأصلي
                </button>
            )}
        </div>
    );
}
