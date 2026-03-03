import React, { useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import { Loader2, Trophy, Hand } from 'lucide-react';
import toast from 'react-hot-toast';
import { Employee } from '../../../types';

const ROWS = 6;
const COLS = 7;
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
    return null; // column full
}

function checkWinner(board: Board): Cell | 'draw' | null {
    // rows
    for (let r = 0; r < ROWS; r++)
        for (let c = 0; c <= COLS - 4; c++) {
            const cell = board[r][c];
            if (cell && [1,2,3].every(i => board[r][c+i] === cell)) return cell;
        }
    // cols
    for (let r = 0; r <= ROWS - 4; r++)
        for (let c = 0; c < COLS; c++) {
            const cell = board[r][c];
            if (cell && [1,2,3].every(i => board[r+i][c] === cell)) return cell;
        }
    // diagonal ↘
    for (let r = 0; r <= ROWS - 4; r++)
        for (let c = 0; c <= COLS - 4; c++) {
            const cell = board[r][c];
            if (cell && [1,2,3].every(i => board[r+i][c+i] === cell)) return cell;
        }
    // diagonal ↗
    for (let r = 3; r < ROWS; r++)
        for (let c = 0; c <= COLS - 4; c++) {
            const cell = board[r][c];
            if (cell && [1,2,3].every(i => board[r-i][c+i] === cell)) return cell;
        }
    // draw
    if (board[0].every(c => c !== null)) return 'draw';
    return null;
}

// ─── Board Component ──────────────────────────────────────────────────────────
function BoardGrid({ board, onColClick, disabled, mySymbol }: {
    board: Board;
    onColClick: (col: number) => void;
    disabled: boolean;
    mySymbol: Cell;
}) {
    const [hoverCol, setHoverCol] = React.useState<number | null>(null);

    return (
        <div className="bg-blue-700 rounded-2xl p-2 shadow-2xl inline-block">
            {/* column click targets */}
            <div className="grid mb-1" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: '4px' }}>
                {Array.from({ length: COLS }, (_, c) => (
                    <button key={c}
                        onClick={() => !disabled && onColClick(c)}
                        onMouseEnter={() => setHoverCol(c)}
                        onMouseLeave={() => setHoverCol(null)}
                        disabled={disabled}
                        className="h-5 flex items-center justify-center transition-all">
                        {!disabled && hoverCol === c && (
                            <div className={`w-3 h-3 rounded-full ${mySymbol === 'R' ? 'bg-red-400' : 'bg-yellow-400'} animate-bounce`}/>
                        )}
                    </button>
                ))}
            </div>
            {/* cells */}
            <div className="grid" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: '4px' }}>
                {board.map((row, r) => row.map((cell, c) => (
                    <div key={`${r}-${c}`}
                        className={`w-9 h-9 md:w-11 md:h-11 rounded-full border-2 transition-all duration-300 ${
                            cell === 'R' ? 'bg-red-500 border-red-300 shadow-lg shadow-red-500/50' :
                            cell === 'Y' ? 'bg-yellow-400 border-yellow-200 shadow-lg shadow-yellow-400/50' :
                            'bg-blue-900 border-blue-800'
                        }`}
                    />
                )))}
            </div>
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
    const me = match.players?.find((p: any) => p.id === employee.employee_id);
    const opponent = match.players?.find((p: any) => p.id !== employee.employee_id);

    const board: Board = useMemo(() => {
        return match.game_state?.board ?? emptyBoard();
    }, [match.game_state?.board]);

    const isMyTurn = match.game_state?.current_turn === employee.employee_id;
    const status: string = match.status;
    const amIWinner = match.winner_id === employee.employee_id;

    const handleColClick = async (col: number) => {
        if (!isMyTurn || status !== 'playing') return;
        const nextBoard = dropPiece(board, col, me.symbol as Cell);
        if (!nextBoard) return toast.error('العمود ممتلئ!');

        const winnerSymbol = checkWinner(nextBoard);
        let newStatus = 'playing';
        let winnerId: string | null = null;

        if (winnerSymbol === 'draw') {
            newStatus = 'finished';
        } else if (winnerSymbol) {
            newStatus = 'reward_time';
            winnerId = winnerSymbol === me.symbol ? me.id : opponent?.id;
        }

        await supabase.from('live_matches').update({
            game_state: { board: nextBoard, current_turn: opponent?.id },
            status: newStatus,
            winner_id: winnerId,
        }).eq('id', match.id);
    };

    // ── reward time ──
    const handleRewardSelection = async (pts: number) => {
        await grantPoints(pts);
        await supabase.from('live_matches').update({ status: 'finished' }).eq('id', match.id);
    };

    // ── WAITING ──
    if (status === 'waiting') return (
        <div className="text-center py-10">
            <Loader2 className="w-14 h-14 text-blue-300 animate-spin mx-auto mb-4"/>
            <h3 className="text-xl font-black text-blue-900">في انتظار المنافس...</h3>
            <p className="text-sm font-bold text-gray-400 mt-2">أرسل لزميلك رابط الغرفة وانتظر!</p>
        </div>
    );

    // ── PLAYING ──
    if (status === 'playing') return (
        <div className="flex flex-col items-center gap-4 py-2">
            {/* Turn indicator */}
            <div className={`text-sm font-black px-4 py-2 rounded-xl ${isMyTurn ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {isMyTurn ? '✅ دورك — اختر عموداً!' : `⏳ دور ${opponent?.name || 'المنافس'}...`}
            </div>

            <BoardGrid board={board} onColClick={handleColClick} disabled={!isMyTurn} mySymbol={me?.symbol as Cell}/>

            {/* Legend */}
            <div className="flex gap-4 text-xs font-bold">
                <div className="flex items-center gap-1"><div className="w-4 h-4 rounded-full bg-red-500"/><span>أنت ({me?.name})</span></div>
                {opponent && <div className="flex items-center gap-1"><div className="w-4 h-4 rounded-full bg-yellow-400"/><span>{opponent.name}</span></div>}
            </div>
        </div>
    );

    // ── REWARD TIME ──
    if (status === 'reward_time') return (
        <div className="text-center py-6 animate-in zoom-in">
            {amIWinner ? (
                <>
                    <Trophy className="w-20 h-20 text-yellow-400 mx-auto mb-4 animate-bounce drop-shadow-xl"/>
                    <h3 className="text-2xl font-black text-gray-800 mb-2">فزت بـ Connect 4! 🎉</h3>
                    <p className="text-gray-500 font-bold mb-6">اختر مستوى السؤال لربح النقاط:</p>
                    <div className="space-y-3 max-w-xs mx-auto">
                        <button onClick={() => handleRewardSelection(5)}  className="w-full bg-green-50 border-2 border-green-100 text-green-700 p-3 rounded-2xl font-bold flex justify-between hover:bg-green-100 transition-all"><span>سهل</span><span>+5 نقاط</span></button>
                        <button onClick={() => handleRewardSelection(10)} className="w-full bg-yellow-50 border-2 border-yellow-100 text-yellow-700 p-3 rounded-2xl font-bold flex justify-between hover:bg-yellow-100 transition-all"><span>متوسط</span><span>+10 نقاط</span></button>
                        <button onClick={() => handleRewardSelection(15)} className="w-full bg-red-50 border-2 border-red-100 text-red-700 p-3 rounded-2xl font-bold flex justify-between hover:bg-red-100 transition-all"><span>صعب</span><span>+15 نقطة</span></button>
                    </div>
                </>
            ) : (
                <div className="py-8">
                    <span className="text-6xl block mb-4">😞</span>
                    <h3 className="text-xl font-black text-gray-800">خسرت هذه الجولة</h3>
                    <button onClick={onExit} className="mt-8 bg-gray-100 px-8 py-3 rounded-2xl font-bold text-gray-600 w-full">خروج</button>
                </div>
            )}
        </div>
    );

    // ── FINISHED ──
    if (status === 'finished') return (
        <div className="text-center py-8 animate-in zoom-in">
            {match.winner_id ? (
                <><Trophy className="w-16 h-16 text-green-500 mx-auto mb-4"/><h3 className="text-2xl font-black text-gray-800">انتهت اللعبة!</h3></>
            ) : (
                <><Hand className="w-16 h-16 text-gray-400 mx-auto mb-4"/><h3 className="text-2xl font-black text-gray-800">تعادل! 🤝</h3></>
            )}
            <button onClick={onExit} className="mt-6 bg-blue-600 text-white w-full max-w-xs py-3 rounded-2xl font-black hover:bg-blue-700">العودة للصالة</button>
        </div>
    );

    return null;
}
