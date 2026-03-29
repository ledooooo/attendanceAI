import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import { Loader2, Trophy, Handshake, LogOut, Flag, WifiOff, Clock, Crown, Zap, Target, RotateCcw, Moon, Sun, Settings, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { Employee } from '../../../types';

// ─── Constants ────────────────────────────────────────────────────────────────
const TIME_PRESETS = [
    { key: 'bullet',   label: 'بليتز', desc: '1+0', emoji: '⚡', min: 1,  inc: 0  },
    { key: 'blitz',    label: 'شطرنج سريع', desc: '3+0', emoji: '🔥', min: 3,  inc: 0  },
    { key: 'rapid',    label: 'رابيد',  desc: '10+5', emoji: '🎯', min: 10, inc: 5  },
    { key: 'classic',  label: 'كلاسيكي', desc: '15+10', emoji: '👑', min: 15, inc: 10 },
];

const getTimePreset = (key: string) => TIME_PRESETS.find(p => p.key === key) ?? TIME_PRESETS[1];

type Color = 'w' | 'b';
type PieceType = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P';
type Piece = { type: PieceType; color: Color } | null;
type Board = Piece[][];
type Square = [number, number];

// ─── Unicode pieces ───────────────────────────────────────────────────────────
const GLYPHS: Record<Color, Record<PieceType, string>> = {
    w: { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙' },
    b: { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' },
};

const PIECE_NAMES: Record<PieceType, string> = {
    K: 'ملك', Q: 'ملكة', R: 'رخ', B: 'فيل', N: 'حصان', P: 'soldier'
};

// ─── Initial board ───────────────────────────────────────────────────────────
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

// ─── Game State ──────────────────────────────────────────────────────────────
interface ChessState {
    board:        Piece[][];
    turn:         Color;
    castling:     { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean };
    enPassant:    Square | null;
    halfmove:     number;
    moveHistory:  string[];
    whiteTime:    number;
    blackTime:    number;
    lastMoveAt:   number;
    currentTurn:  string;
    result:       'ongoing' | 'white_wins' | 'black_wins' | 'draw' | 'stalemate' | null;
    drawOfferedBy: string | null;
    lastMove:     { from: Square; to: Square } | null;
    capturedPieces: { w: PieceType[]; b: PieceType[] };
    timeControl:  string;
}

// ─── Move generation ─────────────────────────────────────────────────────────
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
            if ((color === 'w' ? castling.wK : castling.bK) &&
                !board[backRank][5] && !board[backRank][6] &&
                board[backRank][7]?.type === 'R') {
                const nb1 = applyMove(board, [r,c], [backRank,5]);
                const nb2 = applyMove(nb1, [backRank,5], [backRank,6]);
                if (!isKingInCheck(nb1, color) && !isKingInCheck(nb2, color))
                    legal.push([backRank, 6]);
            }
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

function isStalemate(board: Board, color: Color, enPassant: Square | null, castling: ChessState['castling']): boolean {
    return !isKingInCheck(board, color) && !hasAnyLegalMove(board, color, enPassant, castling);
}

function isCheckmate(board: Board, color: Color, enPassant: Square | null, castling: ChessState['castling']): boolean {
    return isKingInCheck(board, color) && !hasAnyLegalMove(board, color, enPassant, castling);
}

function colLetter(c: number) { return String.fromCharCode(97 + c); }
function toAlgebraic(from: Square, to: Square, piece: Piece, captured: boolean, check: boolean, isCheckmate: boolean): string {
    if (!piece) return '';
    const suffix = isCheckmate ? '#' : check ? '+' : '';
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

    return useCallback((type: 'move' | 'capture' | 'check' | 'checkmate' | 'win' | 'tick' | 'stalemate') => {
        try {
            const ac = get(), now = ac.currentTime;
            if (type === 'move') {
                const o = ac.createOscillator(), g = ac.createGain();
                o.connect(g); g.connect(ac.destination);
                o.type = 'sine'; o.frequency.setValueAtTime(500, now);
                o.frequency.exponentialRampToValueAtTime(350, now + 0.08);
                g.gain.setValueAtTime(0.12, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                o.start(now); o.stop(now + 0.1);
            }
            if (type === 'capture') {
                [550, 400, 280].forEach((f, i) => {
                    const o = ac.createOscillator(), g = ac.createGain();
                    o.connect(g); g.connect(ac.destination);
                    o.type = 'sawtooth'; o.frequency.value = f;
                    const t = now + i * 0.06;
                    g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
                    o.start(t); o.stop(t + 0.08);
                });
            }
            if (type === 'check') {
                [700, 900, 700].forEach((f, i) => {
                    const o = ac.createOscillator(), g = ac.createGain();
                    o.connect(g); g.connect(ac.destination);
                    o.type = 'square'; o.frequency.value = f;
                    const t = now + i * 0.1;
                    g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
                    o.start(t); o.stop(t + 0.08);
                });
            }
            if (type === 'checkmate') {
                [523, 659, 784, 659, 1047].forEach((f, i) => {
                    const o = ac.createOscillator(), g = ac.createGain();
                    o.connect(g); g.connect(ac.destination);
                    o.type = 'triangle'; o.frequency.value = f;
                    const t = now + i * 0.15;
                    g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
                    o.start(t); o.stop(t + 0.2);
                });
            }
            if (type === 'stalemate') {
                [400, 350, 300, 250].forEach((f, i) => {
                    const o = ac.createOscillator(), g = ac.createGain();
                    o.connect(g); g.connect(ac.destination);
                    o.type = 'sine'; o.frequency.value = f;
                    const t = now + i * 0.15;
                    g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
                    o.start(t); o.stop(t + 0.12);
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
                o.type = 'sine'; o.frequency.value = 1000;
                g.gain.setValueAtTime(0.06, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
                o.start(now); o.stop(now + 0.04);
            }
        } catch (_) {}
    }, []);
}

// ─── Confetti ─────────────────────────────────────────────────────────────────
const fireConfetti = () => {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:99999;';
    document.body.appendChild(canvas);
    const myConfetti = confetti.create(canvas, { resize: true, useWorker: false });
    const colors = ['#f59e0b', '#10b981', '#6366f1', '#ec4899', '#f97316', '#fbbf24', '#ffffff'];
    myConfetti({ particleCount: 100, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors, zIndex: 99999 });
    myConfetti({ particleCount: 100, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors, zIndex: 99999 });
    setTimeout(() => canvas.remove(), 5000);
};

// ─── Player Clock ─────────────────────────────────────────────────────────────
function PlayerClock({ seconds, active, label, color, isMyTurn }: {
    seconds: number; active: boolean; label: string; color: 'w' | 'b'; isMyTurn: boolean;
}) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const low = seconds < 30;
    const veryLow = seconds < 10;

    return (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all ${
            active
                ? veryLow
                    ? 'border-red-500 bg-red-100 dark:bg-red-900/30 animate-pulse shadow-lg shadow-red-200'
                    : low
                        ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/30 animate-pulse'
                        : 'border-green-400 bg-green-50 dark:bg-green-900/30 shadow-md'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 opacity-60'
        }`}>
            <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-sm font-black shadow-sm ${
                color === 'w'
                    ? 'bg-white border-gray-400 text-gray-800'
                    : 'bg-gray-900 border-gray-600 text-white'
            }`}>
                {color === 'w' ? '♔' : '♚'}
            </div>
            <div className="flex-1">
                <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400">{label}</p>
                <p className={`text-lg font-black tabular-nums transition-colors ${
                    active && veryLow
                        ? 'text-red-600 dark:text-red-400 animate-pulse'
                        : active && low
                            ? 'text-orange-600 dark:text-orange-400'
                            : 'text-gray-800 dark:text-white'
                }`}>
                    {mins}:{String(secs).padStart(2,'0')}
                </p>
            </div>
            {active && low && (
                <div className="w-2 h-2 rounded-full bg-red-500 animate-ping"/>
            )}
        </div>
    );
}

// ─── Move History ─────────────────────────────────────────────────────────────
function MoveHistory({ moves }: { moves: string[] }) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [moves.length]);
    if (moves.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto px-2 py-2 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            {moves.map((m, i) => (
                <span key={i} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                    i % 2 === 0
                        ? 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600'
                        : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                }`}>
                    {i % 2 === 0 && <span className="text-gray-400 dark:text-gray-500 ml-0.5">{Math.floor(i/2)+1}.</span>}
                    {m}
                </span>
            ))}
        </div>
    );
}

// ─── Captured Pieces ─────────────────────────────────────────────────────────
function CapturedPieces({ pieces, color }: { pieces: PieceType[]; color: Color }) {
    const counts = useMemo(() => {
        const c: Record<PieceType, number> = { K: 0, Q: 0, R: 0, B: 0, N: 0, P: 0 };
        pieces.forEach(p => c[p]++);
        return c;
    }, [pieces]);

    const order: PieceType[] = ['Q', 'R', 'B', 'N', 'P'];
    const values: Record<PieceType, number> = { Q: 9, R: 5, B: 3, N: 3, P: 1, K: 0 };

    return (
        <div className="flex items-center gap-1 flex-wrap">
            {order.map(type => (
                counts[type] > 0 && (
                    <div key={type} className="relative">
                        <span className={`text-lg ${color === 'w' ? 'text-white drop-shadow-md' : 'text-gray-900'}`}>
                            {GLYPHS[color][type]}
                        </span>
                        {counts[type] > 1 && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black w-3 h-3 rounded-full flex items-center justify-center">
                                {counts[type]}
                            </span>
                        )}
                    </div>
                )
            ))}
            <span className="text-[10px] text-gray-400 mr-1">
                ({pieces.reduce((sum, p) => sum + values[p], 0)})
            </span>
        </div>
    );
}

// ─── Game Setup Modal ────────────────────────────────────────────────────────
function TimeControlSelector({ selected, onSelect }: { selected: string; onSelect: (key: string) => void }) {
    return (
        <div className="grid grid-cols-2 gap-2">
            {TIME_PRESETS.map(preset => (
                <button
                    key={preset.key}
                    onClick={() => onSelect(preset.key)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 font-black text-sm transition-all ${
                        selected === preset.key
                            ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white border-transparent shadow-lg scale-105'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-amber-300'
                    }`}
                >
                    <span className="text-2xl">{preset.emoji}</span>
                    <span>{preset.label}</span>
                    <span className="text-[10px] opacity-70">{preset.desc}</span>
                </button>
            ))}
        </div>
    );
}

// ─── Promotion Modal ─────────────────────────────────────────────────────────
function PromotionModal({ color, onSelect, onCancel }: {
    color: Color; onSelect: (type: PieceType) => void; onCancel: () => void;
}) {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCancel}>
            <div className="bg-white dark:bg-gray-800 border-2 border-indigo-300 dark:border-indigo-600 rounded-2xl p-4 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                <p className="text-sm font-black text-center text-gray-800 dark:text-white mb-3">اختر قطعة الترقية:</p>
                <div className="grid grid-cols-4 gap-2">
                    {(['Q','R','B','N'] as PieceType[]).map(t => (
                        <button key={t} onClick={() => onSelect(t)}
                            className="flex flex-col items-center gap-1 bg-indigo-50 dark:bg-indigo-900/30 border-2 border-indigo-200 dark:border-indigo-700 rounded-xl py-3 px-2 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 hover:scale-105 transition-all active:scale-95">
                            <span className={`text-3xl ${color === 'w' ? 'text-white drop-shadow-lg' : 'text-gray-900'}`}>
                                {GLYPHS[color][t]}
                            </span>
                            <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-300">
                                {t === 'Q' ? 'ملكه' : t === 'R' ? 'رخ' : t === 'B' ? 'فيل' : 'حصان'}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
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

    const myColor: Color = match.players?.[0]?.id === myId ? 'w' : 'b';
    const initialBoard = useMemo(() => makeInitialBoard(), []);

    const rawGs = match.game_state ?? {};
    const timePreset = getTimePreset(rawGs.timeControl ?? 'blitz');

    const gs: ChessState = {
        board:        Array.isArray(rawGs.board) && rawGs.board.length === 8 ? rawGs.board : initialBoard,
        turn:         rawGs.turn         ?? 'w',
        castling:     rawGs.castling     ?? { wK: true, wQ: true, bK: true, bQ: true },
        enPassant:    rawGs.enPassant    ?? null,
        halfmove:     rawGs.halfmove     ?? 0,
        moveHistory:  rawGs.moveHistory  ?? [],
        whiteTime:    rawGs.whiteTime    ?? timePreset.min * 60,
        blackTime:    rawGs.blackTime    ?? timePreset.min * 60,
        lastMoveAt:   rawGs.lastMoveAt   ?? Date.now(),
        currentTurn:  rawGs.currentTurn  ?? match.players?.[0]?.id,
        result:       rawGs.result       ?? 'ongoing',
        drawOfferedBy: rawGs.drawOfferedBy ?? null,
        lastMove:     rawGs.lastMove     ?? null,
        capturedPieces: rawGs.capturedPieces ?? { w: [], b: [] },
        timeControl:  rawGs.timeControl  ?? 'blitz',
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
    const [wTime, setWTime] = useState(gs.whiteTime);
    const [bTime, setBTime] = useState(gs.blackTime);
    const [showSetup, setShowSetup] = useState(false);
    const [selectedTimeControl, setSelectedTimeControl] = useState(gs.timeControl || 'blitz');
    const [isDarkMode, setIsDarkMode] = useState(false);

    const prevTurnRef = useRef<string | null>(null);
    const resultRecordedRef = useRef(false);
    const tickedRef = useRef<Set<number>>(new Set());

    // ── Dark Mode ────────────────────────────────────────────────────────────
    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [isDarkMode]);

    // ── Sync clocks ──────────────────────────────────────────────────────────
    useEffect(() => { setWTime(gs.whiteTime); }, [gs.whiteTime]);
    useEffect(() => { setBTime(gs.blackTime); }, [gs.blackTime]);

    // ── Clock tick ────────────────────────────────────────────────────────────
    useEffect(() => {
        if (status !== 'playing' || gs.result !== 'ongoing') return;
        const iv = setInterval(() => {
            if (gs.turn === 'w') {
                setWTime(p => {
                    const next = Math.max(0, p - 1);
                    if (next <= 10 && next > 0 && !tickedRef.current.has(next)) {
                        tickedRef.current.add(next);
                        play('tick');
                    }
                    return next;
                });
            } else {
                setBTime(p => {
                    const next = Math.max(0, p - 1);
                    if (next <= 10 && next > 0 && !tickedRef.current.has(next)) {
                        tickedRef.current.add(next);
                        play('tick');
                    }
                    return next;
                });
            }
        }, 1000);
        return () => clearInterval(iv);
    }, [status, gs.turn, gs.result]);

    // ── Time flag ────────────────────────────────────────────────────────────
    useEffect(() => {
        if (status !== 'playing') return;
        const myTurnColor: Color = myColor;
        const myTime = myTurnColor === 'w' ? wTime : bTime;
        if (gs.turn === myTurnColor && isMyTurn && myTime === 0) {
            const result = myColor === 'w' ? 'black_wins' : 'white_wins';
            const winnerId = opponent?.id ?? null;
            play('win');
            fireConfetti();
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
            const left = 60 - elapsed;
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
            play('win');
            fireConfetti();
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

        if (res === 'white_wins' || res === 'black_wins') {
            const iWin = (res === 'white_wins' && myColor === 'w') || (res === 'black_wins' && myColor === 'b');
            recordResult(iWin ? 'win' : 'loss', 'chess', opponentName);
            if (iWin) {
                grantPoints(25);
                play('checkmate');
                fireConfetti();
            }
        } else if (res === 'draw' || res === 'stalemate') {
            recordResult('draw', 'chess', opponentName);
            grantPoints(10);
            play('stalemate');
        }
    }, [status, gs.result]);

    // ── Handle square click ────────────────────────────────────────────────────
    const handleSquareClick = useCallback((r: number, c: number) => {
        if (!isMyTurn || status !== 'playing') return;
        const piece = safeBoard[r][c];

        if (selected) {
            const [sr, sc] = selected;
            if (piece?.color === myColor) {
                setSelected([r,c]);
                setHighlights(legalMoves(safeBoard, r, c, gs.enPassant, gs.castling));
                return;
            }
            if (highlights.some(([hr,hc]) => hr===r && hc===c)) {
                const movingPiece = safeBoard[sr][sc];
                if (movingPiece?.type === 'P' && (r === 0 || r === 7)) {
                    setPromoChoice({ from: selected, to: [r,c] });
                    return;
                }
                executeMove(selected, [r,c], 'Q');
                return;
            }
            setSelected(null); setHighlights([]);
            return;
        }

        if (piece?.color === myColor) {
            setSelected([r,c]);
            setHighlights(legalMoves(safeBoard, r, c, gs.enPassant, gs.castling));
        }
    }, [isMyTurn, status, selected, highlights, safeBoard, gs.enPassant, gs.castling, myColor]);

    const executeMove = useCallback(async (from: Square, to: Square, promo: PieceType) => {
        setSelected(null); setHighlights([]);
        const [fr, fc] = from, [tr, tc] = to;
        const movingPiece = safeBoard[fr][fc]!;
        const captured = !!safeBoard[tr][tc];
        const capturedPiece = safeBoard[tr][tc];

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
                play('checkmate');
                fireConfetti();
            } else {
                result = 'stalemate';
                newStatus = 'finished';
                play('stalemate');
            }
        } else {
            play(inCheck ? 'check' : captured ? 'capture' : 'move');
        }

        // Captured pieces
        const newCaptured = { ...gs.capturedPieces };
        if (captured && capturedPiece) {
            newCaptured[capturedPiece.color] = [...newCaptured[capturedPiece.color], capturedPiece.type];
        }

        // Algebraic notation
        const isCM = result === 'white_wins' || result === 'black_wins';
        const notation = toAlgebraic(from, to, movingPiece, captured, inCheck, isCM);
        const newHistory = [...gs.moveHistory, notation];

        // Update clocks
        const elapsed = Math.floor((Date.now() - (gs.lastMoveAt || Date.now())) / 1000);
        const incTime = timePreset.inc;
        let newWhiteTime = gs.whiteTime;
        let newBlackTime = gs.blackTime;

        if (gs.turn === 'w') {
            newWhiteTime = Math.max(0, gs.whiteTime - elapsed) + incTime;
        } else {
            newBlackTime = Math.max(0, gs.blackTime - elapsed) + incTime;
        }

        const newGs: ChessState = {
            board: nb, turn: nextColor,
            castling: newCastling, enPassant: newEP,
            halfmove: gs.halfmove + 1, moveHistory: newHistory,
            whiteTime: newWhiteTime, blackTime: newBlackTime,
            lastMoveAt: Date.now(), currentTurn: nextPlayerId,
            result, drawOfferedBy: null,
            lastMove: { from, to },
            capturedPieces: newCaptured,
            timeControl: gs.timeControl,
        };

        await supabase.from('live_matches').update({
            game_state: newGs, status: newStatus, winner_id: winnerId,
        }).eq('id', match.id);
    }, [safeBoard, myColor, gs, opponent, myId, timePreset.inc, match.id, play]);

    const handlePromotion = useCallback(async (type: PieceType) => {
        if (!promoChoice) return;
        await executeMove(promoChoice.from, promoChoice.to, type);
        setPromoChoice(null);
    }, [promoChoice, executeMove]);

    const handleResign = async () => {
        await supabase.from('live_matches').update({
            status: 'finished', winner_id: opponent?.id,
            game_state: { ...gs, result: myColor === 'w' ? 'black_wins' : 'white_wins' },
        }).eq('id', match.id);
    };

    const handleOfferDraw = async () => {
        if (gs.drawOfferedBy === opponent?.id) {
            await supabase.from('live_matches').update({
                status: 'finished', winner_id: null,
                game_state: { ...gs, result: 'draw' },
            }).eq('id', match.id);
        } else {
            await supabase.from('live_matches').update({
                game_state: { ...gs, drawOfferedBy: myId },
            }).eq('id', match.id);
            toast.success('تم إرسال عرض التعادل ♟️');
        }
    };

    // ── Board rendering ────────────────────────────────────────────────────────
    const safeBoard: Board = (Array.isArray(gs.board) && gs.board.length === 8)
        ? gs.board
        : initialBoard;

    const displayBoard = myColor === 'b'
        ? [...safeBoard].reverse().map(row => [...row].reverse())
        : safeBoard;

    const toDisplayCoords = (r: number, c: number): Square =>
        myColor === 'b' ? [7 - r, 7 - c] : [r, c];

    const inCheck = isKingInCheck(safeBoard, gs.turn);

    const kingSquare: Square | null = useMemo(() => {
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++)
            if (safeBoard[r][c]?.type === 'K' && safeBoard[r][c]?.color === gs.turn) return [r,c];
        return null;
    }, [safeBoard, gs.turn]);

    // ── WAITING ───────────────────────────────────────────────────────────────
    if (status === 'waiting') return (
        <div className="text-center py-8 px-4">
            <div className="w-24 h-24 mx-auto mb-5 rounded-3xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-2xl text-5xl animate-pulse">
                ♟️
            </div>
            <h3 className="text-xl font-black text-gray-800 dark:text-white mb-1">الشطرنج</h3>
            <p className="text-sm font-bold text-gray-400 dark:text-gray-500 mb-4">
                أنت تلعب بـ {myColor === 'w' ? '♔ الأبيض' : '♚ الأسود'}
            </p>

            {/* Time Control Info */}
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-2 mb-4 inline-block">
                <p className="text-sm font-black text-amber-700 dark:text-amber-300">
                    {TIME_PRESETS.find(p => p.key === gs.timeControl)?.emoji} {TIME_PRESETS.find(p => p.key === gs.timeControl)?.label}
                    <span className="text-amber-500 mr-2">{TIME_PRESETS.find(p => p.key === gs.timeControl)?.desc}</span>
                </p>
            </div>
        </div>
    );

    // ── PLAYING / FINISHED ────────────────────────────────────────────────────
    return (
        <div className="flex flex-col gap-3 py-2 px-2" dir="rtl">
            {/* Promotion Modal */}
            {promoChoice && (
                <PromotionModal
                    color={myColor}
                    onSelect={handlePromotion}
                    onCancel={() => setPromoChoice(null)}
                />
            )}

            {/* Dark Mode Toggle */}
            <button
                onClick={() => setIsDarkMode(p => !p)}
                className="absolute top-3 left-12 z-50 p-2 bg-white/10 hover:bg-white/20 dark:bg-gray-800/50 rounded-full text-gray-700 dark:text-gray-200 backdrop-blur-sm shadow-sm"
            >
                {isDarkMode ? <Sun className="w-5 h-5"/> : <Moon className="w-5 h-5"/>}
            </button>

            {/* Offline Alert */}
            {opponentOffline && (
                <div className="bg-red-50 dark:bg-red-900/30 border-2 border-red-300 dark:border-red-700 rounded-xl px-3 py-2 flex items-center gap-2 animate-pulse">
                    <WifiOff className="w-5 h-5 text-red-500 flex-shrink-0"/>
                    <div className="flex-1">
                        <p className="text-xs font-black text-red-700 dark:text-red-300">{opponent?.name} غير متصل!</p>
                        <p className="text-[10px] text-red-400 font-bold">تغلق خلال {offlineCountdown} ثانية</p>
                    </div>
                    <span className="text-lg font-black text-red-600 bg-red-100 w-8 h-8 rounded-full flex items-center justify-center">
                        {offlineCountdown}
                    </span>
                </div>
            )}

            {/* Draw Offer */}
            {gs.drawOfferedBy === opponent?.id && status === 'playing' && (
                <div className="bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-300 dark:border-blue-700 rounded-xl px-3 py-2 flex items-center gap-2">
                    <span className="text-2xl">🤝</span>
                    <div className="flex-1">
                        <p className="text-xs font-black text-blue-800 dark:text-blue-200">{opponent?.name} يعرض التعادل</p>
                    </div>
                    <button onClick={handleOfferDraw} className="text-xs font-black bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors">
                        قبول
                    </button>
                    <button onClick={() => supabase.from('live_matches').update({ game_state: { ...gs, drawOfferedBy: null } }).eq('id', match.id)}
                        className="text-xs font-black bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                        رفض
                    </button>
                </div>
            )}

            {/* Clocks */}
            <div className="flex gap-2">
                <div className="flex-1">
                    <PlayerClock
                        seconds={myColor === 'w' ? wTime : bTime}
                        active={isMyTurn && status === 'playing'}
                        label={`أنت (${myColor === 'w' ? 'أبيض' : 'أسود'})`}
                        color={myColor}
                        isMyTurn={isMyTurn}
                    />
                </div>
                <div className="flex-1">
                    <PlayerClock
                        seconds={myColor === 'w' ? bTime : wTime}
                        active={!isMyTurn && status === 'playing'}
                        label={opponent?.name || 'المنافس'}
                        color={myColor === 'w' ? 'b' : 'w'}
                        isMyTurn={!isMyTurn}
                    />
                </div>
            </div>

            {/* Captured Pieces */}
            <div className="flex justify-between px-1">
                <CapturedPieces
                    pieces={gs.capturedPieces[myColor === 'w' ? 'b' : 'w']}
                    color={myColor === 'w' ? 'b' : 'w'}
                />
                <CapturedPieces
                    pieces={gs.capturedPieces[myColor]}
                    color={myColor}
                />
            </div>

            {/* Status Banner */}
            <div className={`text-center text-sm font-black py-2 px-4 rounded-xl border-2 transition-all ${
                status === 'finished'
                    ? gs.result === 'stalemate' || gs.result === 'draw'
                        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200'
                        : amIWinner
                            ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200'
                            : 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200'
                    : inCheck
                        ? isMyTurn
                            ? 'bg-red-100 dark:bg-red-900/50 border-red-300 dark:border-red-600 text-red-700 dark:text-red-300 animate-pulse'
                            : 'bg-orange-100 dark:bg-orange-900/50 border-orange-300 dark:border-orange-600 text-orange-700 dark:text-orange-300'
                        : isMyTurn
                            ? 'bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200'
                            : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
            }`}>
                {status === 'finished'
                    ? gs.result === 'stalemate' ? '🤝 تعادل!' :
                      gs.result === 'draw' ? '🤝 تعادل!' :
                      amIWinner ? '🏆 فزت! +25 نقطة!' : '😞 خسرت'
                    : inCheck && isMyTurn ? '⚠️ شاه! دورك' :
                      inCheck ? `⚠️ شاه على ${opponent?.name || 'المنافس'}` :
                      isMyTurn ? 'دورك ♟️' : `دور ${opponent?.name || 'المنافس'}...`}
            </div>

            {/* Chess Board */}
            <div className="w-full rounded-2xl overflow-hidden shadow-2xl border-2 border-amber-900/30 dark:border-amber-600/50">
                {displayBoard.map((row, dr) => (
                    <div key={dr} className="flex">
                        {/* Rank label */}
                        <div className="w-6 flex items-center justify-center text-[10px] font-black text-amber-800/70 dark:text-amber-300/70 bg-amber-50/60 dark:bg-gray-800 flex-shrink-0">
                            {myColor === 'b' ? dr + 1 : 8 - dr}
                        </div>
                        {row.map((piece, dc) => {
                            const [ar, ac] = toDisplayCoords(dr, dc);
                            const isLight = (ar + ac) % 2 === 0;
                            const isSelected = selected?.[0] === ar && selected?.[1] === ac;
                            const isHighlight = highlights.some(([hr,hc]) => hr===ar && hc===ac);
                            const isLastMove = gs.lastMove && (gs.lastMove.from[0] === ar && gs.lastMove.from[1] === ac) ||
                                              (gs.lastMove.to[0] === ar && gs.lastMove.to[1] === ac);
                            const isKingInCheckSq = inCheck && kingSquare?.[0] === ar && kingSquare?.[1] === ac && safeBoard[ar][ac]?.color === gs.turn;

                            return (
                                <button key={dc}
                                    onClick={() => handleSquareClick(ar, ac)}
                                    disabled={status === 'finished'}
                                    className={`relative flex-1 flex items-center justify-center transition-all select-none
                                        ${isKingInCheckSq
                                            ? 'bg-red-500 dark:bg-red-600'
                                            : isSelected
                                                ? 'bg-yellow-400 dark:bg-yellow-500'
                                                : isLastMove
                                                    ? isLight
                                                        ? 'bg-yellow-200/70 dark:bg-yellow-700/50'
                                                        : 'bg-yellow-600/50 dark:bg-yellow-600/30'
                                                    : isHighlight
                                                        ? isLight
                                                            ? 'bg-yellow-200 dark:bg-yellow-800'
                                                            : 'bg-yellow-500/60 dark:bg-yellow-700/40'
                                                        : isLight
                                                            ? 'bg-amber-100 dark:bg-amber-800'
                                                            : 'bg-amber-700 dark:bg-amber-900'}
                                        ${isMyTurn && piece?.color === myColor && !isSelected && status === 'playing' ? 'hover:brightness-110 cursor-pointer active:scale-95' : 'cursor-default'}
                                    `}
                                    style={{ aspectRatio: '1', fontSize: 'clamp(24px, 9vw, 48px)' }}
                                >
                                    {/* Highlight dot for empty squares */}
                                    {isHighlight && !piece && (
                                        <div className="absolute w-[30%] h-[30%] rounded-full bg-black/30 dark:bg-white/30"/>
                                    )}
                                    {/* Capture indicator */}
                                    {isHighlight && piece && (
                                        <div className="absolute inset-0.5 border-4 border-yellow-500/70 rounded-sm pointer-events-none"/>
                                    )}
                                    {/* Piece */}
                                    {piece && (
                                        <span className={`relative z-10 leading-none select-none transition-transform ${
                                            isSelected ? 'scale-110' : ''
                                        } ${piece.color === 'w'
                                            ? 'text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)] dark:drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]'
                                            : 'text-gray-900 drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)]'
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
                <div className="flex bg-amber-50/60 dark:bg-gray-800">
                    <div className="w-6"/>
                    {(myColor === 'b' ? ['h','g','f','e','d','c','b','a'] : ['a','b','c','d','e','f','g','h']).map(l => (
                        <div key={l} className="flex-1 text-center text-[10px] font-black text-amber-800/70 dark:text-amber-300/70 py-1">{l}</div>
                    ))}
                </div>
            </div>

            {/* Move History */}
            <MoveHistory moves={gs.moveHistory}/>

            {/* Game Result */}
            {status === 'finished' && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-gray-200 dark:border-gray-700 shadow-lg p-5 text-center space-y-4">
                    {gs.result === 'stalemate' || gs.result === 'draw' ? (
                        <>
                            <div className="text-5xl">🤝</div>
                            <p className="font-black text-lg text-gray-700 dark:text-gray-200">تعادل!</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">+10 نقاط لكل لاعب</p>
                        </>
                    ) : amIWinner ? (
                        <>
                            <Trophy className="w-16 h-16 text-yellow-400 mx-auto drop-shadow-lg animate-bounce"/>
                            <p className="font-black text-xl text-gray-800 dark:text-white">فزت بالمباراة! 🎉</p>
                            <p className="text-sm text-green-600 dark:text-green-400 font-bold">+25 نقطة 🏆</p>
                        </>
                    ) : (
                        <>
                            <div className="text-5xl grayscale opacity-70">😞</div>
                            <p className="font-black text-lg text-gray-700 dark:text-gray-200">حظ أوفر!</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">تعلم من اللعبة القادمة</p>
                        </>
                    )}

                    {/* Game Stats */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-2">
                            <p className="text-lg font-black text-gray-800 dark:text-white">{gs.moveHistory.length}</p>
                            <p className="text-[10px] text-gray-500">حركة</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-2">
                            <p className="text-lg font-black text-gray-800 dark:text-white">
                                {gs.capturedPieces.w.length + gs.capturedPieces.b.length}
                            </p>
                            <p className="text-[10px] text-gray-500">قطعة</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-2">
                            <p className="text-lg font-black text-gray-800 dark:text-white">
                                {TIME_PRESETS.find(p => p.key === gs.timeControl)?.label ?? 'blitz'}
                            </p>
                            <p className="text-[10px] text-gray-500">نوع اللعبة</p>
                        </div>
                    </div>

                    <button
                        onClick={onExit}
                        className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white py-3 rounded-xl font-black shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        <RotateCcw className="w-5 h-5"/> العودة للصالة
                    </button>
                </div>
            )}

            {/* Actions */}
            {status === 'playing' && (
                <div className="flex gap-2">
                    <button onClick={handleOfferDraw}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all">
                        <Handshake className="w-4 h-4"/>
                        {gs.drawOfferedBy === opponent?.id ? 'قبول تعادل' : 'عرض تعادل'}
                    </button>
                    <button onClick={handleResign}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-300 py-2.5 rounded-xl font-bold text-sm hover:bg-red-100 dark:hover:bg-red-900/50 transition-all">
                        <Flag className="w-4 h-4"/> استسلام
                    </button>
                </div>
            )}

            {/* Exit Button */}
            {status !== 'finished' && (
                <button onClick={onExit}
                    className="flex items-center justify-center gap-1.5 text-xs font-bold text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 py-1 transition-colors">
                    <LogOut className="w-3.5 h-3.5"/> مغادرة الغرفة
                </button>
            )}
        </div>
    );
}
