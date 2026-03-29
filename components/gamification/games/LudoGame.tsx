import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import { Loader2, Users, Trophy, Volume2, VolumeX, Moon, Sun } from 'lucide-react';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────
interface LudoPlayer {
    id: string;
    name: string;
    color: 'green' | 'yellow' | 'red' | 'blue';
    pieces: number[];          // -1 = in base, 0-55 = on path, 56+ = home/finished
    isEliminated: boolean;
}

interface LudoState {
    currentPlayerIndex: number;
    players: LudoPlayer[];
    diceValue: number | null;
    diceRolled: boolean;
    winner: string | null;     // player id
    settings: { darkMode: boolean; soundEnabled: boolean };
    lastMove: { playerId: string; pieceIndex: number; from: number; to: number } | null;
}

interface Props {
    match: any;
    employee: Employee;
    onExit: () => void;
    grantPoints: (pts: number) => Promise<void>;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const BOARD_SIZE = 15;
const SAFE_ZONES = [0, 8, 13, 21, 26, 34, 39, 47];

const COLORS = {
    green:  { bg: 'bg-green-500',  bgDark: 'bg-green-700',  light: 'bg-green-200',  text: 'text-green-700',  hex: '#22c55e', border: 'border-green-500'  },
    yellow: { bg: 'bg-yellow-400', bgDark: 'bg-yellow-600', light: 'bg-yellow-200', text: 'text-yellow-700', hex: '#eab308', border: 'border-yellow-400' },
    red:    { bg: 'bg-red-500',    bgDark: 'bg-red-700',    light: 'bg-red-200',    text: 'text-red-700',    hex: '#ef4444', border: 'border-red-500'    },
    blue:   { bg: 'bg-blue-500',   bgDark: 'bg-blue-700',   light: 'bg-blue-200',   text: 'text-blue-700',   hex: '#3b82f6', border: 'border-blue-500'   },
};

const PLAYER_NAMES: Record<string, string> = { green: 'أخضر', yellow: 'أصفر', red: 'أحمر', blue: 'أزرق' };
const COLOR_ORDER: LudoPlayer['color'][] = ['green', 'yellow', 'red', 'blue'];
const START_POSITIONS: Record<string, number> = { green: 0, yellow: 13, red: 26, blue: 39 };
const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

// ─── Board generation ─────────────────────────────────────────────────────────
interface CellInfo { type: 'path' | 'start' | 'home' | 'safe' | 'center' | 'empty'; color?: LudoPlayer['color']; index?: number; homeIndex?: number; }

const PATH_ORDER: [number, number][] = [
    [6,0],[6,1],[6,2],[6,3],[6,4],[6,5],
    [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],
    [0,8],[1,8],[2,8],[3,8],[4,8],[5,8],
    [6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],
    [8,14],[8,13],[8,12],[8,11],[8,10],[8,9],
    [9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],
    [14,6],[13,6],[12,6],[11,6],[10,6],[9,6],
    [8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0],
];

function generateBoard(): CellInfo[][] {
    const cells: CellInfo[][] = Array.from({ length: BOARD_SIZE }, () =>
        Array.from({ length: BOARD_SIZE }, () => ({ type: 'empty' as const }))
    );
    PATH_ORDER.forEach((pos, idx) => { cells[pos[0]][pos[1]] = { type: 'path', index: idx }; });
    SAFE_ZONES.forEach(idx => { const p = PATH_ORDER[idx]; cells[p[0]][p[1]] = { type: 'safe', index: idx }; });
    // Bases
    cells[0][0]   = { type: 'start', color: 'green'  };
    cells[0][14]  = { type: 'start', color: 'yellow' };
    cells[14][14] = { type: 'start', color: 'red'    };
    cells[14][0]  = { type: 'start', color: 'blue'   };
    // Home columns
    for (let i = 0; i < 6; i++) { cells[7][i]        = { type: 'home', color: 'green',  homeIndex: i }; }
    for (let i = 0; i < 6; i++) { cells[i][7]        = { type: 'home', color: 'yellow', homeIndex: i }; }
    for (let i = 0; i < 6; i++) { cells[7][14 - i]   = { type: 'home', color: 'red',    homeIndex: i }; }
    for (let i = 0; i < 6; i++) { cells[14 - i][7]   = { type: 'home', color: 'blue',   homeIndex: i }; }
    cells[7][7] = { type: 'center' };
    return cells;
}

const BOARD_CELLS = generateBoard();

function getPathIndex(color: string, pieces: number[]): number[] {
    return pieces.map(p => {
        if (p < 0) return -1;
        if (p >= 56) return 52;
        return (START_POSITIONS[color] + p) % 52;
    });
}

function getMovable(player: LudoPlayer, dice: number): number[] {
    return player.pieces.reduce<number[]>((acc, p, i) => {
        if (p < 0 && dice === 6) acc.push(i);
        else if (p >= 0 && p < 56 && p + dice <= 56) acc.push(i);
        return acc;
    }, []);
}

// ─── Sound ────────────────────────────────────────────────────────────────────
function useAudio(enabled: boolean) {
    const ctx = useRef<AudioContext | null>(null);
    const get = () => { if (!ctx.current) ctx.current = new (window.AudioContext || (window as any).webkitAudioContext)(); return ctx.current; };

    return useCallback((type: 'dice' | 'move' | 'capture' | 'win') => {
        if (!enabled) return;
        try {
            const ac = get(), t = ac.currentTime;
            const beep = (freq: number, dur: number, vol = 0.25, wave: OscillatorType = 'sine') => {
                const o = ac.createOscillator(), g = ac.createGain();
                o.type = wave; o.frequency.value = freq;
                o.connect(g); g.connect(ac.destination);
                g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
                o.start(t); o.stop(t + dur);
            };
            if (type === 'dice')    beep(300, 0.1);
            if (type === 'move')    beep(440, 0.08);
            if (type === 'capture') beep(180, 0.3, 0.3, 'sawtooth');
            if (type === 'win')     [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.3, 0.2, 'triangle'), i * 150));
        } catch {}
    }, [enabled]);
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function LudoGame({ match, employee, onExit, grantPoints }: Props) {
    const myId    = String(employee.employee_id);
    const myName  = employee.name?.split(' ')[0] || 'لاعب';
    const isHost  = match.players?.[0]?.id === myId;
    const players = match.players ?? [];

    // Derive game state from Supabase match
    const gs: LudoState = match.game_state ?? {
        currentPlayerIndex: 0, players: [], diceValue: null, diceRolled: false,
        winner: null, settings: { darkMode: false, soundEnabled: true }, lastMove: null,
    };

    const [darkMode,   setDarkMode]   = useState(gs.settings?.darkMode  ?? false);
    const [soundOn,    setSoundOn]    = useState(gs.settings?.soundEnabled ?? true);
    const [diceAnim,   setDiceAnim]   = useState<number | null>(null);
    const [animPiece,  setAnimPiece]  = useState<string | null>(null);
    const [selected,   setSelected]   = useState<number | null>(null);
    const [msg,        setMsg]        = useState('');
    const [pointsDone, setPointsDone] = useState(false);

    const play   = useAudio(soundOn);
    const status = match.status ?? 'waiting';

    // ── Assign colors to players on first load ───────────────────────────────
    const myPlayerInfo = players.find((p: any) => p.id === myId);
    const myColor: LudoPlayer['color'] | null = (() => {
        const lp = gs.players?.find(p => p.id === myId);
        return lp?.color ?? null;
    })();

    // ── Sync game state from Supabase ────────────────────────────────────────
    const updateGS = async (partial: Partial<LudoState>) => {
        const merged = { ...gs, ...partial, settings: { ...gs.settings, ...(partial.settings ?? {}) } };
        await supabase.from('live_matches').update({ game_state: merged }).eq('id', match.id);
    };

    // ── Initialize players in game_state when game starts ───────────────────
    useEffect(() => {
        if (status !== 'playing') return;
        if (gs.players && gs.players.length === players.length) return; // already initialized

        // Only host initializes
        if (!isHost) return;

        const ludoPlayers: LudoPlayer[] = players.map((p: any, i: number) => ({
            id:          String(p.id),
            name:        p.name || `لاعب ${i + 1}`,
            color:       COLOR_ORDER[i % 4],
            pieces:      [-1, -1, -1, -1],
            isEliminated: false,
        }));

        updateGS({ players: ludoPlayers, currentPlayerIndex: 0, diceValue: null, diceRolled: false, winner: null });
    }, [status, players.length]);

    // ── Grant points when winner is set ─────────────────────────────────────
    useEffect(() => {
        if (!gs.winner || pointsDone) return;
        setPointsDone(true);
        if (gs.winner === myId) {
            play('win');
            confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
            grantPoints(20).then(() => toast.success('🏆 فزت! +20 نقطة'));
        }
    }, [gs.winner]);

    // ── Roll dice ────────────────────────────────────────────────────────────
    const rollDice = async () => {
        if (gs.diceRolled) return;
        const cp = gs.players?.[gs.currentPlayerIndex];
        if (!cp || cp.id !== myId) { setMsg('ليس دورك'); return; }

        play('dice');
        // Animate
        let count = 0;
        const iv = setInterval(() => {
            setDiceAnim(Math.floor(Math.random() * 6) + 1);
            if (++count >= 8) clearInterval(iv);
        }, 70);

        setTimeout(async () => {
            const val = Math.floor(Math.random() * 6) + 1;
            setDiceAnim(val);
            const movable = getMovable(cp, val);
            const newGS: Partial<LudoState> = { diceValue: val, diceRolled: true };

            if (movable.length === 0) {
                setMsg('لا توجد قطع متاحة — دور اللاعب التالي');
                await updateGS({ ...newGS });
                setTimeout(() => nextTurn(gs), 1200);
            } else if (movable.length === 1) {
                await movePiece(gs, cp, movable[0], val);
            } else {
                setSelected(null);
                setMsg('اختر قطعة للتحريك');
                await updateGS(newGS);
            }
        }, 620);
    };

    // ── Move a piece ─────────────────────────────────────────────────────────
    const movePiece = async (state: LudoState, player: LudoPlayer, pieceIdx: number, dice: number) => {
        const oldPos = player.pieces[pieceIdx];
        let newPos   = oldPos < 0 && dice === 6 ? 0 : oldPos + dice;
        let captured = false;

        const newPlayers: LudoPlayer[] = JSON.parse(JSON.stringify(state.players));
        const movedPlayer = newPlayers.find(p => p.id === player.id)!;
        movedPlayer.pieces[pieceIdx] = newPos;

        setAnimPiece(`${player.color}-${pieceIdx}`);
        setTimeout(() => setAnimPiece(null), 500);

        // Capture check (path squares only, not safe zones)
        if (newPos < 52) {
            const myPathIdx = (START_POSITIONS[player.color] + newPos) % 52;
            if (!SAFE_ZONES.includes(myPathIdx)) {
                newPlayers.forEach(other => {
                    if (other.id === player.id || other.isEliminated) return;
                    other.pieces.forEach((op, oi) => {
                        if (op >= 0 && op < 52) {
                            const theirIdx = (START_POSITIONS[other.color] + op) % 52;
                            if (theirIdx === myPathIdx) {
                                other.pieces[oi] = -1;
                                captured = true;
                                play('capture');
                                confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 }, colors: [COLORS[player.color].hex] });
                            }
                        }
                    });
                });
            }
        }

        play('move');

        // Check win: all pieces at 56+
        let winnerId: string | null = state.winner;
        if (movedPlayer.pieces.every(p => p >= 56)) {
            movedPlayer.isEliminated = true;
            const stillPlaying = newPlayers.filter(p => !p.isEliminated);
            if (stillPlaying.length === 1) {
                winnerId = stillPlaying[0].id;
            } else if (stillPlaying.length === 0) {
                winnerId = movedPlayer.id;
            }
        }

        const newState: Partial<LudoState> = {
            players: newPlayers,
            lastMove: { playerId: player.id, pieceIndex: pieceIdx, from: oldPos, to: newPos },
            winner: winnerId,
        };

        if (winnerId) {
            await updateGS({ ...newState, diceValue: dice, diceRolled: true });
            await supabase.from('live_matches').update({ status: 'finished' }).eq('id', match.id);
            return;
        }

        if (dice === 6 && !captured) {
            setMsg('لفة أخرى! 🎲');
            await updateGS({ ...newState, diceValue: null, diceRolled: false });
        } else {
            await updateGS({ ...newState, diceValue: null, diceRolled: false });
            nextTurn({ ...state, ...newState } as LudoState);
        }
        setSelected(null);
        setMsg('');
    };

    const nextTurn = async (state: LudoState) => {
        const total = state.players.length;
        let next = (state.currentPlayerIndex + 1) % total;
        let tries = 0;
        while (state.players[next]?.isEliminated && tries++ < total) next = (next + 1) % total;
        await updateGS({ currentPlayerIndex: next, diceValue: null, diceRolled: false });
        setMsg('');
    };

    // ── Handle piece click (when user picks which piece to move) ─────────────
    const handlePieceClick = async (pieceIdx: number) => {
        if (!gs.diceRolled || gs.diceValue === null) return;
        const cp = gs.players?.[gs.currentPlayerIndex];
        if (!cp || cp.id !== myId) return;
        const movable = getMovable(cp, gs.diceValue);
        if (!movable.includes(pieceIdx)) { setMsg('هذه القطعة لا يمكن تحريكها'); return; }
        setMsg('');
        await movePiece(gs, cp, pieceIdx, gs.diceValue);
    };

    // ── Toggle settings ──────────────────────────────────────────────────────
    const toggleDark  = () => { const v = !darkMode;  setDarkMode(v);  updateGS({ settings: { ...gs.settings, darkMode: v } }); };
    const toggleSound = () => { const v = !soundOn;   setSoundOn(v);   updateGS({ settings: { ...gs.settings, soundEnabled: v } }); };

    const dark = darkMode ? 'bg-gray-900 text-white' : 'bg-gradient-to-br from-blue-600 to-purple-700';
    const card = darkMode ? 'bg-gray-800 text-white' : 'bg-white/95';

    // ──────────────────────────────────────────────────────────────────────────
    // WAITING
    // ──────────────────────────────────────────────────────────────────────────
    if (status === 'waiting') return (
        <div className={`min-h-full flex flex-col items-center justify-center p-4 ${dark}`} dir="rtl">
            <div className={`${card} rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4`}>
                <div className="text-center">
                    <div className="text-5xl mb-2">🎲</div>
                    <h2 className="text-xl font-black text-gray-800 dark:text-white">لعبة اللودو</h2>
                    <p className="text-sm text-gray-500 font-bold mt-1">2 - 4 لاعبين</p>
                </div>

                <div className="space-y-2">
                    {COLOR_ORDER.map((color, i) => {
                        const slotPlayer = players[i];
                        const filled = !!slotPlayer;
                        return (
                            <div key={color} className={`flex items-center gap-3 p-3 rounded-2xl border-2 ${filled ? COLORS[color].border : 'border-dashed border-gray-200'}`}>
                                <div className={`w-8 h-8 rounded-full ${filled ? COLORS[color].bg : 'bg-gray-200'} flex items-center justify-center font-black text-white text-sm`}>
                                    {filled ? '✓' : i + 1}
                                </div>
                                <div className="flex-1">
                                    <p className={`text-sm font-black ${filled ? 'text-gray-800' : 'text-gray-400'}`}>
                                        {filled ? slotPlayer.name : `مكان ${PLAYER_NAMES[color]}`}
                                    </p>
                                    {filled && <p className="text-[10px] font-bold" style={{ color: COLORS[color].hex }}>{PLAYER_NAMES[color]}</p>}
                                </div>
                                {filled && slotPlayer.id === myId && (
                                    <span className="text-[10px] bg-indigo-100 text-indigo-600 font-black px-2 py-0.5 rounded-full">أنت</span>
                                )}
                            </div>
                        );
                    })}
                </div>

                {isHost ? (
                    <div className="space-y-2">
                        {players.length < 2 && (
                            <p className="text-center text-xs font-bold text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
                                ⏳ في انتظار لاعب آخر على الأقل...
                            </p>
                        )}
                        {players.length >= 2 && (
                            <button
                                onClick={async () => {
                                    await supabase.from('live_matches').update({ status: 'playing' }).eq('id', match.id);
                                }}
                                className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-3.5 rounded-2xl font-black shadow-lg hover:scale-105 active:scale-95 transition-all"
                            >
                                🎲 ابدأ اللعبة ({players.length} لاعبين)
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center justify-center gap-2 text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm font-bold">في انتظار المضيف...</span>
                    </div>
                )}

                <button onClick={onExit} className="w-full text-sm text-gray-400 font-bold hover:text-gray-600 py-1">← العودة للصالة</button>
            </div>
        </div>
    );

    // ──────────────────────────────────────────────────────────────────────────
    // INITIALIZING (playing but no ludo players yet)
    // ──────────────────────────────────────────────────────────────────────────
    if (status === 'playing' && (!gs.players || gs.players.length === 0)) return (
        <div className={`min-h-full flex items-center justify-center ${dark}`}>
            <div className="text-center text-white">
                <Loader2 className="w-12 h-12 animate-spin mx-auto mb-3 opacity-60" />
                <p className="font-bold">جاري تجهيز اللعبة...</p>
            </div>
        </div>
    );

    // ──────────────────────────────────────────────────────────────────────────
    // FINISHED
    // ──────────────────────────────────────────────────────────────────────────
    if (status === 'finished' || gs.winner) {
        const winner = gs.players?.find(p => p.id === gs.winner);
        const isWinner = gs.winner === myId;
        return (
            <div className={`min-h-full flex items-center justify-center p-4 ${dark}`} dir="rtl">
                <div className={`${card} rounded-3xl p-6 w-full max-w-sm shadow-2xl text-center`}>
                    <div className="text-5xl mb-3">{isWinner ? '🏆' : '🎖️'}</div>
                    <h2 className="text-2xl font-black text-gray-800 mb-1">
                        {isWinner ? 'مبروك! أنت الفائز' : 'انتهت اللعبة'}
                    </h2>
                    {winner && !isWinner && (
                        <p className="font-bold text-gray-500 mb-4">الفائز: <span className="font-black" style={{ color: COLORS[winner.color].hex }}>{winner.name}</span></p>
                    )}
                    {isWinner && <p className="text-emerald-600 font-black text-lg mb-4">+20 نقطة 🌟</p>}

                    <div className="space-y-2 mb-5">
                        {gs.players?.map((p, i) => (
                            <div key={p.id} className={`flex items-center gap-3 p-2.5 rounded-xl ${p.id === myId ? 'bg-indigo-50' : 'bg-gray-50'}`}>
                                <div className={`w-7 h-7 rounded-full ${COLORS[p.color].bg} flex items-center justify-center text-white font-black text-xs`}>
                                    {p.id === gs.winner ? '👑' : i + 1}
                                </div>
                                <p className={`text-sm font-black ${p.id === myId ? 'text-indigo-700' : 'text-gray-700'}`}>{p.name}</p>
                                <p className="text-xs text-gray-400 font-bold mr-auto">{p.pieces.filter(x => x >= 56).length}/4 وصلت</p>
                            </div>
                        ))}
                    </div>

                    <button onClick={onExit}
                        className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-3.5 rounded-2xl font-black shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2">
                        <Users className="w-4 h-4" /> العودة للصالة
                    </button>
                </div>
            </div>
        );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PLAYING
    // ──────────────────────────────────────────────────────────────────────────
    const ludoPlayers = gs.players ?? [];
    const currentPlayer = ludoPlayers[gs.currentPlayerIndex];
    const isMyTurn      = currentPlayer?.id === myId;

    const renderCell = (cell: CellInfo, row: number, col: number) => {
        const base = 'w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-xs font-bold border border-gray-200 relative';

        if (cell.type === 'empty') return (
            <div key={`${row}-${col}`} className={`${base} ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-gray-100 border-transparent'}`} />
        );
        if (cell.type === 'start') return (
            <div key={`${row}-${col}`} className={`${base} ${COLORS[cell.color!].bg} rounded-lg`}>
                <span className="text-sm">🏠</span>
            </div>
        );
        if (cell.type === 'home') return (
            <div key={`${row}-${col}`} className={`${base} ${COLORS[cell.color!].light} rounded-sm`} />
        );
        if (cell.type === 'center') return (
            <div key={`${row}-${col}`} className={`${base} bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full border-orange-500`}>
                <span>⭐</span>
            </div>
        );
        if (cell.type === 'safe') return (
            <div key={`${row}-${col}`} className={`${base} ${darkMode ? 'bg-gray-600' : 'bg-gray-300'} rounded-sm`}>
                <span className="text-gray-500 text-[10px]">⬟</span>
            </div>
        );

        // Path cell — find pieces on it
        const piecesHere: { color: LudoPlayer['color']; pieceIdx: number; playerId: string }[] = [];
        ludoPlayers.forEach(p => {
            const pathIndices = getPathIndex(p.color, p.pieces);
            pathIndices.forEach((pi, ii) => { if (pi === cell.index) piecesHere.push({ color: p.color, pieceIdx: ii, playerId: p.id }); });
        });

        return (
            <div key={`${row}-${col}`} className={`${base} ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-sm`}>
                {piecesHere.slice(0, 4).map((piece, idx) => {
                    const isAnimating = animPiece === `${piece.color}-${piece.pieceIdx}`;
                    const isMovable   = isMyTurn && gs.diceRolled && gs.diceValue !== null && piece.playerId === myId && getMovable(currentPlayer!, gs.diceValue!).includes(piece.pieceIdx);
                    return (
                        <div key={idx}
                            onClick={() => piece.playerId === myId && handlePieceClick(piece.pieceIdx)}
                            className={`absolute w-5 h-5 sm:w-6 sm:h-6 ${COLORS[piece.color].bg} rounded-full border-2 border-white flex items-center justify-center text-white text-[9px] font-black shadow transition-all
                                ${isAnimating ? 'scale-125 animate-bounce' : ''}
                                ${isMovable ? 'ring-2 ring-yellow-400 ring-offset-1 cursor-pointer hover:scale-110' : ''}
                            `}
                            style={{ top: idx * 2, left: idx * 2 }}
                        >
                            {piece.pieceIdx + 1}
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderBase = (color: LudoPlayer['color']) => {
        const player = ludoPlayers.find(p => p.color === color);
        return (
            <div className={`p-1.5 rounded-xl ${COLORS[color].bg} flex flex-col items-center gap-1`}>
                <p className="text-white text-[10px] font-black">{PLAYER_NAMES[color]}</p>
                <div className="grid grid-cols-2 gap-1">
                    {[0, 1, 2, 3].map(i => {
                        const inBase  = player?.pieces[i] !== undefined && player.pieces[i] < 0;
                        const done    = player?.pieces[i] !== undefined && player.pieces[i] >= 56;
                        const isMovable = inBase && isMyTurn && player?.id === myId && gs.diceRolled && gs.diceValue === 6;
                        return (
                            <div key={i}
                                onClick={() => isMovable && handlePieceClick(i)}
                                className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-black transition-all
                                    ${COLORS[color].light} ${COLORS[color].text}
                                    ${!inBase && !done ? 'opacity-30' : ''}
                                    ${done ? '!bg-yellow-400 !text-white' : ''}
                                    ${isMovable ? 'ring-2 ring-yellow-300 cursor-pointer hover:scale-110 animate-pulse' : ''}
                                    ${animPiece === `${color}-${i}` ? 'scale-125' : ''}
                                `}
                            >
                                {done ? '✓' : i + 1}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const diceDisplay = diceAnim ? DICE_FACES[diceAnim - 1] : (gs.diceValue ? DICE_FACES[gs.diceValue - 1] : '🎲');

    return (
        <div className={`min-h-full flex flex-col ${dark}`} dir="rtl">
            {/* Header */}
            <div className={`px-3 py-2 flex items-center justify-between ${darkMode ? 'bg-gray-800' : 'bg-white/20'}`}>
                <div className="flex items-center gap-2">
                    <span className="text-xl">🎲</span>
                    <span className="font-black text-white text-sm">اللودو</span>
                </div>
                <div className="flex gap-2">
                    <button onClick={toggleSound} className="p-1.5 bg-white/20 rounded-lg text-white">
                        {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                    </button>
                    <button onClick={toggleDark} className="p-1.5 bg-white/20 rounded-lg text-white">
                        {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            {/* Turn indicator */}
            {currentPlayer && (
                <div className={`px-3 py-1.5 text-center font-black text-sm ${isMyTurn ? 'bg-yellow-400 text-gray-900' : 'bg-white/10 text-white'}`}>
                    {isMyTurn ? '🎯 دورك! اضغط النرد' : `⏳ دور ${currentPlayer.name}`}
                </div>
            )}
            {msg && <div className="px-3 py-1 text-center text-xs font-bold text-yellow-300 bg-yellow-900/30">{msg}</div>}

            {/* Game area */}
            <div className="flex-1 flex flex-col lg:flex-row gap-2 p-2 items-start justify-center overflow-auto">

                {/* Board: base corners + grid */}
                <div className={`${card} rounded-2xl p-2 shadow-xl flex-shrink-0`}>
                    {/* Top row: yellow base | top-path | red base */}
                    <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))` }}>
                        {/* Render all cells */}
                        {Array.from({ length: BOARD_SIZE }, (_, row) =>
                            Array.from({ length: BOARD_SIZE }, (_, col) => {
                                // Replace corner quadrants with base areas
                                const isGreenBase  = row < 6  && col < 6;
                                const isYellowBase = row < 6  && col > 8;
                                const isRedBase    = row > 8  && col > 8;
                                const isBlueBase   = row > 8  && col < 6;

                                if (isGreenBase && row === 0 && col === 0) return (
                                    <div key={`${row}-${col}`} className="col-span-6 row-span-6" style={{ gridColumn: '1/7', gridRow: '1/7' }}>
                                        {renderBase('green')}
                                    </div>
                                );
                                if (isGreenBase  && !(row === 0 && col === 0)) return null;
                                if (isYellowBase && row === 0 && col === 9) return (
                                    <div key={`${row}-${col}`} style={{ gridColumn: '10/16', gridRow: '1/7' }}>
                                        {renderBase('yellow')}
                                    </div>
                                );
                                if (isYellowBase && !(row === 0 && col === 9)) return null;
                                if (isRedBase    && row === 9 && col === 9) return (
                                    <div key={`${row}-${col}`} style={{ gridColumn: '10/16', gridRow: '10/16' }}>
                                        {renderBase('red')}
                                    </div>
                                );
                                if (isRedBase    && !(row === 9 && col === 9)) return null;
                                if (isBlueBase   && row === 9 && col === 0) return (
                                    <div key={`${row}-${col}`} style={{ gridColumn: '1/7', gridRow: '10/16' }}>
                                        {renderBase('blue')}
                                    </div>
                                );
                                if (isBlueBase   && !(row === 9 && col === 0)) return null;

                                return renderCell(BOARD_CELLS[row][col], row, col);
                            })
                        )}
                    </div>
                </div>

                {/* Side panel */}
                <div className="flex flex-col gap-2 w-full lg:w-44 flex-shrink-0">
                    {/* Dice */}
                    <div className={`${card} rounded-2xl p-3 shadow-xl text-center`}>
                        <p className="text-xs font-black text-gray-500 mb-1">النرد</p>
                        <div className="text-5xl mb-2 transition-all">{diceDisplay}</div>
                        {isMyTurn && !gs.diceRolled ? (
                            <button onClick={rollDice}
                                className="w-full py-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-xl font-black text-sm shadow hover:scale-105 active:scale-95 transition-all">
                                🎲 ارمِ!
                            </button>
                        ) : isMyTurn && gs.diceRolled && gs.diceValue ? (
                            <p className="text-xs font-bold text-indigo-600">اختر قطعة للتحريك</p>
                        ) : (
                            <p className="text-xs font-bold text-gray-400">انتظر دورك...</p>
                        )}
                    </div>

                    {/* Players */}
                    <div className={`${card} rounded-2xl p-3 shadow-xl`}>
                        <p className="text-xs font-black text-gray-500 mb-2">اللاعبون</p>
                        <div className="space-y-1.5">
                            {ludoPlayers.map((p, i) => {
                                const isCurrent = gs.currentPlayerIndex === i;
                                const isDone    = p.pieces.every(x => x >= 56);
                                return (
                                    <div key={p.id} className={`flex items-center gap-2 p-1.5 rounded-xl border-2 transition-all ${isCurrent ? `${COLORS[p.color].border} bg-opacity-10` : 'border-transparent'}`}>
                                        <div className={`w-6 h-6 rounded-full ${COLORS[p.color].bg} flex items-center justify-center text-white font-black text-[10px] flex-shrink-0`}>
                                            {isDone ? '✓' : i + 1}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[11px] font-black text-gray-800 truncate">{p.name} {p.id === myId && '(أنت)'}</p>
                                            <p className="text-[9px] text-gray-400">{p.pieces.filter(x => x >= 56).length}/4</p>
                                        </div>
                                        {isCurrent && <span className="text-yellow-500 text-xs animate-pulse">🎯</span>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <button onClick={onExit} className="text-xs font-bold text-white/60 hover:text-white/90 py-1 text-center">← الصالة</button>
                </div>
            </div>
        </div>
    );
}
