import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import { Loader2, Trophy, Handshake, LogOut, Zap, Wifi, WifiOff, Timer } from 'lucide-react';
import toast from 'react-hot-toast';
import { Employee } from '../../../types';

// ─── Board geometry — all relative, scales to container ──────────────────────
const ROWS = 6;
const COLS = 7;
const VB_PAD  = 10;
const VB_CELL = 52;
const VB_GAP  = 6;
const VB_W    = COLS * VB_CELL + (COLS - 1) * VB_GAP + VB_PAD * 2;
const VB_H    = ROWS * VB_CELL + (ROWS - 1) * VB_GAP + VB_PAD * 2;
const VB_R    = VB_CELL / 2 - 5;

// ─── Move timer duration ──────────────────────────────────────────────────────
const MOVE_TIMER_SECS = 30;
const OFFLINE_CLOSE_SECS = 30;

type Cell = 'R' | 'Y' | null;
type Board = Cell[][];

// ─── Audio ────────────────────────────────────────────────────────────────────
function useSound() {
    const ctx = useRef<AudioContext | null>(null);
    const getCtx = () => {
        if (!ctx.current) ctx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        return ctx.current;
    };
    return useCallback((type: 'drop' | 'win' | 'draw' | 'invalid' | 'tick' | 'timeout') => {
        try {
            const ac = getCtx(), now = ac.currentTime;
            if (type === 'drop') {
                const osc = ac.createOscillator(), gain = ac.createGain();
                osc.connect(gain); gain.connect(ac.destination);
                osc.type = 'sine'; osc.frequency.setValueAtTime(600, now);
                osc.frequency.exponentialRampToValueAtTime(180, now + 0.18);
                gain.gain.setValueAtTime(0.35, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
                osc.start(now); osc.stop(now + 0.22);
            }
            if (type === 'tick') {
                const osc = ac.createOscillator(), gain = ac.createGain();
                osc.connect(gain); gain.connect(ac.destination);
                osc.type = 'sine'; osc.frequency.value = 660;
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
                osc.start(now); osc.stop(now + 0.06);
            }
            if (type === 'timeout') {
                [330, 220].forEach((f, i) => {
                    const osc = ac.createOscillator(), gain = ac.createGain();
                    osc.connect(gain); gain.connect(ac.destination);
                    osc.type = 'sine'; osc.frequency.value = f;
                    const t = now + i * 0.2;
                    gain.gain.setValueAtTime(0.2, t);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
                    osc.start(t); osc.stop(t + 0.3);
                });
            }
            if (type === 'win') {
                [523, 659, 784, 1047].forEach((freq, i) => {
                    const osc = ac.createOscillator(), gain = ac.createGain();
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
                [440, 330].forEach((freq, i) => {
                    const osc = ac.createOscillator(), gain = ac.createGain();
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
                const osc = ac.createOscillator(), gain = ac.createGain();
                osc.connect(gain); gain.connect(ac.destination);
                osc.type = 'sawtooth'; osc.frequency.setValueAtTime(120, now);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                osc.start(now); osc.stop(now + 0.15);
            }
        } catch (_) {}
    }, []);
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

function vbCenter(r: number, c: number): [number, number] {
    return [
        VB_PAD + c * (VB_CELL + VB_GAP) + VB_CELL / 2,
        VB_PAD + r * (VB_CELL + VB_GAP) + VB_CELL / 2,
    ];
}

function clientToCol(svgEl: SVGSVGElement, clientX: number): number {
    const rect = svgEl.getBoundingClientRect();
    const svgX = (clientX - rect.left) / rect.width * VB_W;
    for (let c = 0; c < COLS; c++) {
        const left  = VB_PAD + c * (VB_CELL + VB_GAP);
        const right = left + VB_CELL;
        if (svgX >= left && svgX <= right) return c;
    }
    if (svgX < VB_PAD) return 0;
    return COLS - 1;
}

// ─── Move Timer Ring ──────────────────────────────────────────────────────────
function MoveTimerRing({ seconds, isMyTurn }: { seconds: number; isMyTurn: boolean }) {
    const r = 20, circ = 2 * Math.PI * r;
    const frac = seconds / MOVE_TIMER_SECS;
    const color = seconds <= 5 ? '#ef4444' : seconds <= 10 ? '#f97316' : isMyTurn ? '#22c55e' : '#94a3b8';
    return (
        <div className="relative w-11 h-11 flex items-center justify-center flex-shrink-0">
            <svg width={44} height={44} viewBox="0 0 44 44" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={22} cy={22} r={r} fill="none" stroke="#e5e7eb" strokeWidth={3.5}/>
                <circle cx={22} cy={22} r={r} fill="none" stroke={color} strokeWidth={3.5}
                    strokeDasharray={circ}
                    strokeDashoffset={circ * (1 - frac)}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}/>
            </svg>
            <span className={`absolute text-[11px] font-black ${seconds <= 5 ? 'text-red-600 animate-pulse' : isMyTurn ? 'text-green-700' : 'text-gray-400'}`}>
                {seconds}
            </span>
        </div>
    );
}

// ─── Piece ────────────────────────────────────────────────────────────────────
function Piece({ r, c, symbol, isNew, isWin, winPulse }: {
    r: number; c: number; symbol: Cell;
    isNew: boolean; isWin: boolean; winPulse: boolean;
}) {
    const [cx, cy] = vbCenter(r, c);
    const startCy  = VB_PAD + VB_CELL / 2;
    const [curY, setCurY] = useState(isNew ? startCy - cy : 0);

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
            <circle cx={cx} cy={cy} r={VB_R + 5}
                fill={isWin && winPulse ? glow : base}
                opacity={isWin ? (winPulse ? 0.5 : 0.2) : 0.2}/>
            <defs>
                <radialGradient id={`g${r}${c}`} cx="33%" cy="28%" r="68%">
                    <stop offset="0%"   stopColor={light}/>
                    <stop offset="55%"  stopColor={base}/>
                    <stop offset="100%" stopColor={dark}/>
                </radialGradient>
            </defs>
            <circle cx={cx} cy={cy} r={VB_R} fill={`url(#g${r}${c})`}/>
            <ellipse cx={cx - VB_R*0.22} cy={cy - VB_R*0.28}
                rx={VB_R*0.3} ry={VB_R*0.17} fill="white" opacity={0.5}/>
        </g>
    );
}

// ─── PlayerChip ───────────────────────────────────────────────────────────────
function PlayerChip({ name, symbol, active, isMe, moveTimer }: {
    name: string; symbol: string; active: boolean; isMe: boolean; moveTimer?: number;
}) {
    const isRed = symbol === 'R';
    return (
        <div className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-2xl border-2 transition-all duration-300 ${
            active
                ? isRed ? 'border-red-400 bg-red-50 shadow-md' : 'border-yellow-400 bg-yellow-50 shadow-md'
                : 'border-gray-100 bg-white opacity-60'
        }`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-white text-lg shadow-md ${
                isRed ? 'bg-gradient-to-br from-red-400 to-red-600' : 'bg-gradient-to-br from-yellow-300 to-amber-500'
            }`}>
                {symbol === 'R' ? '🔴' : '🟡'}
            </div>
            <div className="flex-1 min-w-0">
                <p className={`text-xs font-black truncate ${active ? 'text-gray-800' : 'text-gray-400'}`}>
                    {isMe ? 'أنت' : name}
                </p>
                <p className={`text-[10px] font-bold ${active ? (isRed ? 'text-red-500' : 'text-amber-600') : 'text-gray-300'}`}>
                    {active ? '← دوره' : '⏸'}
                </p>
            </div>
            {active && moveTimer !== undefined && (
                <MoveTimerRing seconds={moveTimer} isMyTurn={isMe}/>
            )}
        </div>
    );
}

// ─── SVG Board ────────────────────────────────────────────────────────────────
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
                <filter id="drop-shadow">
                    <feDropShadow dx="0" dy="6" stdDeviation="10" floodColor="#1e3a8a" floodOpacity="0.7"/>
                </filter>
            </defs>

            {/* Hover preview */}
            {hoverCol !== null && !disabled && (
                <g opacity={0.75}>
                    <defs>
                        <radialGradient id="prev-g" cx="33%" cy="28%" r="68%">
                            <stop offset="0%" stopColor={isRed ? '#fca5a5' : '#fef08a'}/>
                            <stop offset="100%" stopColor={accentClr}/>
                        </radialGradient>
                    </defs>
                    {(() => {
                        const [cx] = vbCenter(0, hoverCol);
                        return (
                            <>
                                <circle cx={cx} cy={PREVIEW_Y + VB_CELL * 0.35} r={VB_R}
                                    fill={`url(#prev-g)`} filter="url(#drop-shadow)"/>
                                <ellipse cx={cx - VB_R*0.22} cy={PREVIEW_Y + VB_CELL*0.35 - VB_R*0.28}
                                    rx={VB_R*0.3} ry={VB_R*0.17} fill="white" opacity={0.5}/>
                                {previewRow >= 0 && (
                                    <circle cx={cx} cy={vbCenter(previewRow, hoverCol)[1]} r={VB_R}
                                        fill={accentClr} opacity={0.2}/>
                                )}
                            </>
                        );
                    })()}
                </g>
            )}

            {/* Board */}
            <rect x={0} y={VB_PAD - 4} width={VB_W} height={VB_H - VB_PAD + 4}
                rx={18} fill="url(#board-grad)" filter="url(#drop-shadow)"/>

            {/* Holes */}
            {Array.from({ length: ROWS }, (_, r) =>
                Array.from({ length: COLS }, (_, c) => {
                    const [cx, cy] = vbCenter(r, c);
                    return (
                        <circle key={`${r}-${c}`} cx={cx} cy={cy} r={VB_R + 2}
                            fill="none" stroke="rgba(0,0,20,0.35)" strokeWidth={2}/>
                    );
                })
            )}

            {/* Pieces */}
            {board.map((row, r) =>
                row.map((cell, c) => {
                    if (!cell) return null;
                    const isLast = lastMove?.[0] === r && lastMove?.[1] === c;
                    const isWin  = winCells.some(([wr,wc]) => wr===r && wc===c);
                    return <Piece key={`${r}-${c}`} r={r} c={c} symbol={cell}
                        isNew={isLast} isWin={isWin} winPulse={winPulse}/>;
                })
            )}

            {/* Holes overlay */}
            {Array.from({ length: ROWS }, (_, r) =>
                Array.from({ length: COLS }, (_, c) => {
                    const [cx, cy] = vbCenter(r, c);
                    const hasCell = board[r][c] !== null;
                    return (
                        <circle key={`h${r}-${c}`} cx={cx} cy={cy} r={VB_R + 1}
                            fill={hasCell ? 'none' : '#0f172a'}
                            opacity={hasCell ? 0 : 0.55}/>
                    );
                })
            )}
        </svg>
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

    // ── Move timer ────────────────────────────────────────────────────────────
    const [moveTimer, setMoveTimer] = useState(MOVE_TIMER_SECS);
    const [offlineCountdown, setOfflineCountdown] = useState<number | null>(null);
    const [opponentOffline, setOpponentOffline] = useState(false);
    const prevTurnRef = useRef<string | null>(null);
    const timerPlayedRef = useRef<Set<number>>(new Set());

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

    // Reset timer on turn change
    useEffect(() => {
        const currentTurn = match.game_state?.current_turn;
        if (currentTurn && currentTurn !== prevTurnRef.current) {
            prevTurnRef.current = currentTurn;
            setMoveTimer(MOVE_TIMER_SECS);
            setOpponentOffline(false);
            setOfflineCountdown(null);
            timerPlayedRef.current.clear();
        }
    }, [match.game_state?.current_turn]);

    // Countdown timer
    useEffect(() => {
        if (match.status !== 'playing') return;
        const iv = setInterval(() => {
            setMoveTimer(prev => {
                const next = prev - 1;
                if ([10, 5, 3, 2, 1].includes(next) && !timerPlayedRef.current.has(next)) {
                    timerPlayedRef.current.add(next);
                    play('tick');
                }
                if (next <= 0) {
                    clearInterval(iv);
                    play('timeout');
                    // Detect offline opponent — only the non-active player triggers this
                    const activeId = match.game_state?.current_turn;
                    if (activeId !== employee.employee_id) {
                        setOpponentOffline(true);
                        setOfflineCountdown(OFFLINE_CLOSE_SECS);
                    }
                    return 0;
                }
                return next;
            });
        }, 1000);
        return () => clearInterval(iv);
    }, [match.game_state?.current_turn, match.status]);

    // Offline close countdown
    useEffect(() => {
        if (offlineCountdown === null) return;
        if (offlineCountdown <= 0) {
            // Close the game — declare opponent forfeit
            const activeId = match.game_state?.current_turn;
            const winnerId = match.players?.find((p: any) => p.id !== activeId)?.id ?? null;
            supabase.from('live_matches').update({
                status: 'finished',
                winner_id: winnerId,
            }).eq('id', match.id);
            return;
        }
        const iv = setInterval(() => setOfflineCountdown(p => (p ?? 1) - 1), 1000);
        return () => clearInterval(iv);
    }, [offlineCountdown]);

    // Win / draw sound
    useEffect(() => {
        const status = match.status;
        if ((status === 'reward_time' || status === 'finished') && match.winner_id && !soundedWin.current) {
            soundedWin.current = true; play('win');
        }
        if (status === 'finished' && !match.winner_id && !soundedDraw.current) {
            soundedDraw.current = true; play('draw');
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
        let newStatus = 'playing', winnerId: string | null = null;

        if (winnerSymbol === 'draw') newStatus = 'finished';
        else if (winnerSymbol) {
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

            {/* Offline alert */}
            {opponentOffline && (
                <div className="bg-red-50 border-2 border-red-300 rounded-2xl px-3 py-2.5 flex items-center gap-2 animate-in slide-in-from-top">
                    <WifiOff className="w-5 h-5 text-red-500 flex-shrink-0"/>
                    <div className="flex-1">
                        <p className="text-xs font-black text-red-700">{opponent?.name || 'المنافس'} غير متصل!</p>
                        <p className="text-[11px] text-red-400 font-bold">تغلق اللعبة خلال {offlineCountdown} ثانية</p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-red-200 flex items-center justify-center">
                        <span className="text-sm font-black text-red-700">{offlineCountdown}</span>
                    </div>
                </div>
            )}

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
                <PlayerChip
                    name={me?.name || 'أنت'}
                    symbol={me?.symbol || 'R'}
                    active={isMyTurn}
                    isMe={true}
                    moveTimer={isMyTurn ? moveTimer : undefined}
                />
                <PlayerChip
                    name={opponent?.name || 'المنافس'}
                    symbol={opponent?.symbol || 'Y'}
                    active={!isMyTurn}
                    isMe={false}
                    moveTimer={!isMyTurn ? moveTimer : undefined}
                />
            </div>

            {/* Board */}
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
