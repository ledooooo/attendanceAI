import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import { Loader2, Trophy, Handshake, LogOut, Flag, WifiOff, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { Employee } from '../../../types';

// ─── Constants ────────────────────────────────────────────────────────────────
const PLAYER_TIMER_SECS = 5 * 60; // 5 minutes per player
const MOVE_TIMEOUT_SECS = 60;     // 60s offline detection

type Color = 'w' | 'b';
type PieceType = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P';
type Piece = { type: PieceType; color: Color } | null;
type Board = Piece[][];
type Square = [number, number]; // [row, col]  row 0 = rank 8

// ─── Unicode pieces ───────────────────────────────────────────────────────────
const GLYPHS: Record<Color, Record<PieceType, string>> = {
    w: { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙' },
    b: { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' },
};

// ─── Initial board ────────────────────────────────────────────────────────────
function makeInitialBoard(): Board {
    const b: Board = Array.from({ length: 8 }, () => Array(8).fill(null));
    const order: PieceType[] = ['R','N','B','Q','K','B','N','R'];
    for (let c = 0; c < 8; c++) {
        b[0][c] = { type: order[c], color: 'b' };
        b[1][c] = { type: 'P', color: 'b' };
        b[6][c] = { type: 'P', color: 'w' };
        b[7][c] = { type: order[c], color: 'w' };
    }
    return b;
}

// ─── Game State ───────────────────────────────────────────────────────────────
interface ChessState {
    board:        Piece[][];
    turn:         Color;          // 'w' | 'b'
    castling:     { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean };
    enPassant:    Square | null;
    halfmove:     number;
    moveHistory:  string[];       // algebraic notation log
    whiteTime:    number;         // seconds remaining
    blackTime:    number;
    lastMoveAt:   number;         // Date.now() of last move
    currentTurn:  string;         // player id
    result:       'ongoing' | 'white_wins' | 'black_wins' | 'draw' | null;
    drawOfferedBy: string | null; // player id
}

// ─── Move generation (pseudo-legal + check filter) ────────────────────────────
function inBounds(r: number, c: number) { return r >= 0 && r < 8 && c >= 0 && c < 8; }

function rawMoves(board: Board, r: number, c: number, enPassant: Square | null): Square[] {
    const p = board[r][c];
    if (!p) return [];
    const moves: Square[] = [];
    const { type, color } = p;
    const dir = color === 'w' ? -1 : 1;
    const enemy = (sq: Square) => board[sq[0]][sq[1]] && board[sq[0]][sq[1]]!.color !== color;
    const empty = (sq: Square) => !board[sq[0]][sq[1]];
    const slide = (dr: number, dc: number) => {
        for (let i = 1; i < 8; i++) {
            const nr = r + dr * i, nc = c + dc * i;
            if (!inBounds(nr, nc)) break;
            moves.push([nr, nc]);
            if (board[nr][nc]) break;
        }
    };

    switch (type) {
        case 'P': {
            const fwd: Square = [r + dir, c];
            if (inBounds(fwd[0], fwd[1]) && empty(fwd)) {
                moves.push(fwd);
                const start = color === 'w' ? 6 : 1;
                const fwd2: Square = [r + 2 * dir, c];
                if (r === start && empty(fwd2)) moves.push(fwd2);
            }
            for (const dc of [-1, 1]) {
                const nr = r + dir, nc = c + dc;
                if (!inBounds(nr, nc)) continue;
                if (enemy([nr, nc])) moves.push([nr, nc]);
                if (enPassant && enPassant[0] === nr && enPassant[1] === nc) moves.push([nr, nc]);
            }
            break;
        }
        case 'N': {
            for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
                const nr = r+dr, nc = c+dc;
                if (inBounds(nr,nc) && (!board[nr][nc] || enemy([nr,nc]))) moves.push([nr,nc]);
            }
            break;
        }
        case 'B': slide(-1,-1); slide(-1,1); slide(1,-1); slide(1,1); break;
        case 'R': slide(-1,0); slide(1,0); slide(0,-1); slide(0,1); break;
        case 'Q': slide(-1,-1); slide(-1,1); slide(1,-1); slide(1,1);
                  slide(-1,0); slide(1,0); slide(0,-1); slide(0,1); break;
        case 'K': {
            for (const [dr,dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
                const nr=r+dr, nc=c+dc;
                if (inBounds(nr,nc) && (!board[nr][nc] || enemy([nr,nc]))) moves.push([nr,nc]);
            }
            break;
        }
    }
    return moves;
}

function isKingInCheck(board: Board, color: Color): boolean {
    let kr = -1, kc = -1;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++)
        if (board[r][c]?.type === 'K' && board[r][c]?.color === color) { kr = r; kc = c; }
    if (kr < 0) return true;
    const opp: Color = color === 'w' ? 'b' : 'w';
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        if (board[r][c]?.color === opp) {
            const ms = rawMoves(board, r, c, null);
            if (ms.some(([mr,mc]) => mr === kr && mc === kc)) return true;
        }
    }
    return false;
}

function applyMove(board: Board, from: Square, to: Square, promo: PieceType = 'Q'): Board {
    const nb = board.map(row => [...row]);
    const p = nb[from[0]][from[1]]!;
    nb[to[0]][to[1]] = p;
    nb[from[0]][from[1]] = null;
    // pawn promotion
    if (p.type === 'P' && (to[0] === 0 || to[0] === 7)) nb[to[0]][to[1]] = { type: promo, color: p.color };
    return nb;
}

function legalMoves(board: Board, r: number, c: number, enPassant: Square | null,
    castling: ChessState['castling']): Square[] {
    const p = board[r][c];
    if (!p) return [];
    const color = p.color;
    const raw = rawMoves(board, r, c, enPassant);
    const legal: Square[] = [];

    for (const to of raw) {
        const nb = applyMove(board, [r,c], to);
        if (!isKingInCheck(nb, color)) legal.push(to);
    }

    // Castling
    if (p.type === 'K' && !isKingInCheck(board, color)) {
        const backRank = color === 'w' ? 7 : 0;
        if (r === backRank && c === 4) {
            // Kingside
            if ((color === 'w' ? castling.wK : castling.bK) &&
                !board[backRank][5] && !board[backRank][6] &&
                board[backRank][7]?.type === 'R') {
                const nb1 = applyMove(board, [r,c], [backRank,5]);
                const nb2 = applyMove(nb1, [backRank,5], [backRank,6]);
                if (!isKingInCheck(nb1, color) && !isKingInCheck(nb2, color))
                    legal.push([backRank, 6]);
            }
            // Queenside
            if ((color === 'w' ? castling.wQ : castling.bQ) &&
                !board[backRank][3] && !board[backRank][2] && !board[backRank][1] &&
                board[backRank][0]?.type === 'R') {
                const nb1 = applyMove(board, [r,c], [backRank,3]);
                const nb2 = applyMove(nb1, [backRank,3], [backRank,2]);
                if (!isKingInCheck(nb1, color) && !isKingInCheck(nb2, color))
                    legal.push([backRank, 2]);
            }
        }
    }
    return legal;
}

function hasAnyLegalMove(board: Board, color: Color, enPassant: Square | null,
    castling: ChessState['castling']): boolean {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        if (board[r][c]?.color === color && legalMoves(board, r, c, enPassant, castling).length > 0)
            return true;
    }
    return false;
}

function colLetter(c: number) { return String.fromCharCode(97 + c); }
function toAlgebraic(from: Square, to: Square, piece: Piece, captured: boolean, check: boolean): string {
    if (!piece) return '';
    const suffix = check ? '+' : '';
    if (piece.type === 'P') {
        if (captured) return `${colLetter(from[1])}x${colLetter(to[1])}${8 - to[0]}${suffix}`;
        return `${colLetter(to[1])}${8 - to[0]}${suffix}`;
    }
    return `${piece.type}${captured ? 'x' : ''}${colLetter(to[1])}${8 - to[0]}${suffix}`;
}

// ─── Sound ────────────────────────────────────────────────────────────────────
function useChessSound() {
    const ctx = useRef<AudioContext | null>(null);
    const get = () => {
        if (!ctx.current) ctx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        return ctx.current;
    };
    return useCallback((type: 'move' | 'capture' | 'check' | 'win' | 'tick') => {
        try {
            const ac = get(), now = ac.currentTime;
            if (type === 'move') {
                const o = ac.createOscillator(), g = ac.createGain();
                o.connect(g); g.connect(ac.destination);
                o.type = 'sine'; o.frequency.setValueAtTime(440, now);
                o.frequency.exponentialRampToValueAtTime(300, now + 0.1);
                g.gain.setValueAtTime(0.15, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
                o.start(now); o.stop(now + 0.12);
            }
            if (type === 'capture') {
                [500, 350].forEach((f, i) => {
                    const o = ac.createOscillator(), g = ac.createGain();
                    o.connect(g); g.connect(ac.destination);
                    o.type = 'sawtooth'; o.frequency.value = f;
                    const t = now + i * 0.07;
                    g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
                    o.start(t); o.stop(t + 0.1);
                });
            }
            if (type === 'check') {
                [600, 800, 600].forEach((f, i) => {
                    const o = ac.createOscillator(), g = ac.createGain();
                    o.connect(g); g.connect(ac.destination);
                    o.type = 'square'; o.frequency.value = f;
                    const t = now + i * 0.1;
                    g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
                    o.start(t); o.stop(t + 0.09);
                });
            }
            if (type === 'win') {
                [523, 659, 784, 1047].forEach((f, i) => {
                    const o = ac.createOscillator(), g = ac.createGain();
                    o.connect(g); g.connect(ac.destination);
                    o.type = 'triangle'; o.frequency.value = f;
                    const t = now + i * 0.13;
                    g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
                    o.start(t); o.stop(t + 0.3);
                });
            }
            if (type === 'tick') {
                const o = ac.createOscillator(), g = ac.createGain();
                o.connect(g); g.connect(ac.destination);
                o.type = 'sine'; o.frequency.value = 880;
                g.gain.setValueAtTime(0.08, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
                o.start(now); o.stop(now + 0.05);
            }
        } catch (_) {}
    }, []);
}

// ─── Player Clock ─────────────────────────────────────────────────────────────
function PlayerClock({ seconds, active, label, color }: {
    seconds: number; active: boolean; label: string; color: 'w' | 'b';
}) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const low = seconds < 30;
    return (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all ${
            active
                ? low ? 'border-red-400 bg-red-50 animate-pulse' : 'border-green-400 bg-green-50 shadow-md'
                : 'border-gray-100 bg-white opacity-50'
        }`}>
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-black ${
                color === 'w' ? 'bg-white border-gray-400 text-gray-800' : 'bg-gray-900 border-gray-600 text-white'
            }`}>
                {color === 'w' ? '♔' : '♚'}
            </div>
            <div>
                <p className="text-[10px] font-bold text-gray-500">{label}</p>
                <p className={`text-base font-black tabular-nums ${active && low ? 'text-red-600' : 'text-gray-800'}`}>
                    {mins}:{String(secs).padStart(2,'0')}
                </p>
            </div>
        </div>
    );
}

// ─── Move History ─────────────────────────────────────────────────────────────
function MoveHistory({ moves }: { moves: string[] }) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [moves.length]);
    if (moves.length === 0) return null;
    return (
        <div ref={ref} className="flex gap-1 flex-wrap max-h-16 overflow-y-auto px-1 py-1 bg-gray-50 rounded-xl border border-gray-100">
            {moves.map((m, i) => (
                <span key={i} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                    i % 2 === 0 ? 'bg-white text-gray-700 border border-gray-200' : 'bg-gray-200 text-gray-600'
                }`}>
                    {i % 2 === 0 && <span className="text-gray-400 ml-0.5">{Math.floor(i/2)+1}.</span>}{m}
                </span>
            ))}
        </div>
    );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
    match: any;
    employee: Employee;
    onExit: () => void;
    grantPoints: (pts: number) => Promise<void>;
    recordResult: (result: 'win' | 'loss' | 'draw', game: string, opponentName: string) => Promise<void>;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ChessGame({ match, employee, onExit, grantPoints, recordResult }: Props) {
    const play = useChessSound();
    const myId = employee.employee_id;

    const me       = match.players?.find((p: any) => p.id === myId);
    const opponent = match.players?.find((p: any) => p.id !== myId);

    // My color: first player = white, second = black
    const myColor: Color = match.players?.[0]?.id === myId ? 'w' : 'b';

    // Build a stable initial board (only computed once)
    const initialBoard = useMemo(() => makeInitialBoard(), []);

    const rawGs = match.game_state ?? {};
    const gs: ChessState = {
        board:        Array.isArray(rawGs.board) && rawGs.board.length === 8 ? rawGs.board : initialBoard,
        turn:         rawGs.turn         ?? 'w',
        castling:     rawGs.castling     ?? { wK: true, wQ: true, bK: true, bQ: true },
        enPassant:    rawGs.enPassant    ?? null,
        halfmove:     rawGs.halfmove     ?? 0,
        moveHistory:  rawGs.moveHistory  ?? [],
        whiteTime:    rawGs.whiteTime    ?? PLAYER_TIMER_SECS,
        blackTime:    rawGs.blackTime    ?? PLAYER_TIMER_SECS,
        lastMoveAt:   rawGs.lastMoveAt   ?? Date.now(),
        currentTurn:  rawGs.currentTurn  ?? match.players?.[0]?.id,
        result:       rawGs.result       ?? 'ongoing',
        drawOfferedBy: rawGs.drawOfferedBy ?? null,
    };

    const status: string = match.status;
    const isMyTurn = gs.currentTurn === myId;
    const amIWinner = match.winner_id === myId;

    // ── Local UI state ────────────────────────────────────────────────────────
    const [selected, setSelected] = useState<Square | null>(null);
    const [highlights, setHighlights] = useState<Square[]>([]);
    const [promoChoice, setPromoChoice] = useState<{ from: Square; to: Square } | null>(null);
    const [offlineCountdown, setOfflineCountdown] = useState<number | null>(null);
    const [opponentOffline, setOpponentOffline] = useState(false);
    const [wTime, setWTime] = useState(gs.whiteTime ?? PLAYER_TIMER_SECS);
    const [bTime, setBTime] = useState(gs.blackTime ?? PLAYER_TIMER_SECS);

    const prevTurnRef = useRef<string | null>(null);
    const resultRecordedRef = useRef(false);
    const tickedRef = useRef<Set<number>>(new Set());

    // ── Sync clocks from gs ───────────────────────────────────────────────────
    useEffect(() => { setWTime(gs.whiteTime ?? PLAYER_TIMER_SECS); }, [gs.whiteTime]);
    useEffect(() => { setBTime(gs.blackTime ?? PLAYER_TIMER_SECS); }, [gs.blackTime]);

    // ── Clock tick ────────────────────────────────────────────────────────────
    useEffect(() => {
        if (status !== 'playing' || gs.result !== 'ongoing') return;
        const iv = setInterval(() => {
            if (gs.turn === 'w') setWTime(p => Math.max(0, p - 1));
            else setBTime(p => Math.max(0, p - 1));
        }, 1000);
        return () => clearInterval(iv);
    }, [status, gs.turn, gs.result]);

    // Flag on timeout (only the active player's client does this)
    useEffect(() => {
        if (status !== 'playing') return;
        const myTurnColor: Color = myColor;
        const myTime = myTurnColor === 'w' ? wTime : bTime;
        if (gs.turn === myTurnColor && isMyTurn && myTime === 0) {
            const result = myColor === 'w' ? 'black_wins' : 'white_wins';
            const winnerId = opponent?.id ?? null;
            supabase.from('live_matches').update({
                status: 'finished', winner_id: winnerId,
                game_state: { ...gs, result },
            }).eq('id', match.id);
        }
    }, [wTime, bTime]);

    // ── Offline detection ─────────────────────────────────────────────────────
    useEffect(() => {
        const currentTurn = gs.currentTurn;
        if (currentTurn && currentTurn !== prevTurnRef.current) {
            prevTurnRef.current = currentTurn;
            setOpponentOffline(false);
            setOfflineCountdown(null);
            tickedRef.current.clear();
        }
    }, [gs.currentTurn]);

    useEffect(() => {
        if (status !== 'playing') return;
        const iv = setInterval(() => {
            if (!gs.lastMoveAt) return;
            const elapsed = Math.floor((Date.now() - gs.lastMoveAt) / 1000);
            const left = MOVE_TIMEOUT_SECS - elapsed;
            if (left <= 0 && gs.currentTurn !== myId) {
                setOpponentOffline(true);
                setOfflineCountdown(p => p === null ? 30 : p);
            }
        }, 1000);
        return () => clearInterval(iv);
    }, [status, gs.lastMoveAt, gs.currentTurn]);

    useEffect(() => {
        if (offlineCountdown === null) return;
        if (offlineCountdown <= 0) {
            const winnerId = myId;
            supabase.from('live_matches').update({
                status: 'finished', winner_id: winnerId,
                game_state: { ...gs, result: myColor === 'w' ? 'white_wins' : 'black_wins' },
            }).eq('id', match.id);
            return;
        }
        const iv = setInterval(() => setOfflineCountdown(p => (p ?? 1) - 1), 1000);
        return () => clearInterval(iv);
    }, [offlineCountdown]);

    // ── Record result ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (status !== 'finished' || resultRecordedRef.current) return;
        resultRecordedRef.current = true;
        const res = gs.result;
        const opponentName = opponent?.name || 'مجهول';
        if (res === 'white_wins') {
            const iWin = myColor === 'w';
            recordResult(iWin ? 'win' : 'loss', 'chess', opponentName);
            if (iWin) { grantPoints(20); play('win'); }
        } else if (res === 'black_wins') {
            const iWin = myColor === 'b';
            recordResult(iWin ? 'win' : 'loss', 'chess', opponentName);
            if (iWin) { grantPoints(20); play('win'); }
        } else if (res === 'draw') {
            recordResult('draw', 'chess', opponentName);
            grantPoints(5);
        }
    }, [status, gs.result]);

    // ── Handle square click ───────────────────────────────────────────────────
    const handleSquareClick = async (r: number, c: number) => {
        if (!isMyTurn || status !== 'playing') return;
        const piece = safeBoard[r][c];

        if (selected) {
            const [sr, sc] = selected;
            // Clicking own piece → re-select
            if (piece?.color === myColor) {
                setSelected([r,c]);
                setHighlights(legalMoves(safeBoard, r, c, gs.enPassant, gs.castling));
                return;
            }
            // Is this a legal destination?
            if (highlights.some(([hr,hc]) => hr===r && hc===c)) {
                // Check pawn promotion
                const movingPiece = safeBoard[sr][sc];
                if (movingPiece?.type === 'P' && (r === 0 || r === 7)) {
                    setPromoChoice({ from: selected, to: [r,c] });
                    return;
                }
                await executeMove(selected, [r,c], 'Q');
                return;
            }
            setSelected(null); setHighlights([]);
            return;
        }

        if (piece?.color === myColor) {
            setSelected([r,c]);
            setHighlights(legalMoves(safeBoard, r, c, gs.enPassant, gs.castling));
        }
    };

    const executeMove = async (from: Square, to: Square, promo: PieceType) => {
        setSelected(null); setHighlights([]);
        const [fr, fc] = from, [tr, tc] = to;
        const movingPiece = safeBoard[fr][fc]!;
        const captured = !!safeBoard[tr][tc];

        let nb = applyMove(safeBoard, from, to, promo);

        // Castling rook move
        if (movingPiece.type === 'K') {
            const rank = myColor === 'w' ? 7 : 0;
            if (fc === 4 && tc === 6) { nb[rank][5] = nb[rank][7]; nb[rank][7] = null; }
            if (fc === 4 && tc === 2) { nb[rank][3] = nb[rank][0]; nb[rank][0] = null; }
        }

        // En-passant capture
        if (movingPiece.type === 'P' && gs.enPassant && tr === gs.enPassant[0] && tc === gs.enPassant[1]) {
            nb[fr][tc] = null;
        }

        // Update castling rights
        const newCastling = { ...gs.castling };
        if (movingPiece.type === 'K') {
            if (myColor === 'w') { newCastling.wK = false; newCastling.wQ = false; }
            else { newCastling.bK = false; newCastling.bQ = false; }
        }
        if (movingPiece.type === 'R') {
            if (fc === 0) { if (myColor === 'w') newCastling.wQ = false; else newCastling.bQ = false; }
            if (fc === 7) { if (myColor === 'w') newCastling.wK = false; else newCastling.bK = false; }
        }

        // En passant square
        let newEP: Square | null = null;
        if (movingPiece.type === 'P' && Math.abs(tr - fr) === 2)
            newEP = [(fr + tr) / 2, fc];

        const nextColor: Color = myColor === 'w' ? 'b' : 'w';
        const nextPlayerId = opponent?.id;
        const inCheck = isKingInCheck(nb, nextColor);
        const hasMoves = hasAnyLegalMove(nb, nextColor, newEP, newCastling);

        let result: ChessState['result'] = 'ongoing';
        let newStatus = 'playing';
        let winnerId: string | null = null;

        if (!hasMoves) {
            if (inCheck) {
                result = myColor === 'w' ? 'white_wins' : 'black_wins';
                newStatus = 'finished';
                winnerId = myId;
                play('win');
            } else {
                result = 'draw'; newStatus = 'finished';
                play('win');
            }
        } else {
            play(inCheck ? 'check' : captured ? 'capture' : 'move');
        }

        // Algebraic notation
        const notation = toAlgebraic(from, to, movingPiece, captured, inCheck);
        const newHistory = [...gs.moveHistory, notation];

        // Update clocks (subtract elapsed for current player)
        const elapsed = Math.floor((Date.now() - (gs.lastMoveAt || Date.now())) / 1000);
        const newWhiteTime = gs.turn === 'w' ? Math.max(0, (gs.whiteTime ?? PLAYER_TIMER_SECS) - elapsed) : (gs.whiteTime ?? PLAYER_TIMER_SECS);
        const newBlackTime = gs.turn === 'b' ? Math.max(0, (gs.blackTime ?? PLAYER_TIMER_SECS) - elapsed) : (gs.blackTime ?? PLAYER_TIMER_SECS);

        const newGs: ChessState = {
            board: nb, turn: nextColor,
            castling: newCastling, enPassant: newEP,
            halfmove: gs.halfmove + 1, moveHistory: newHistory,
            whiteTime: newWhiteTime, blackTime: newBlackTime,
            lastMoveAt: Date.now(), currentTurn: nextPlayerId,
            result, drawOfferedBy: null,
        };

        await supabase.from('live_matches').update({
            game_state: newGs, status: newStatus, winner_id: winnerId,
        }).eq('id', match.id);
    };

    const handlePromotion = async (type: PieceType) => {
        if (!promoChoice) return;
        await executeMove(promoChoice.from, promoChoice.to, type);
        setPromoChoice(null);
    };

    const handleResign = async () => {
        await supabase.from('live_matches').update({
            status: 'finished', winner_id: opponent?.id,
            game_state: { ...gs, result: myColor === 'w' ? 'black_wins' : 'white_wins' },
        }).eq('id', match.id);
    };

    const handleOfferDraw = async () => {
        if (gs.drawOfferedBy === opponent?.id) {
            // Accept draw
            await supabase.from('live_matches').update({
                status: 'finished', winner_id: null,
                game_state: { ...gs, result: 'draw' },
            }).eq('id', match.id);
        } else {
            await supabase.from('live_matches').update({
                game_state: { ...gs, drawOfferedBy: myId },
            }).eq('id', match.id);
            toast('تم إرسال عرض التعادل ♟️', { icon: '🤝' });
        }
    };

    // ── Board rendering ───────────────────────────────────────────────────────
    // Guard: board must be a valid 8x8 array
    const safeBoard: Board = (Array.isArray(gs.board) && gs.board.length === 8)
        ? gs.board
        : initialBoard;

    // Flip board if playing black
    const displayBoard = myColor === 'b'
        ? [...safeBoard].reverse().map(row => [...row].reverse())
        : safeBoard;
    const toDisplayCoords = (r: number, c: number): Square =>
        myColor === 'b' ? [7 - r, 7 - c] : [r, c];

    const inCheck = isKingInCheck(safeBoard, gs.turn);

    // Find king square
    const kingSquare: Square | null = (() => {
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++)
            if (safeBoard[r][c]?.type === 'K' && safeBoard[r][c]?.color === gs.turn) return [r,c];
        return null;
    })();

    // ── WAITING ───────────────────────────────────────────────────────────────
    if (status === 'waiting') return (
        <div className="text-center py-10 px-4">
            <div className="w-20 h-20 mx-auto mb-5 rounded-3xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-2xl text-4xl">♟️</div>
            <h3 className="text-lg font-black text-gray-800 mb-1">في انتظار المنافس...</h3>
            <p className="text-sm font-bold text-gray-400">أنت تلعب بـ {myColor === 'w' ? '♔ الأبيض' : '♚ الأسود'}</p>
        </div>
    );

    // ── PLAYING ───────────────────────────────────────────────────────────────
    if (status === 'playing' || status === 'finished') return (
        <div className="flex flex-col gap-2 py-1 px-1 w-full"style={{ maxWidth: '100vw' }}>

            {/* Offline alert */}
            {opponentOffline && (
                <div className="bg-red-50 border-2 border-red-300 rounded-xl px-3 py-2 flex items-center gap-2">
                    <WifiOff className="w-4 h-4 text-red-500 flex-shrink-0"/>
                    <div className="flex-1">
                        <p className="text-xs font-black text-red-700">{opponent?.name} غير متصل!</p>
                        <p className="text-[10px] text-red-400 font-bold">تغلق خلال {offlineCountdown}ث</p>
                    </div>
                    <span className="text-sm font-black text-red-600 bg-red-100 w-7 h-7 rounded-full flex items-center justify-center">{offlineCountdown}</span>
                </div>
            )}

            {/* Draw offer */}
            {gs.drawOfferedBy === opponent?.id && status === 'playing' && (
                <div className="bg-blue-50 border-2 border-blue-300 rounded-xl px-3 py-2 flex items-center gap-2">
                    <span className="text-xl">🤝</span>
                    <div className="flex-1">
                        <p className="text-xs font-black text-blue-800">{opponent?.name} يعرض التعادل</p>
                    </div>
                    <button onClick={handleOfferDraw} className="text-xs font-black bg-blue-600 text-white px-3 py-1.5 rounded-lg">قبول</button>
                    <button onClick={() => supabase.from('live_matches').update({ game_state: { ...gs, drawOfferedBy: null } }).eq('id', match.id)}
                        className="text-xs font-black bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg">رفض</button>
                </div>
            )}

            {/* Clocks */}
            <div className="flex gap-2">
                <PlayerClock
                    seconds={myColor === 'w' ? wTime : bTime}
                    active={isMyTurn && status === 'playing'}
                    label={`أنت (${myColor === 'w' ? 'أبيض' : 'أسود'})`}
                    color={myColor}
                />
                <PlayerClock
                    seconds={myColor === 'w' ? bTime : wTime}
                    active={!isMyTurn && status === 'playing'}
                    label={opponent?.name || 'المنافس'}
                    color={myColor === 'w' ? 'b' : 'w'}
                />
            </div>

            {/* Status banner */}
            <div className={`text-center text-xs font-black py-1.5 px-3 rounded-xl border ${
                status === 'finished' ? 'bg-amber-50 border-amber-300 text-amber-800' :
                isMyTurn ? 'bg-green-50 border-green-300 text-green-800' :
                'bg-gray-50 border-gray-200 text-gray-500'
            }`}>
                {status === 'finished'
                    ? (gs.result === 'draw' ? '🤝 تعادل!' : amIWinner ? '🏆 فزت!' : '😞 خسرت')
                    : inCheck && isMyTurn ? '⚠️ شاه! دورك'
                    : inCheck ? `⚠️ شاه على ${opponent?.name || 'المنافس'}`
                    : isMyTurn ? '← دورك' : `⏳ دور ${opponent?.name || 'المنافس'}...`}
            </div>

            {/* Promotion modal */}
            {promoChoice && (
                <div className="bg-white border-2 border-indigo-300 rounded-2xl p-3 shadow-xl">
                    <p className="text-xs font-black text-center text-indigo-700 mb-2">اختر قطعة الترقية:</p>
                    <div className="grid grid-cols-4 gap-2">
                        {(['Q','R','B','N'] as PieceType[]).map(t => (
                            <button key={t} onClick={() => handlePromotion(t)}
                                className="flex flex-col items-center gap-1 bg-indigo-50 border-2 border-indigo-200 rounded-xl py-2 hover:bg-indigo-100 hover:scale-105 transition-all">
                                <span className="text-2xl">{GLYPHS[myColor][t]}</span>
                                <span className="text-[10px] font-black text-indigo-600">
                                    {t === 'Q' ? 'ملكة' : t === 'R' ? 'رخ' : t === 'B' ? 'فيل' : 'حصان'}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Chess Board */}
            <div className="w-full rounded-2xl overflow-hidden shadow-2xl border-2 border-amber-900/30">
                {displayBoard.map((row, dr) => (
                    <div key={dr} className="flex">
                        {/* Rank label */}
                        <div className="w-5 flex items-center justify-center text-[10px] font-black text-amber-800/70 bg-amber-100/60 flex-shrink-0">
                            {myColor === 'b' ? dr + 1 : 8 - dr}
                        </div>
                        {row.map((piece, dc) => {
                            const [ar, ac] = toDisplayCoords(dr, dc);
                            const isLight = (ar + ac) % 2 === 0;
                            const isSelected = selected?.[0] === ar && selected?.[1] === ac;
                            const isHighlight = highlights.some(([hr,hc]) => hr===ar && hc===ac);
                            const isKingInCheckSq = inCheck && kingSquare?.[0] === ar && kingSquare?.[1] === ac && safeBoard[ar][ac]?.color === gs.turn;

                            return (
                                <button key={dc}
                                    onClick={() => handleSquareClick(ar, ac)}
                                    disabled={status === 'finished'}
                                    className={`relative flex-1 flex items-center justify-center transition-all select-none
                                        ${isKingInCheckSq ? 'bg-red-400' :
                                          isSelected ? 'bg-yellow-300' :
                                          isHighlight ? (isLight ? 'bg-yellow-200' : 'bg-yellow-500/50') :
                                          isLight ? 'bg-amber-100' : 'bg-amber-700'}
                                        ${isMyTurn && piece?.color === myColor && !isSelected && status === 'playing' ? 'hover:brightness-110 cursor-pointer active:scale-95' : 'cursor-default'}
                                    `}
                                    style={{ aspectRatio: '1', fontSize: 'clamp(22px, 9vw, 44px)' }}
                                >
                                    {isHighlight && !piece && (
                                        <div className="absolute w-[38%] h-[38%] rounded-full bg-black/20"/>
                                    )}
                                    {isHighlight && piece && (
                                        <div className="absolute inset-0.5 border-4 border-yellow-500/70 rounded-sm pointer-events-none"/>
                                    )}
                                    {piece && (
                                        <span className={`relative z-10 leading-none select-none ${
                                            piece.color === 'w'
                                                ? 'text-white [text-shadow:0_1px_3px_#0009,0_0_6px_#0006]'
                                                : 'text-gray-900 [text-shadow:0_1px_2px_#fff9,0_0_4px_#fff4]'
                                        }`}>
                                            {GLYPHS[piece.color][piece.type]}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                ))}
                {/* File labels */}
                <div className="flex bg-amber-100/60">
                    <div className="w-5"/>
                    {(myColor === 'b' ? ['h','g','f','e','d','c','b','a'] : ['a','b','c','d','e','f','g','h']).map(l => (
                        <div key={l} className="flex-1 text-center text-[10px] font-black text-amber-800/70 py-0.5">{l}</div>
                    ))}
                </div>
            </div>

            {/* Move history */}
            <MoveHistory moves={gs.moveHistory}/>

            {/* Actions */}
            {status === 'playing' && (
                <div className="flex gap-2">
                    <button onClick={handleOfferDraw}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 py-2 rounded-xl font-bold text-xs hover:bg-blue-100 transition-all">
                        <Handshake className="w-3.5 h-3.5"/>
                        {gs.drawOfferedBy === opponent?.id ? 'قبول تعادل' : 'عرض تعادل'}
                    </button>
                    <button onClick={handleResign}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 border border-red-200 text-red-600 py-2 rounded-xl font-bold text-xs hover:bg-red-100 transition-all">
                        <Flag className="w-3.5 h-3.5"/> استسلام
                    </button>
                </div>
            )}

            {status === 'finished' && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-4 text-center space-y-3">
                    {gs.result === 'draw' ? (
                        <><div className="text-4xl">🤝</div><p className="font-black text-gray-700">تعادل! +5 نقاط</p></>
                    ) : amIWinner ? (
                        <><Trophy className="w-10 h-10 text-yellow-400 mx-auto"/><p className="font-black text-gray-800">فزت! +20 نقطة 🎉</p></>
                    ) : (
                        <><div className="text-4xl grayscale">😞</div><p className="font-black text-gray-700">حظ أوفر المرة القادمة</p></>
                    )}
                    <button onClick={onExit}
                        className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white py-3 rounded-xl font-black shadow-lg hover:scale-105 active:scale-95 transition-all">
                        العودة للصالة
                    </button>
                </div>
            )}

            {status !== 'finished' && (
                <button onClick={onExit}
                    className="flex items-center justify-center gap-1.5 text-xs font-bold text-gray-400 hover:text-gray-600 py-1">
                    <LogOut className="w-3.5 h-3.5"/> مغادرة
                </button>
            )}
        </div>
    );

    return null;
}
