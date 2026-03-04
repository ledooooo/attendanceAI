import React, { useState, useRef, useEffect } from 'react';
import { Flame, Timer, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
    onStart: () => Promise<void>;
    onComplete: (points: number, isWin: boolean) => void;
}

// ── Constants ──────────────────────────────────────────────────────────────────
const DW = 56;    // digit width
const DH = 90;    // digit height
const OY = 25;    // origin Y for equation
const OP_W = 30;  // operator width
const STICK_W = 6;
const SNAP_R = 22; // snap radius in SVG units
const TIME_LIMIT = 60;

// ── Digit segment definitions (7-segment) ─────────────────────────────────────
// For a digit at top-left (ox, oy):
function makeDigitSlots(ox: number, oy: number) {
    const r = DW * 0.12; // inset
    const hh = DH / 2;
    return [
        // seg 0: top
        { x1: ox + r*1.2, y1: oy + r*0.6,    x2: ox + DW - r*1.2, y2: oy + r*0.6    },
        // seg 1: top-left
        { x1: ox + r*0.6, y1: oy + r*1.2,    x2: ox + r*0.6,       y2: oy + hh - r*0.6 },
        // seg 2: top-right
        { x1: ox + DW - r*0.6, y1: oy + r*1.2, x2: ox + DW - r*0.6, y2: oy + hh - r*0.6 },
        // seg 3: middle
        { x1: ox + r*1.2, y1: oy + hh,       x2: ox + DW - r*1.2, y2: oy + hh       },
        // seg 4: bot-left
        { x1: ox + r*0.6, y1: oy + hh + r*0.6, x2: ox + r*0.6,     y2: oy + DH - r*1.2 },
        // seg 5: bot-right
        { x1: ox + DW - r*0.6, y1: oy + hh + r*0.6, x2: ox + DW - r*0.6, y2: oy + DH - r*1.2 },
        // seg 6: bottom
        { x1: ox + r*1.2, y1: oy + DH - r*0.6, x2: ox + DW - r*1.2, y2: oy + DH - r*0.6 },
    ];
}

const DIGIT_ON: Record<number, number[]> = {
    0:[0,1,2,4,5,6], 1:[2,5], 2:[0,2,3,4,6], 3:[0,2,3,5,6],
    4:[1,2,3,5], 5:[0,1,3,5,6], 6:[0,1,3,4,5,6], 7:[0,2,5],
    8:[0,1,2,3,4,5,6], 9:[0,1,2,3,5,6],
};

// ── Operator slot (+ has h+v, - has h only) ───────────────────────────────────
function makeOpSlots(ox: number, oy: number) {
    const cx = ox + OP_W / 2;
    const cy = oy + DH / 2;
    return [
        { x1: cx - 12, y1: cy, x2: cx + 12, y2: cy },       // horizontal (both + and -)
        { x1: cx, y1: cy - 12, x2: cx, y2: cy + 12 },        // vertical (only +)
    ];
}

// = sign slots (two fixed horizontals — NOT draggable)
function makeEqSlots(ox: number, oy: number) {
    const cx = ox + OP_W / 2;
    const cy = oy + DH / 2;
    return [
        { x1: cx - 12, y1: cy - 7, x2: cx + 12, y2: cy - 7 },
        { x1: cx - 12, y1: cy + 7, x2: cx + 12, y2: cy + 7 },
    ];
}

// ── Layout builder ─────────────────────────────────────────────────────────────
interface Token { type: 'digit' | 'op' | 'eq'; value: number | string; ox: number; oy: number }
function buildLayout(eq: (number | string)[]): { tokens: Token[]; totalW: number } {
    let x = 16;
    const tokens: Token[] = [];
    eq.forEach(tok => {
        if (typeof tok === 'number') {
            tokens.push({ type: 'digit', value: tok, ox: x, oy: OY });
            x += DW + 14;
        } else if (tok === '=') {
            tokens.push({ type: 'eq', value: '=', ox: x, oy: OY });
            x += OP_W + 14;
        } else {
            tokens.push({ type: 'op', value: tok, ox: x, oy: OY });
            x += OP_W + 14;
        }
    });
    return { tokens, totalW: x + 10 };
}

// ── Stick type ─────────────────────────────────────────────────────────────────
interface Stick {
    id: string;
    tokenIdx: number;
    slotIdx: number;
    active: boolean;
    draggable: boolean;  // false for = sticks
    x1: number; y1: number; x2: number; y2: number;
}

function buildSticks(eq: (number | string)[]): Stick[] {
    const { tokens } = buildLayout(eq);
    const sticks: Stick[] = [];
    tokens.forEach((tok, ti) => {
        if (tok.type === 'digit') {
            const slots = makeDigitSlots(tok.ox, tok.oy);
            const on = DIGIT_ON[tok.value as number] ?? [];
            slots.forEach((sl, si) => {
                sticks.push({ id:`t${ti}_s${si}`, tokenIdx:ti, slotIdx:si, active:on.includes(si), draggable:true, ...sl });
            });
        } else if (tok.type === 'op') {
            const slots = makeOpSlots(tok.ox, tok.oy);
            const isPlus = tok.value === '+';
            slots.forEach((sl, si) => {
                sticks.push({ id:`t${ti}_s${si}`, tokenIdx:ti, slotIdx:si, active: si===0||(isPlus&&si===1), draggable:true, ...sl });
            });
        } else {
            const slots = makeEqSlots(tok.ox, tok.oy);
            slots.forEach((sl, si) => {
                sticks.push({ id:`t${ti}_s${si}`, tokenIdx:ti, slotIdx:si, active:true, draggable:false, ...sl });
            });
        }
    });
    return sticks;
}

// ── Evaluate equation from sticks ─────────────────────────────────────────────
function readEquation(sticks: Stick[], eq: (number | string)[]): (number | string)[] | null {
    const { tokens } = buildLayout(eq);
    const result: (number | string)[] = [];
    for (let ti = 0; ti < tokens.length; ti++) {
        const tok = tokens[ti];
        const tSticks = sticks.filter(s => s.tokenIdx === ti && s.active);
        if (tok.type === 'eq') { result.push('='); continue; }
        if (tok.type === 'op') {
            const h = tSticks.some(s => s.slotIdx === 0);
            const v = tSticks.some(s => s.slotIdx === 1);
            if (h && v) result.push('+');
            else if (h && !v) result.push('-');
            else return null;
            continue;
        }
        // digit
        const activeSegs = tSticks.map(s => s.slotIdx).sort();
        let found = -1;
        for (let d = 0; d <= 9; d++) {
            const segs = [...DIGIT_ON[d]].sort();
            if (segs.length === activeSegs.length && segs.every((v,i)=>v===activeSegs[i])) { found=d; break; }
        }
        if (found === -1) return null;
        result.push(found);
    }
    return result;
}

function isValid(eq: (number | string)[]): boolean {
    const ei = eq.indexOf('=');
    if (ei < 0) return false;
    const eval1 = (side: (number|string)[]): number|null => {
        let v = typeof side[0]==='number' ? side[0] : null;
        if (v===null) return null;
        for (let i=1;i<side.length;i+=2) {
            const op=side[i], n=side[i+1];
            if (typeof n!=='number') return null;
            if(op==='+') v+=n; else if(op==='-') v-=n; else return null;
        }
        return v;
    };
    const lv = eval1(eq.slice(0,ei));
    const rv = eval1(eq.slice(ei+1));
    return lv!==null && rv!==null && lv===rv && rv>=0;
}

// ── Puzzles ────────────────────────────────────────────────────────────────────
const PUZZLES = [
    { id:1,  eq:[9,'+',7,'=',4],  moves:1, hint:'حرك عوداً واحداً من الأرقام أو العملية' },
    { id:2,  eq:[6,'+',4,'=',4],  moves:1, hint:'غير + إلى - أو عدل الناتج' },
    { id:3,  eq:[5,'+',5,'=',8],  moves:1, hint:'الناتج 8 يحتاج تعديل بعود واحد' },
    { id:4,  eq:[8,'-',3,'=',6],  moves:1, hint:'الناتج 6 يصبح 5 بعود واحد' },
    { id:5,  eq:[3,'+',3,'=',9],  moves:1, hint:'9 يصبح 6 بإزالة عود' },
    { id:6,  eq:[1,'+',1,'=',3],  moves:1, hint:'3 يصبح 2' },
    { id:7,  eq:[7,'+',1,'=',6],  moves:1, hint:'7 يصبح 1 أو الناتج 6 يصبح 8' },
    { id:8,  eq:[6,'-',1,'=',9],  moves:1, hint:'عدّل 9 أو 6' },
    { id:9,  eq:[2,'+',3,'=',8],  moves:2, hint:'حرك عودَين' },
    { id:10, eq:[4,'+',4,'=',0],  moves:2, hint:'0 يصبح 8 بإضافة عودَين' },
    { id:11, eq:[9,'-',5,'=',6],  moves:1, hint:'الناتج 6 يصبح 4' },
    { id:12, eq:[7,'-',2,'=',6],  moves:1, hint:'7-2=5 ليس 6' },
];

// ── Main Component ─────────────────────────────────────────────────────────────
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

    // Drag state
    const [dragging, setDragging] = useState<string|null>(null);
    const [dragPos, setDragPos] = useState<{x:number;y:number}|null>(null);
    const [snapTarget, setSnapTarget] = useState<string|null>(null);
    const svgRef = useRef<SVGSVGElement>(null);

    // ── Start ──
    const startGame = async () => {
        setStarting(true);
        try { await onStart(); } catch { setStarting(false); return; }
        const avail = PUZZLES.filter(p => !usedIds.includes(p.id));
        const pool = avail.length > 0 ? avail : PUZZLES;
        const p = pool[Math.floor(Math.random() * pool.length)];
        setUsedIds(prev => [...prev, p.id]);
        setPuzzle(p);
        const s = buildSticks(p.eq);
        setSticks(s);
        setOrigSticks(s.map(x=>({...x})));
        setMovesMade(0); setTimeLeft(TIME_LIMIT);
        setAnswered(false); setIsCorrect(false);
        setDragging(null); setDragPos(null); setSnapTarget(null);
        setIsActive(true); setStarting(false);
    };

    // ── Timer ──
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

    // ── SVG coordinate helper ──
    const toSVG = (clientX: number, clientY: number) => {
        const svg = svgRef.current;
        if (!svg) return {x:0,y:0};
        const r = svg.getBoundingClientRect();
        const vb = svg.viewBox.baseVal;
        return { x: (clientX - r.left) * vb.width / r.width, y: (clientY - r.top) * vb.height / r.height };
    };

    // ── Find nearest empty slot ──
    const findSnap = (x: number, y: number, excludeId: string): string|null => {
        if (!puzzle) return null;
        const { tokens } = buildLayout(puzzle.eq);
        let best: string|null = null, bestD = SNAP_R;
        tokens.forEach((tok, ti) => {
            if (tok.type === 'eq') return;
            const slots = tok.type==='digit' ? makeDigitSlots(tok.ox,tok.oy) : makeOpSlots(tok.ox,tok.oy);
            slots.forEach((sl, si) => {
                const cx = (sl.x1+sl.x2)/2, cy = (sl.y1+sl.y2)/2;
                const d = Math.hypot(x-cx, y-cy);
                const id = `t${ti}_s${si}`;
                const occupied = sticks.find(s=>s.id===id&&s.active);
                if (d < bestD && (!occupied || id===excludeId)) { bestD=d; best=id; }
            });
        });
        return best;
    };

    // ── Mouse/Touch handlers ──
    const onPointerDown = (e: React.PointerEvent, stickId: string) => {
        if (answered || !isActive || dragging) return;
        const stick = sticks.find(s=>s.id===stickId);
        if (!stick || !stick.active || !stick.draggable) return;
        e.preventDefault();
        (e.target as Element).setPointerCapture(e.pointerId);
        setDragging(stickId);
        const pt = toSVG(e.clientX, e.clientY);
        setDragPos(pt);
        // Remove from slot
        setSticks(prev => prev.map(s => s.id===stickId ? {...s, active:false} : s));
    };

    const onPointerMove = (e: React.PointerEvent) => {
        if (!dragging) return;
        e.preventDefault();
        const pt = toSVG(e.clientX, e.clientY);
        setDragPos(pt);
        setSnapTarget(findSnap(pt.x, pt.y, dragging));
    };

    const onPointerUp = (e: React.PointerEvent) => {
        if (!dragging || !puzzle) return;
        e.preventDefault();
        const pt = toSVG(e.clientX, e.clientY);
        const snap = findSnap(pt.x, pt.y, dragging);

        if (snap && snap !== dragging) {
            // Place in new slot
            const { tokens } = buildLayout(puzzle.eq);
            const [tStr, sStr] = snap.split('_s');
            const ti = parseInt(tStr.replace('t',''));
            const si = parseInt(sStr);
            const tok = tokens[ti];
            const slots = tok.type==='digit' ? makeDigitSlots(tok.ox,tok.oy) : makeOpSlots(tok.ox,tok.oy);
            const sl = slots[si];

            setSticks(prev => prev.map(s => {
                if (s.id === snap) return { ...s, active:true, x1:sl.x1, y1:sl.y1, x2:sl.x2, y2:sl.y2, tokenIdx:ti, slotIdx:si };
                return s;
            }));
            const newMoves = movesMade + 1;
            setMovesMade(newMoves);

            // Check answer after state update
            setTimeout(() => {
                setSticks(cur => {
                    const evaled = readEquation(cur, puzzle.eq);
                    if (evaled && isValid(evaled)) {
                        setAnswered(true); setIsCorrect(true); setIsActive(false);
                        const pts = Math.max(20, Math.floor(timeLeft * 0.85));
                        setTimeout(() => { toast.success(`🔥 عبقري! +${pts} نقطة`); onComplete(pts, true); }, 350);
                    }
                    return cur;
                });
            }, 80);
        } else {
            // Restore to original position
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

    const checkManual = () => {
        if (!puzzle) return;
        const evaled = readEquation(sticks, puzzle.eq);
        if (evaled && isValid(evaled)) {
            setAnswered(true); setIsCorrect(true); setIsActive(false);
            const pts = Math.max(20, Math.floor(timeLeft * 0.85));
            setTimeout(() => { toast.success(`🔥 صحيح! +${pts} نقطة`); onComplete(pts, true); }, 200);
        } else {
            toast.error('المعادلة لا تزال خاطئة!');
        }
    };

    // ── IDLE screen ──
    if (!isActive && !answered) return (
        <div className="text-center py-8 px-4 rounded-3xl"
            style={{ background: 'linear-gradient(145deg, #0c1e35, #0f2744)' }}>
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-2xl"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #dc2626)' }}>
                <Flame className="w-12 h-12 text-white"/>
            </div>
            <h3 className="text-2xl font-black mb-2" style={{ color: '#fde68a' }}>حرك عود ثقاب! 🔥</h3>
            <p className="text-sm font-bold mb-3 max-w-xs mx-auto" style={{ color: '#94a3b8' }}>
                اسحب العيدان الصفراء من مكانها وضعها في مكان جديد لتصحح المعادلة
            </p>
            <div className="rounded-2xl p-3 mb-6 inline-block text-xs font-bold"
                style={{ background: '#1a3a5c', color: '#7dd3fc', border: '1px solid #1e5080' }}>
                👆 اضغط واسحب أي عود أصفر
            </div>
            <br/>
            <button onClick={startGame} disabled={starting}
                className="px-10 py-4 rounded-2xl font-black text-lg shadow-2xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #dc2626)', color: 'white' }}>
                {starting ? '⏳ جاري البدء...' : '🔥 ابدأ التحدي'}
            </button>
        </div>
    );

    if (!puzzle) return null;

    const { tokens, totalW } = buildLayout(puzzle.eq);
    const SVG_W = Math.max(totalW, 300);
    const SVG_H = OY + DH + 30;
    const movesLeft = puzzle.moves - movesMade;

    // Dragging stick dimensions
    const dragOrig = dragging ? origSticks.find(s=>s.id===dragging) : null;

    return (
        <div className="max-w-lg mx-auto py-3 px-2 space-y-3 select-none" dir="rtl">

            {/* Header */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Flame className="w-5 h-5 text-amber-500"/>
                    <span className="font-black text-sm text-gray-800">عود الثقاب</span>
                    <span className={`px-2 py-0.5 rounded-lg text-xs font-black ${movesLeft>0?'bg-amber-100 text-amber-700':'bg-red-100 text-red-600'}`}>
                        {movesLeft} حركة
                    </span>
                </div>
                <div className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-black text-sm ${timeLeft<=15?'bg-red-100 text-red-600 animate-pulse':'bg-amber-100 text-amber-700'}`}>
                    <Timer className="w-4 h-4"/> {timeLeft}
                </div>
            </div>

            {/* Hint */}
            <div className="rounded-xl p-3" style={{ background:'#0f2744', border:'1px solid #1e4d7a' }}>
                <p className="text-xs font-bold" style={{ color:'#7dd3fc' }}>💡 {puzzle.hint}</p>
                <p className="text-[10px] mt-0.5" style={{ color:'#475569' }}>
                    اسحب العود الأصفر إلى الموضع الجديد • السلوت المميز بالأصفر = مكان الوضع
                </p>
            </div>

            {/* SVG Board */}
            <div className="rounded-3xl overflow-hidden shadow-2xl"
                style={{ background:'#0a1929', border:'3px solid #1e3a5c', touchAction:'none' }}>
                <svg
                    ref={svgRef}
                    viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                    style={{ width:'100%', height:'auto', display:'block', touchAction:'none' }}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                >
                    <defs>
                        <filter id="stick-glow">
                            <feGaussianBlur stdDeviation="2" result="blur"/>
                            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                        </filter>
                        <filter id="drag-glow">
                            <feGaussianBlur stdDeviation="4" result="blur"/>
                            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                        </filter>
                        <filter id="snap-glow">
                            <feGaussianBlur stdDeviation="3" result="blur"/>
                            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                        </filter>
                        <radialGradient id="bg-grad" cx="50%" cy="50%" r="70%">
                            <stop offset="0%" stopColor="#0f2744"/>
                            <stop offset="100%" stopColor="#080f1a"/>
                        </radialGradient>
                    </defs>

                    <rect width={SVG_W} height={SVG_H} fill="url(#bg-grad)"/>

                    {/* Empty slot guides */}
                    {tokens.map((tok, ti) => {
                        if (tok.type==='eq') return null;
                        const slots = tok.type==='digit' ? makeDigitSlots(tok.ox,tok.oy) : makeOpSlots(tok.ox,tok.oy);
                        return slots.map((sl, si) => {
                            const id = `t${ti}_s${si}`;
                            const filled = sticks.find(s=>s.id===id&&s.active);
                            const isSnap = snapTarget===id;
                            if (filled) return null;
                            return (
                                <line key={id}
                                    x1={sl.x1} y1={sl.y1} x2={sl.x2} y2={sl.y2}
                                    stroke={isSnap?'#fbbf24':'#1d4ed8'}
                                    strokeWidth={isSnap?7:3}
                                    strokeLinecap="round"
                                    opacity={isSnap?1:0.3}
                                    strokeDasharray={isSnap?'none':'5,4'}
                                    filter={isSnap?'url(#snap-glow)':undefined}
                                />
                            );
                        });
                    })}

                    {/* = sign (fixed) */}
                    {tokens.filter(t=>t.type==='eq').map((tok,i)=>
                        makeEqSlots(tok.ox,tok.oy).map((sl,si)=>(
                            <line key={`eq${i}${si}`} x1={sl.x1} y1={sl.y1} x2={sl.x2} y2={sl.y2}
                                stroke="#e2e8f0" strokeWidth={STICK_W} strokeLinecap="round"
                                filter="url(#stick-glow)"/>
                        ))
                    )}

                    {/* Active sticks */}
                    {sticks.filter(s=>s.active).map(s=>(
                        <g key={s.id}
                            onPointerDown={e=>onPointerDown(e,s.id)}
                            style={{ cursor: s.draggable&&!answered&&isActive?'grab':'default' }}>
                            <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                                stroke={answered?(isCorrect?'#34d399':'#f59e0b'):'#f5c842'}
                                strokeWidth={STICK_W+1} strokeLinecap="round"
                                filter="url(#stick-glow)"
                                style={{ transition: answered?'stroke 0.4s':undefined }}
                            />
                            {/* Red tip */}
                            {s.draggable && !answered && (
                                <circle cx={s.x1} cy={s.y1} r={4.5} fill="#ef4444" filter="url(#stick-glow)"/>
                            )}
                        </g>
                    ))}

                    {/* Floating (dragged) stick */}
                    {dragging && dragPos && dragOrig && (()=>{
                        const isH = Math.abs(dragOrig.x2-dragOrig.x1) > Math.abs(dragOrig.y2-dragOrig.y1);
                        const hl = isH ? (dragOrig.x2-dragOrig.x1)/2 : 0;
                        const vl = !isH ? (dragOrig.y2-dragOrig.y1)/2 : 0;
                        return (
                            <g style={{pointerEvents:'none'}}>
                                <line
                                    x1={dragPos.x-hl} y1={dragPos.y-vl}
                                    x2={dragPos.x+hl} y2={dragPos.y+vl}
                                    stroke="#fde68a" strokeWidth={STICK_W+3} strokeLinecap="round"
                                    filter="url(#drag-glow)" opacity={0.95}
                                />
                                <circle cx={dragPos.x-hl} cy={dragPos.y-vl} r={5.5} fill="#f87171" filter="url(#drag-glow)"/>
                            </g>
                        );
                    })()}

                    {/* Win overlay */}
                    {answered && isCorrect && (
                        <rect x={0} y={0} width={SVG_W} height={SVG_H} fill="#10b981" opacity={0.08} rx={20}/>
                    )}
                </svg>
            </div>

            {/* Result */}
            {answered && (
                <div className={`rounded-2xl p-4 text-center font-black text-base ${isCorrect?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-700'}`}>
                    {isCorrect ? <><CheckCircle className="inline w-5 h-5 ml-1"/>معادلة صحيحة! 🎉</>
                               : <><XCircle className="inline w-5 h-5 ml-1"/>انتهى الوقت! حظ أوفر</>}
                </div>
            )}

            {/* Controls */}
            {!answered && (
                <div className="flex gap-2">
                    <button onClick={reset}
                        className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200 transition-all">
                        <RotateCcw className="w-4 h-4"/> إعادة
                    </button>
                    <button onClick={checkManual}
                        disabled={movesMade===0}
                        className="flex-1 py-2.5 rounded-xl font-black text-sm shadow-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ background:movesMade>0?'linear-gradient(135deg,#f59e0b,#dc2626)':undefined, color:movesMade>0?'white':undefined, backgroundColor:movesMade===0?'#e5e7eb':undefined, color_:movesMade===0?'#9ca3af':undefined }}>
                        ✅ تحقق من الإجابة
                    </button>
                </div>
            )}
        </div>
    );
}
