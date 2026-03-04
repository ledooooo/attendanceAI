import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import { Loader2, Trophy, Handshake, LogOut, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { Employee } from '../../../types';

// ─── Board geometry — all relative, scales to container ──────────────────────
const ROWS = 6;
const COLS = 7;
// We use a fixed viewBox and let SVG scale to fill width
const VB_PAD  = 10;
const VB_CELL = 52;
const VB_GAP  = 6;
const VB_W    = COLS * VB_CELL + (COLS - 1) * VB_GAP + VB_PAD * 2;  // 388
const VB_H    = ROWS * VB_CELL + (ROWS - 1) * VB_GAP + VB_PAD * 2;  // 352
const VB_R    = VB_CELL / 2 - 5;   // piece radius

type Cell = 'R' | 'Y' | null;
type Board = Cell[][];

// ─── Audio ────────────────────────────────────────────────────────────────────
function useSound() {
    const ctx = useRef<AudioContext | null>(null);

    const getCtx = () => {
        if (!ctx.current) ctx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        return ctx.current;
    };

    const play = useCallback((type: 'drop' | 'win' | 'draw' | 'invalid') => {
        try {
            const ac = getCtx();
            const now = ac.currentTime;

            if (type === 'drop') {
                // Short click + soft thud
                const osc = ac.createOscillator();
                const gain = ac.createGain();
                osc.connect(gain); gain.connect(ac.destination);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(600, now);
                osc.frequency.exponentialRampToValueAtTime(180, now + 0.18);
                gain.gain.setValueAtTime(0.35, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
                osc.start(now); osc.stop(now + 0.22);
            }

            if (type === 'win') {
                // Ascending fanfare
                const notes = [523, 659, 784, 1047];
                notes.forEach((freq, i) => {
                    const osc = ac.createOscillator();
                    const gain = ac.createGain();
                    osc.connect(gain); gain.connect(ac.destination);
                    osc.type = 'triangle';
                    const t = now + i * 0.13;
                    osc.frequency.setValueAtTime(freq, t);
                    gain.gain.setValueAtTime(0, t);
                    gain.gain.linearRampToValueAtTime(0.3, t + 0.04);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
                    osc.start(t); osc.stop(t + 0.35);
                });
            }

            if (type === 'draw') {
                // Two descending notes
                [440, 330].forEach((freq, i) => {
                    const osc = ac.createOscillator();
                    const gain = ac.createGain();
                    osc.connect(gain); gain.connect(ac.destination);
                    osc.type = 'sine';
                    const t = now + i * 0.2;
                    osc.frequency.setValueAtTime(freq, t);
                    gain.gain.setValueAtTime(0.25, t);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
                    osc.start(t); osc.stop(t + 0.3);
                });
            }

            if (type === 'invalid') {
                const osc = ac.createOscillator();
                const gain = ac.createGain();
                osc.connect(gain); gain.connect(ac.destination);
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(120, now);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                osc.start(now); osc.stop(now + 0.15);
            }
        } catch (_) {}
    }, []);

    return play;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function emptyBoard(): Board {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function dropPiece(board: Board, col: number, symbol: Cell): { board: Board; row: number } | null {
    for (let r = ROWS - 1; r >= 0; r--) {
        if (!board[r][col]) {
            const next = board.map(row => [...row]);
            next[r][col] = symbol;
            return { board: next, row: r };
        }
    }
    return null;
}

function getDropRow(board: Board, col: number): number {
    for (let r = ROWS - 1; r >= 0; r--) if (!board[r][col]) return r;
    return -1;
}

function checkWinner(board: Board): Cell | 'draw' | null {
    const dirs = [[0,1],[1,0],[1,1],[1,-1]];
    for (const [dr,dc] of dirs)
        for (let r=0; r<ROWS; r++) for (let c=0; c<COLS; c++) {
            const cell = board[r][c]; if (!cell) continue;
            if ([1,2,3].every(k => {
                const nr=r+dr*k, nc=c+dc*k;
                return nr>=0&&nr<ROWS&&nc>=0&&nc<COLS&&board[nr][nc]===cell;
            })) return cell;
        }
    if (board[0].every(c => c !== null)) return 'draw';
    return null;
}

function getWinCells(board: Board): [number,number][] {
    const dirs = [[0,1],[1,0],[1,1],[1,-1]];
    for (const [dr,dc] of dirs)
        for (let r=0; r<ROWS; r++) for (let c=0; c<COLS; c++) {
            const cell = board[r][c]; if (!cell) continue;
            const cells: [number,number][] = [[r,c]];
            for (let k=1; k<4; k++) {
                const nr=r+dr*k, nc=c+dc*k;
                if (nr<0||nr>=ROWS||nc<0||nc>=COLS||board[nr][nc]!==cell) break;
                cells.push([nr,nc]);
            }
            if (cells.length===4) return cells;
        }
    return [];
}

// viewBox cell center
function vbCenter(r: number, c: number): [number, number] {
    return [
        VB_PAD + c * (VB_CELL + VB_GAP) + VB_CELL / 2,
        VB_PAD + r * (VB_CELL + VB_GAP) + VB_CELL / 2,
    ];
}

// Convert client coords to column index using SVG hit-testing
function clientToCol(svgEl: SVGSVGElement, clientX: number): number {
    const rect = svgEl.getBoundingClientRect();
    const svgX = (clientX - rect.left) / rect.width * VB_W;
    for (let c = 0; c < COLS; c++) {
        const left  = VB_PAD + c * (VB_CELL + VB_GAP);
        const right = left + VB_CELL;
        if (svgX >= left && svgX <= right) return c;
    }
    // clamp to nearest column edge
    if (svgX < VB_PAD) return 0;
    return COLS - 1;
}

// ─── Piece with drop animation ────────────────────────────────────────────────
function Piece({ r, c, symbol, isNew, isWin, winPulse }: {
    r: number; c: number; symbol: Cell;
    isNew: boolean; isWin: boolean; winPulse: boolean;
}) {
    const [cx, cy] = vbCenter(r, c);
    const startCy  = VB_PAD + VB_CELL / 2;   // top of board
    const [curY, setCurY] = useState(isNew ? startCy - cy : 0);  // offset from final pos

    useEffect(() => {
        if (!isNew) return;
        setCurY(startCy - cy);
        const id = requestAnimationFrame(() => setCurY(0));
        return () => cancelAnimationFrame(id);
    }, []);

    const isRed = symbol === 'R';
    const base  = isRed ? '#ef4444' : '#facc15';
    const light = isRed ? '#fca5a5' : '#fef08a';
    const dark  = isRed ? '#7f1d1d' : '#713f12';
    const glow  = isRed ? '#fbbf24' : '#f97316';

    return (
        <g style={{
            transform: `translateY(${curY}px)`,
            transition: isNew ? 'transform 0.38s cubic-bezier(0.22, 1.8, 0.45, 1)' : undefined,
        }}>
            {/* outer glow */}
            <circle cx={cx} cy={cy} r={VB_R + 5}
                fill={isWin && winPulse ? glow : base}
                opacity={isWin ? (winPulse ? 0.5 : 0.2) : 0.2}
            />
            <defs>
                <radialGradient id={`g${r}${c}`} cx="33%" cy="28%" r="68%">
                    <stop offset="0%"   stopColor={light}/>
                    <stop offset="55%"  stopColor={base}/>
                    <stop offset="100%" stopColor={dark}/>
                </radialGradient>
            </defs>
            <circle cx={cx} cy={cy} r={VB_R} fill={`url(#g${r}${c})`}/>
            {/* shine */}
            <ellipse cx={cx - VB_R*0.22} cy={cy - VB_R*0.28}
                rx={VB_R*0.3} ry={VB_R*0.17} fill="white" opacity={0.5}/>
        </g>
    );
}

// ─── SVG Board — single pointer event surface ─────────────────────────────────
function BoardSVG({ board, onColClick, disabled, mySymbol, lastMove }: {
    board: Board; onColClick: (col: number) => void;
    disabled: boolean; mySymbol: Cell; lastMove: [number,number] | null;
}) {
    const svgRef  = useRef<SVGSVGElement>(null);
    const [hoverCol, setHoverCol] = useState<number | null>(null);
    const [winPulse, setWinPulse] = useState(false);
    const winCells = useMemo(() => getWinCells(board), [board]);

    useEffect(() => {
        if (!winCells.length) return;
        const t = setInterval(() => setWinPulse(p => !p), 420);
        return () => clearInterval(t);
    }, [winCells.length]);

    const isRed     = mySymbol === 'R';
    const accentClr = isRed ? '#ef4444' : '#facc15';

    // ── unified pointer → column ──────────────────────────────────────────────
    const resolveCol = (e: React.PointerEvent<SVGSVGElement>) => {
        if (!svgRef.current) return -1;
        return clientToCol(svgRef.current, e.clientX);
    };

    const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
        if (disabled) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        const col = resolveCol(e);
        if (col >= 0) setHoverCol(col);
    };

    const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
        if (disabled) { setHoverCol(null); return; }
        const col = resolveCol(e);
        setHoverCol(col >= 0 ? col : null);
    };

    const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
        if (disabled) return;
        const col = resolveCol(e);
        if (col >= 0) onColClick(col);
        setHoverCol(null);
    };

    const handlePointerLeave = () => setHoverCol(null);

    const previewRow = hoverCol !== null && !disabled ? getDropRow(board, hoverCol) : -1;
    const PREVIEW_Y  = VB_PAD - VB_CELL * 0.7;

    return (
        <svg
            ref={svgRef}
            viewBox={`0 ${PREVIEW_Y} ${VB_W} ${VB_H - PREVIEW_Y}`}
            style={{ width:'100%', display:'block', touchAction:'none', userSelect:'none', cursor: disabled ? 'not-allowed' : 'pointer' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerLeave}
            onPointerCancel={handlePointerLeave}
        >
            <defs>
                <linearGradient id="board-grad" x1="0" y1="0" x2="0.3" y2="1">
                    <stop offset="0%"   stopColor="#1d4ed8"/>
                    <stop offset="100%" stopColor="#1e3a8a"/>
                </linearGradient>
                <filter id="inset-shadow" x="-10%" y="-10%" width="120%" height="120%">
                    <feComposite in="SourceGraphic" in2="SourceGraphic" operator="over"/>
                    <feGaussianBlur stdDeviation="2" result="blur"/>
                    <feComposite in="blur" in2="SourceGraphic" operator="in" result="inner"/>
                    <feColorMatrix in="inner" type="matrix"
                        values="0 0 0 0 0   0 0 0 0 0   0 0 0 0 0   0 0 0 0.6 0"/>
                </filter>
                <filter id="drop-shadow">
                    <feDropShadow dx="0" dy="6" stdDeviation="10" floodColor="#1e3a8a" floodOpacity="0.7"/>
                </filter>
            </defs>

            {/* Hover preview piece */}
            {hoverCol !== null && !disabled && (
                <g opacity={0.75}>
                    <defs>
                        <radialGradient id="prev-g" cx="33%" cy="28%" r="68%">
                            <stop offset="0%" stopColor={isRed ? '#fca5a5' : '#fef08a'}/>
                            <stop offset="100%" stopColor={accentClr}/>
                        </radialGradient>
                    </defs>
                    <circle
                        cx={VB_PAD + hoverCol * (VB_CELL + VB_GAP) + VB_CELL / 2}
                        cy={PREVIEW_Y + (VB_CELL * 0.7) / 2}
                        r={VB_R * 0.85}
                        fill="url(#prev-g)"
                    />
                    {/* arrow */}
                    <text
                        x={VB_PAD + hoverCol * (VB_CELL + VB_GAP) + VB_CELL / 2}
                        y={VB_PAD - 3}
                        textAnchor="middle"
                        fontSize={13}
                        fill={accentClr}
                        fontWeight="bold"
                    >▼</text>
                </g>
            )}

            {/* Board background */}
            <rect x={0} y={0} width={VB_W} height={VB_H}
                rx={18} ry={18}
                fill="url(#board-grad)"
                filter="url(#drop-shadow)"
            />

            {/* Slot holes */}
            {Array.from({ length: ROWS }, (_, r) =>
                Array.from({ length: COLS }, (_, c) => {
                    const [cx, cy] = vbCenter(r, c);
                    const isPreview = hoverCol === c && previewRow === r && !disabled;
                    return (
                        <circle key={`h${r}${c}`}
                            cx={cx} cy={cy} r={VB_R}
                            fill={isPreview
                                ? (isRed ? 'rgba(239,68,68,0.22)' : 'rgba(250,204,21,0.22)')
                                : '#172554'}
                            style={{ transition: 'fill 0.12s' }}
                        />
                    );
                })
            )}

            {/* Pieces */}
            {board.map((row, r) => row.map((cell, c) => {
                if (!cell) return null;
                const isNew = !!(lastMove && lastMove[0]===r && lastMove[1]===c);
                const isWin = winCells.some(([wr,wc]) => wr===r && wc===c);
                return <Piece key={`p${r}${c}`} r={r} c={c} symbol={cell} isNew={isNew} isWin={isWin} winPulse={winPulse}/>;
            }))}

            {/* Corner bolts */}
            {[[14,14],[VB_W-14,14],[14,VB_H-14],[VB_W-14,VB_H-14]].map(([bx,by],i) => (
                <circle key={`bolt${i}`} cx={bx} cy={by} r={4.5}
                    fill="#1e3a8a" stroke="#3b82f6" strokeWidth={1.5} opacity={0.65}/>
            ))}
        </svg>
    );
}

// ─── Player chip ──────────────────────────────────────────────────────────────
function PlayerChip({ name, symbol, active, isMe }: { name:string; symbol:'R'|'Y'; active:boolean; isMe:boolean }) {
    const isRed = symbol === 'R';
    return (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all duration-300 min-w-0 flex-1 ${
            active
                ? isRed ? 'bg-red-50 border-red-400 shadow-md' : 'bg-yellow-50 border-yellow-400 shadow-md'
                : 'bg-gray-50 border-gray-200 opacity-55'
        }`}>
            <div className={`w-6 h-6 flex-shrink-0 rounded-full ${
                isRed ? 'bg-gradient-to-br from-red-300 to-red-600' : 'bg-gradient-to-br from-yellow-200 to-yellow-500'
            } ${active ? 'ring-2 ring-offset-1 ' + (isRed ? 'ring-red-500' : 'ring-yellow-500') : ''}`}/>
            <div className="min-w-0 flex-1">
                <p className="font-black text-xs text-gray-800 truncate">{name}</p>
                {isMe && <p className="text-[10px] font-bold text-gray-400 leading-none">أنت</p>}
            </div>
            {active && <Zap className={`w-3.5 h-3.5 flex-shrink-0 animate-pulse ${isRed ? 'text-red-500' : 'text-yellow-500'}`}/>}
        </div>
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
interface Props {
    match: any;
    employee: Employee;
    onExit: () => void;
    grantPoints: (pts: number) => Promise<void>;
}

export default function Connect4Game({ match, employee, onExit, grantPoints }: Props) {
    const play     = useSound();
    const me       = match.players?.find((p: any) => p.id === employee.employee_id);
    const opponent = match.players?.find((p: any) => p.id !== employee.employee_id);
    const [lastMove, setLastMove] = useState<[number,number] | null>(null);
    const prevBoardRef = useRef<Board>(emptyBoard());
    const soundedWin   = useRef(false);
    const soundedDraw  = useRef(false);

    const board: Board = useMemo(() => match.game_state?.board ?? emptyBoard(), [match.game_state?.board]);

    // Detect last placed piece & play drop sound
    useEffect(() => {
        const prev = prevBoardRef.current;
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
            if (!prev[r][c] && board[r][c]) {
                setLastMove([r, c]);
                play('drop');
            }
        }
        prevBoardRef.current = board;
    }, [board]);

    // Win / draw sound
    useEffect(() => {
        const status = match.status;
        if ((status === 'reward_time' || status === 'finished') && match.winner_id && !soundedWin.current) {
            soundedWin.current = true;
            play('win');
        }
        if (status === 'finished' && !match.winner_id && !soundedDraw.current) {
            soundedDraw.current = true;
            play('draw');
        }
    }, [match.status, match.winner_id]);

    const isMyTurn  = match.game_state?.current_turn === employee.employee_id;
    const status: string = match.status;
    const amIWinner = match.winner_id === employee.employee_id;

    const handleColClick = async (col: number) => {
        if (!isMyTurn || status !== 'playing') return;
        const result = dropPiece(board, col, me?.symbol as Cell);
        if (!result) { play('invalid'); return toast.error('العمود ممتلئ!'); }

        const { board: nextBoard } = result;
        const winnerSymbol = checkWinner(nextBoard);
        let newStatus = 'playing';
        let winnerId: string | null = null;

        if (winnerSymbol === 'draw') {
            newStatus = 'finished';
        } else if (winnerSymbol) {
            newStatus = 'reward_time';
            winnerId  = winnerSymbol === me?.symbol ? me?.id : opponent?.id;
        }

        await supabase.from('live_matches').update({
            game_state: { board: nextBoard, current_turn: opponent?.id },
            status: newStatus,
            winner_id: winnerId,
        }).eq('id', match.id);
    };

    const handleRewardSelection = async (pts: number) => {
        await grantPoints(pts);
        await supabase.from('live_matches').update({ status: 'finished' }).eq('id', match.id);
    };

    // ── WAITING ───────────────────────────────────────────────────────────────
    if (status === 'waiting') return (
        <div className="text-center py-10 px-4">
            <div className="relative w-18 h-18 mx-auto mb-5" style={{width:72,height:72}}>
                <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-400 to-blue-700 flex items-center justify-center shadow-2xl">
                    <Loader2 className="w-9 h-9 text-white animate-spin"/>
                </div>
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-400 rounded-full border-2 border-white animate-ping"/>
            </div>
            <h3 className="text-lg font-black text-gray-800 mb-1">في انتظار المنافس...</h3>
            <p className="text-sm font-bold text-gray-400">أرسل لزميلك رابط الغرفة!</p>
        </div>
    );

    // ── PLAYING ───────────────────────────────────────────────────────────────
    if (status === 'playing') return (
        <div className="flex flex-col gap-2 py-2 px-3">
            {/* Turn banner */}
            <div className={`text-center text-xs font-black py-2 px-3 rounded-xl border-2 transition-all duration-400 ${
                isMyTurn
                    ? 'bg-green-50 border-green-400 text-green-800'
                    : 'bg-gray-50 border-gray-200 text-gray-500'
            }`}>
                {isMyTurn
                    ? <><Zap className="inline w-3.5 h-3.5 mb-0.5 ml-1 text-green-600"/>دورك — المس عموداً!</>
                    : `⏳ دور ${opponent?.name || 'المنافس'}...`}
            </div>

            {/* Players */}
            <div className="flex gap-2">
                <PlayerChip name={me?.name || 'أنت'} symbol={me?.symbol || 'R'} active={isMyTurn} isMe={true}/>
                <PlayerChip name={opponent?.name || 'المنافس'} symbol={opponent?.symbol || 'Y'} active={!isMyTurn} isMe={false}/>
            </div>

            {/* Board — fills width with side margins */}
            <div className="w-full">
                <BoardSVG
                    board={board}
                    onColClick={handleColClick}
                    disabled={!isMyTurn}
                    mySymbol={me?.symbol as Cell}
                    lastMove={lastMove}
                />
            </div>

            <button onClick={onExit}
                className="flex items-center justify-center gap-1.5 text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors py-1 mt-1">
                <LogOut className="w-3.5 h-3.5"/> مغادرة
            </button>
        </div>
    );

    // ── REWARD TIME ───────────────────────────────────────────────────────────
    if (status === 'reward_time') return (
        <div className="text-center py-5 px-4 animate-in zoom-in-95 duration-400">
            {amIWinner ? (
                <>
                    <div className="relative w-24 h-24 mx-auto mb-3">
                        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-yellow-300 to-amber-500 opacity-25 scale-125 animate-pulse"/>
                        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-300 to-amber-500 flex items-center justify-center shadow-2xl relative">
                            <Trophy className="w-12 h-12 text-white"/>
                        </div>
                        {['🎉','⭐','✨','🏅'].map((e, i) => (
                            <span key={i} className="absolute text-lg animate-bounce"
                                style={{ top:`${[-14,-6,88,90][i]}%`, left:`${[78,4,78,4][i]}%`, animationDelay:`${i*0.15}s` }}>{e}</span>
                        ))}
                    </div>
                    <h3 className="text-xl font-black text-gray-800 mb-0.5">فزت! 🎉</h3>
                    <p className="text-gray-500 font-bold text-xs mb-4">اختر مستوى السؤال لربح النقاط</p>
                    <div className="space-y-2.5 max-w-xs mx-auto">
                        {[
                            { label:'سهل',   pts:5,  g:'from-emerald-400 to-green-600',  e:'🟢' },
                            { label:'متوسط', pts:10, g:'from-amber-400 to-orange-500',   e:'🟡' },
                            { label:'صعب',   pts:15, g:'from-rose-400 to-red-600',       e:'🔴' },
                        ].map(({ label, pts, g, e }) => (
                            <button key={pts} onClick={() => handleRewardSelection(pts)}
                                className={`w-full bg-gradient-to-r ${g} text-white py-3 px-5 rounded-2xl font-black text-sm shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center justify-between`}>
                                <span>{e} {label}</span>
                                <span className="bg-white/20 px-2.5 py-0.5 rounded-lg">+{pts} نقطة</span>
                            </button>
                        ))}
                    </div>
                </>
            ) : (
                <div className="py-4">
                    <div className="w-20 h-20 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center shadow-inner text-5xl">😞</div>
                    <h3 className="text-xl font-black text-gray-800 mb-1">خسرت هذه الجولة</h3>
                    <p className="text-sm font-bold text-gray-400 mb-5">لا تستسلم!</p>
                    <button onClick={onExit} className="bg-gradient-to-r from-gray-600 to-gray-800 text-white px-10 py-3 rounded-2xl font-black w-full max-w-xs shadow-lg hover:scale-105 active:scale-95 transition-all">
                        خروج
                    </button>
                </div>
            )}
        </div>
    );

    // ── FINISHED ──────────────────────────────────────────────────────────────
    if (status === 'finished') return (
        <div className="text-center py-6 px-4 animate-in zoom-in-95 duration-400">
            {match.winner_id ? (
                <>
                    <div className="w-20 h-20 mx-auto mb-3 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-2xl">
                        <Trophy className="w-10 h-10 text-white"/>
                    </div>
                    <h3 className="text-2xl font-black text-gray-800 mb-1">انتهت اللعبة!</h3>
                    <p className="text-sm font-bold text-gray-400 mb-5">
                        {amIWinner ? 'أحسنت، فزت بالجولة! 🏆' : `فاز ${opponent?.name || 'المنافس'} 🎖️`}
                    </p>
                </>
            ) : (
                <>
                    <div className="w-20 h-20 mx-auto mb-3 rounded-full bg-gradient-to-br from-gray-300 to-gray-500 flex items-center justify-center shadow-2xl">
                        <Handshake className="w-10 h-10 text-white"/>
                    </div>
                    <h3 className="text-2xl font-black text-gray-800 mb-1">تعادل! 🤝</h3>
                    <p className="text-sm font-bold text-gray-400 mb-5">مباراة رائعة</p>
                </>
            )}
            <button onClick={onExit}
                className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white w-full max-w-xs py-3.5 rounded-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all">
                العودة للصالة
            </button>
        </div>
    );

    return null;
}
