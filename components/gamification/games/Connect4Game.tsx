import React, { useMemo, useState, useEffect, useRef } from 'react';
import { supabase } from '../../../supabaseClient';
import { Loader2, Trophy, Handshake, LogOut, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { Employee } from '../../../types';

const ROWS = 6;
const COLS = 7;
const CELL = 54;        // cell size px
const GAP  = 6;         // gap between cells
const PAD  = 12;        // board padding
const R    = (CELL - GAP * 2) / 2;   // circle radius
const BW   = COLS * CELL + (COLS - 1) * GAP + PAD * 2;
const BH   = ROWS * CELL + (ROWS - 1) * GAP + PAD * 2;

type Cell = 'R' | 'Y' | null;
type Board = Cell[][];

// ─── helpers ──────────────────────────────────────────────────────────────────
function emptyBoard(): Board {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function dropPiece(board: Board, col: number, symbol: Cell): Board | null {
    for (let r = ROWS - 1; r >= 0; r--) {
        if (!board[r][col]) {
            const next = board.map(row => [...row]);
            next[r][col] = symbol;
            return next;
        }
    }
    return null;
}

function getDropRow(board: Board, col: number): number {
    for (let r = ROWS - 1; r >= 0; r--) {
        if (!board[r][col]) return r;
    }
    return -1;
}

function checkWinner(board: Board): Cell | 'draw' | null {
    for (let r = 0; r < ROWS; r++)
        for (let c = 0; c <= COLS - 4; c++) {
            const cell = board[r][c];
            if (cell && [1,2,3].every(i => board[r][c+i] === cell)) return cell;
        }
    for (let r = 0; r <= ROWS - 4; r++)
        for (let c = 0; c < COLS; c++) {
            const cell = board[r][c];
            if (cell && [1,2,3].every(i => board[r+i][c] === cell)) return cell;
        }
    for (let r = 0; r <= ROWS - 4; r++)
        for (let c = 0; c <= COLS - 4; c++) {
            const cell = board[r][c];
            if (cell && [1,2,3].every(i => board[r+i][c+i] === cell)) return cell;
        }
    for (let r = 3; r < ROWS; r++)
        for (let c = 0; c <= COLS - 4; c++) {
            const cell = board[r][c];
            if (cell && [1,2,3].every(i => board[r-i][c+i] === cell)) return cell;
        }
    if (board[0].every(c => c !== null)) return 'draw';
    return null;
}

function getWinningCells(board: Board): [number,number][] {
    const dirs = [[0,1],[1,0],[1,1],[1,-1]];
    for (const [dr,dc] of dirs) {
        for (let r=0; r<ROWS; r++) for (let c=0; c<COLS; c++) {
            const cell = board[r][c];
            if (!cell) continue;
            const cells: [number,number][] = [[r,c]];
            for (let k=1; k<4; k++) {
                const nr=r+dr*k, nc=c+dc*k;
                if (nr<0||nr>=ROWS||nc<0||nc>=COLS||board[nr][nc]!==cell) break;
                cells.push([nr,nc]);
            }
            if (cells.length===4) return cells;
        }
    }
    return [];
}

// Cell center (x,y) in SVG coords
function cellCenter(r: number, c: number): [number,number] {
    const x = PAD + c * (CELL + GAP) + CELL / 2;
    const y = PAD + r * (CELL + GAP) + CELL / 2;
    return [x, y];
}

// ─── Animated Piece ────────────────────────────────────────────────────────────
function Piece({ r, c, symbol, isNew, isWin }: {
    r: number; c: number; symbol: Cell; isNew: boolean; isWin: boolean;
}) {
    const [cx, cy] = cellCenter(r, c);
    const [startY] = useState(() => PAD + CELL / 2 - (r + 1) * (CELL + GAP));
    const [animY, setAnimY] = useState(isNew ? startY : cy);
    const [pulse, setPulse] = useState(false);

    useEffect(() => {
        if (isNew) {
            const timeout = setTimeout(() => setAnimY(cy), 20);
            return () => clearTimeout(timeout);
        }
    }, [isNew, cy]);

    useEffect(() => {
        if (isWin) {
            const t = setInterval(() => setPulse(p => !p), 400);
            return () => clearInterval(t);
        }
    }, [isWin]);

    const isRed = symbol === 'R';
    const baseColor  = isRed ? '#ef4444' : '#facc15';
    const glowColor  = isRed ? '#fca5a5' : '#fde68a';
    const darkColor  = isRed ? '#991b1b' : '#854d0e';
    const pulseColor = isRed ? '#fbbf24' : '#f97316';

    return (
        <g style={{ transition: isNew ? `transform 0.45s cubic-bezier(0.25, 1.6, 0.5, 1)` : undefined,
                    transform: `translateY(${animY - cy}px)` }}>
            <defs>
                <radialGradient id={`pg-${r}-${c}`} cx="35%" cy="30%" r="65%">
                    <stop offset="0%" stopColor={glowColor}/>
                    <stop offset="60%" stopColor={baseColor}/>
                    <stop offset="100%" stopColor={darkColor}/>
                </radialGradient>
                <filter id={`glow-${r}-${c}`}>
                    <feGaussianBlur stdDeviation={isWin && pulse ? "6" : "3"} result="blur"/>
                    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
            </defs>
            {/* glow ring */}
            <circle cx={cx} cy={cy} r={R + 4}
                fill="none"
                stroke={isWin && pulse ? pulseColor : baseColor}
                strokeWidth={isWin ? 3 : 1.5}
                opacity={isWin ? (pulse ? 0.9 : 0.4) : 0.35}
            />
            {/* main piece */}
            <circle cx={cx} cy={cy} r={R}
                fill={`url(#pg-${r}-${c})`}
                filter={`url(#glow-${r}-${c})`}
            />
            {/* shine */}
            <ellipse cx={cx - R*0.2} cy={cy - R*0.28} rx={R*0.32} ry={R*0.18}
                fill="white" opacity={0.45}/>
        </g>
    );
}

// ─── SVG Board ─────────────────────────────────────────────────────────────────
function BoardSVG({ board, onColClick, disabled, mySymbol, lastMove }: {
    board: Board;
    onColClick: (col: number) => void;
    disabled: boolean;
    mySymbol: Cell;
    lastMove: [number,number] | null;
}) {
    const [hoverCol, setHoverCol] = useState<number | null>(null);
    const winCells = useMemo(() => getWinningCells(board), [board]);

    const isRed = mySymbol === 'R';
    const hoverColor = isRed ? '#ef4444' : '#facc15';

    // Preview drop row
    const previewRow = hoverCol !== null && !disabled ? getDropRow(board, hoverCol) : -1;

    return (
        <div className="relative" style={{ width: BW }}>
            {/* Column hover zones */}
            <div className="absolute inset-0 grid z-10" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
                {Array.from({ length: COLS }, (_, c) => (
                    <button key={c}
                        disabled={disabled}
                        onClick={() => onColClick(c)}
                        onMouseEnter={() => setHoverCol(c)}
                        onMouseLeave={() => setHoverCol(null)}
                        onTouchStart={() => setHoverCol(c)}
                        className="h-full disabled:cursor-not-allowed"
                        style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
                    />
                ))}
            </div>

            <svg width={BW} height={BH + 56} viewBox={`0 -56 ${BW} ${BH + 56}`} style={{ display:'block', overflow:'visible' }}>
                <defs>
                    <filter id="board-shadow">
                        <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#1e3a8a" floodOpacity="0.6"/>
                    </filter>
                    <linearGradient id="board-bg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#1d4ed8"/>
                        <stop offset="100%" stopColor="#1e40af"/>
                    </linearGradient>
                    <filter id="cell-inset">
                        <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.5"/>
                    </filter>
                </defs>

                {/* Hover preview piece (above board) */}
                {hoverCol !== null && !disabled && (
                    <g opacity={0.7}>
                        <defs>
                            <radialGradient id="prev-grad" cx="35%" cy="30%" r="65%">
                                <stop offset="0%" stopColor={isRed ? '#fca5a5' : '#fde68a'}/>
                                <stop offset="100%" stopColor={hoverColor}/>
                            </radialGradient>
                        </defs>
                        <circle
                            cx={PAD + hoverCol * (CELL + GAP) + CELL / 2}
                            cy={-56 + CELL / 2}
                            r={R}
                            fill="url(#prev-grad)"
                        />
                        {/* drop arrow */}
                        <text
                            x={PAD + hoverCol * (CELL + GAP) + CELL / 2}
                            y={-56 + CELL + 4}
                            textAnchor="middle"
                            fontSize={14}
                            fill={hoverColor}
                            opacity={0.8}
                        >▼</text>
                    </g>
                )}

                {/* Board frame */}
                <rect x={0} y={0} width={BW} height={BH}
                    rx={20} ry={20}
                    fill="url(#board-bg)"
                    filter="url(#board-shadow)"
                />

                {/* Slot holes */}
                {Array.from({ length: ROWS }, (_, r) =>
                    Array.from({ length: COLS }, (_, c) => {
                        const [cx, cy] = cellCenter(r, c);
                        const isPreview = !disabled && hoverCol === c && previewRow === r;
                        return (
                            <circle key={`h-${r}-${c}`}
                                cx={cx} cy={cy} r={R}
                                fill={isPreview ? (isRed ? '#7f1d1d' : '#713f12') : '#1e3a8a'}
                                filter="url(#cell-inset)"
                                style={{ transition: 'fill 0.15s' }}
                            />
                        );
                    })
                )}

                {/* Pieces */}
                {board.map((row, r) => row.map((cell, c) => {
                    if (!cell) return null;
                    const isNew = lastMove?.[0] === r && lastMove?.[1] === c;
                    const isWin = winCells.some(([wr,wc]) => wr===r && wc===c);
                    return <Piece key={`p-${r}-${c}`} r={r} c={c} symbol={cell} isNew={!!isNew} isWin={isWin}/>;
                }))}

                {/* Bolt decorations */}
                {[[8,8],[BW-8,8],[8,BH-8],[BW-8,BH-8]].map(([bx,by],i) => (
                    <circle key={i} cx={bx} cy={by} r={5} fill="#1e40af" stroke="#3b82f6" strokeWidth={1.5} opacity={0.7}/>
                ))}
            </svg>
        </div>
    );
}

// ─── Player Card ───────────────────────────────────────────────────────────────
function PlayerCard({ name, symbol, isMyTurn, isMe }: { name: string; symbol: 'R'|'Y'; isMyTurn: boolean; isMe: boolean }) {
    const isRed = symbol === 'R';
    return (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all duration-300 ${
            isMyTurn
                ? isRed ? 'bg-red-50 border-red-400 shadow-lg shadow-red-200' : 'bg-yellow-50 border-yellow-400 shadow-lg shadow-yellow-200'
                : 'bg-gray-50 border-gray-200 opacity-60'
        }`}>
            {/* piece icon */}
            <div className={`w-7 h-7 rounded-full shadow-md flex-shrink-0 ${
                isRed ? 'bg-gradient-to-br from-red-300 to-red-600' : 'bg-gradient-to-br from-yellow-200 to-yellow-500'
            } ${isMyTurn ? 'ring-2 ring-offset-1 ' + (isRed ? 'ring-red-500' : 'ring-yellow-500') : ''}`}/>
            <div className="min-w-0">
                <p className="font-black text-xs text-gray-800 truncate">{name}</p>
                {isMe && <p className="text-[10px] font-bold text-gray-400">أنت</p>}
            </div>
            {isMyTurn && (
                <Zap className={`w-4 h-4 flex-shrink-0 ${isRed ? 'text-red-500' : 'text-yellow-500'} animate-pulse`}/>
            )}
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface Props {
    match: any;
    employee: Employee;
    onExit: () => void;
    grantPoints: (pts: number) => Promise<void>;
}

export default function Connect4Game({ match, employee, onExit, grantPoints }: Props) {
    const me       = match.players?.find((p: any) => p.id === employee.employee_id);
    const opponent = match.players?.find((p: any) => p.id !== employee.employee_id);
    const [lastMove, setLastMove] = useState<[number,number] | null>(null);
    const prevBoard = useRef<Board>(emptyBoard());

    const board: Board = useMemo(() => match.game_state?.board ?? emptyBoard(), [match.game_state?.board]);

    // Detect new piece
    useEffect(() => {
        const prev = prevBoard.current;
        for (let r=0; r<ROWS; r++) for (let c=0; c<COLS; c++) {
            if (!prev[r][c] && board[r][c]) { setLastMove([r,c]); }
        }
        prevBoard.current = board;
    }, [board]);

    const isMyTurn = match.game_state?.current_turn === employee.employee_id;
    const status: string = match.status;
    const amIWinner = match.winner_id === employee.employee_id;

    const handleColClick = async (col: number) => {
        if (!isMyTurn || status !== 'playing') return;
        const nextBoard = dropPiece(board, col, me?.symbol as Cell);
        if (!nextBoard) return toast.error('العمود ممتلئ!');

        const winnerSymbol = checkWinner(nextBoard);
        let newStatus = 'playing';
        let winnerId: string | null = null;

        if (winnerSymbol === 'draw') {
            newStatus = 'finished';
        } else if (winnerSymbol) {
            newStatus = 'reward_time';
            winnerId = winnerSymbol === me?.symbol ? me?.id : opponent?.id;
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

    // ── WAITING ──────────────────────────────────────────────────────────────
    if (status === 'waiting') return (
        <div className="text-center py-12 px-4">
            <div className="relative w-20 h-20 mx-auto mb-5">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-blue-700 flex items-center justify-center shadow-2xl">
                    <Loader2 className="w-10 h-10 text-white animate-spin"/>
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-amber-400 rounded-full border-2 border-white animate-ping"/>
            </div>
            <h3 className="text-xl font-black text-gray-800 mb-1">في انتظار المنافس...</h3>
            <p className="text-sm font-bold text-gray-400">أرسل لزميلك رابط الغرفة وانتظر!</p>
        </div>
    );

    // ── PLAYING ──────────────────────────────────────────────────────────────
    if (status === 'playing') return (
        <div className="flex flex-col items-center gap-3 py-2 px-1">
            {/* Turn banner */}
            <div className={`w-full max-w-sm text-center text-sm font-black py-2 px-4 rounded-xl border-2 transition-all duration-500 ${
                isMyTurn
                    ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-400 text-green-800 shadow-md shadow-green-100'
                    : 'bg-gray-50 border-gray-200 text-gray-500'
            }`}>
                {isMyTurn
                    ? <><Zap className="inline w-4 h-4 mb-0.5 ml-1 text-green-600"/>دورك — اختر عموداً!</>
                    : `⏳ دور ${opponent?.name || 'المنافس'}...`}
            </div>

            {/* Players */}
            <div className="flex gap-2 w-full max-w-sm">
                <div className="flex-1">
                    <PlayerCard name={me?.name || 'أنت'} symbol={me?.symbol || 'R'} isMyTurn={isMyTurn} isMe={true}/>
                </div>
                <div className="flex-1">
                    <PlayerCard name={opponent?.name || 'المنافس'} symbol={opponent?.symbol || 'Y'} isMyTurn={!isMyTurn} isMe={false}/>
                </div>
            </div>

            {/* Board */}
            <div className="overflow-x-auto w-full flex justify-center pb-1">
                <BoardSVG
                    board={board}
                    onColClick={handleColClick}
                    disabled={!isMyTurn}
                    mySymbol={me?.symbol as Cell}
                    lastMove={lastMove}
                />
            </div>

            {/* Exit */}
            <button onClick={onExit}
                className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors py-1">
                <LogOut className="w-3.5 h-3.5"/> مغادرة اللعبة
            </button>
        </div>
    );

    // ── REWARD TIME ───────────────────────────────────────────────────────────
    if (status === 'reward_time') return (
        <div className="text-center py-6 px-4 animate-in zoom-in-95 duration-500">
            {amIWinner ? (
                <>
                    {/* Trophy */}
                    <div className="relative w-28 h-28 mx-auto mb-4">
                        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-yellow-300 to-amber-500 animate-pulse opacity-30 scale-110"/>
                        <div className="w-28 h-28 rounded-full bg-gradient-to-br from-yellow-300 to-amber-500 flex items-center justify-center shadow-2xl">
                            <Trophy className="w-14 h-14 text-white drop-shadow-xl"/>
                        </div>
                        {['🎉','⭐','✨','🏅'].map((e,i)=>(
                            <span key={i} className="absolute text-xl animate-bounce"
                                style={{top:`${[-12,-8,85,88][i]}%`,left:`${[80,5,80,8][i]}%`,animationDelay:`${i*0.15}s`}}>{e}</span>
                        ))}
                    </div>

                    <h3 className="text-2xl font-black text-gray-800 mb-1">فزت! 🎉</h3>
                    <p className="text-gray-500 font-bold text-sm mb-5">اختر مستوى السؤال لربح النقاط:</p>

                    <div className="space-y-3 max-w-xs mx-auto">
                        {[
                            { label:'سهل',   pts:5,  from:'from-emerald-400', to:'to-green-600',  shadow:'shadow-green-200',  emoji:'🟢' },
                            { label:'متوسط', pts:10, from:'from-amber-400',   to:'to-orange-500', shadow:'shadow-orange-200', emoji:'🟡' },
                            { label:'صعب',   pts:15, from:'from-rose-400',    to:'to-red-600',    shadow:'shadow-red-200',    emoji:'🔴' },
                        ].map(({ label, pts, from, to, shadow, emoji }) => (
                            <button key={pts}
                                onClick={() => handleRewardSelection(pts)}
                                className={`w-full bg-gradient-to-r ${from} ${to} text-white py-3.5 px-5 rounded-2xl font-black text-sm shadow-lg ${shadow} hover:scale-105 active:scale-95 transition-all flex items-center justify-between`}>
                                <span>{emoji} {label}</span>
                                <span className="bg-white/20 px-2.5 py-1 rounded-lg">+{pts} نقطة</span>
                            </button>
                        ))}
                    </div>
                </>
            ) : (
                <div className="py-6">
                    <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center shadow-inner">
                        <span className="text-5xl">😞</span>
                    </div>
                    <h3 className="text-xl font-black text-gray-800 mb-1">خسرت هذه الجولة</h3>
                    <p className="text-sm font-bold text-gray-400 mb-6">لا تستسلم، حاول مرة أخرى!</p>
                    <button onClick={onExit}
                        className="bg-gradient-to-r from-gray-600 to-gray-800 text-white px-10 py-3 rounded-2xl font-black w-full max-w-xs shadow-lg hover:scale-105 active:scale-95 transition-all">
                        خروج
                    </button>
                </div>
            )}
        </div>
    );

    // ── FINISHED ─────────────────────────────────────────────────────────────
    if (status === 'finished') return (
        <div className="text-center py-8 px-4 animate-in zoom-in-95 duration-500">
            {match.winner_id ? (
                <div>
                    <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-2xl">
                        <Trophy className="w-10 h-10 text-white"/>
                    </div>
                    <h3 className="text-2xl font-black text-gray-800 mb-1">انتهت اللعبة!</h3>
                    <p className="text-sm font-bold text-gray-400 mb-6">
                        {amIWinner ? 'أحسنت، فزت بالجولة! 🏆' : `فاز ${opponent?.name || 'المنافس'} 🎖️`}
                    </p>
                </div>
            ) : (
                <div>
                    <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-gray-300 to-gray-500 flex items-center justify-center shadow-2xl">
                        <Handshake className="w-10 h-10 text-white"/>
                    </div>
                    <h3 className="text-2xl font-black text-gray-800 mb-1">تعادل! 🤝</h3>
                    <p className="text-sm font-bold text-gray-400 mb-6">مباراة رائعة من الطرفين</p>
                </div>
            )}
            <button onClick={onExit}
                className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white w-full max-w-xs py-3.5 rounded-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all">
                العودة للصالة
            </button>
        </div>
    );

    return null;
}
