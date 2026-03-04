import React from 'react';
import { supabase } from '../../../supabaseClient';
import { Trophy, Hand, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Employee } from '../../../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function checkXOWinner(board: string[]): string | 'draw' | null {
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (const [a,b,c] of lines) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
    }
    if (!board.includes(null as any)) return 'draw';
    return null;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
    match: any;
    employee: Employee;
    onExit: () => void;
    grantPoints: (pts: number) => Promise<void>;
    handleRewardSelection: (difficulty: 'easy' | 'medium' | 'hard', pts: number, timeLimit: number) => Promise<void>;
    handleRewardAnswer: (answer: string) => Promise<void>;
    timeLeft: number | null;
    loading: boolean;
}

export default function XOGame({
    match, employee, onExit,
    handleRewardSelection, handleRewardAnswer,
    timeLeft, loading,
}: Props) {
    const me       = match.players?.find((p: any) => p.id === employee.employee_id);
    const opponent = match.players?.find((p: any) => p.id !== employee.employee_id);
    const amIWinner = match.winner_id === employee.employee_id;
    const status: string = match.status;

    const handleCellClick = async (index: number) => {
        if (status !== 'playing') return;
        if (match.game_state?.current_turn !== employee.employee_id) return toast.error('ليس دورك!');
        if (match.game_state?.board[index] !== null) return;

        const newBoard = [...match.game_state.board];
        newBoard[index] = me?.symbol;
        const winner = checkXOWinner(newBoard);
        let newStatus = 'playing', winnerId = null;
        if (winner === 'draw')  newStatus = 'finished';
        else if (winner) { newStatus = 'reward_time'; winnerId = winner === me?.symbol ? me?.id : opponent?.id; }

        await supabase.from('live_matches').update({
            game_state: { board: newBoard, current_turn: opponent?.id },
            status: newStatus,
            winner_id: winnerId,
        }).eq('id', match.id);
    };

    // ── PLAYING ───────────────────────────────────────────────────────────────
    if (status === 'playing') return (
        <div className="grid grid-cols-3 gap-2 bg-white p-3 rounded-3xl shadow-2xl border border-gray-100 w-full max-w-[280px] aspect-square">
            {match.game_state.board.map((cell: string, idx: number) => (
                <button key={idx} onClick={() => handleCellClick(idx)}
                    disabled={cell !== null || match.game_state.current_turn !== employee.employee_id}
                    className={`rounded-xl text-4xl font-black flex items-center justify-center transition-all ${
                        !cell ? 'bg-gray-50 hover:bg-gray-100 active:scale-95' :
                        cell === 'X' ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-50 text-rose-500'
                    }`}>
                    {cell && <span className="animate-in zoom-in spin-in-12">{cell}</span>}
                </button>
            ))}
        </div>
    );

    // ── REWARD TIME ───────────────────────────────────────────────────────────
    if (status === 'reward_time') return (
        <div className="bg-white w-full max-w-sm rounded-3xl p-5 text-center shadow-2xl animate-in zoom-in mx-2">
            {amIWinner ? (
                <>
                    <Trophy className="w-20 h-20 text-yellow-400 mx-auto mb-4 drop-shadow-xl animate-bounce"/>
                    <h3 className="text-2xl font-black text-gray-800 mb-1">أنت الفائز! 🎉</h3>
                    <p className="text-gray-500 font-bold text-sm mb-5">اختر تحدي السؤال:</p>
                    <div className="space-y-2">
                        <button onClick={() => handleRewardSelection('easy',   5, 10)} disabled={loading} className="w-full bg-green-50  border-2 border-green-100  text-green-700  p-3 rounded-xl font-bold flex justify-between items-center hover:bg-green-100  transition-all text-sm"><span>سهل (10ث)</span><span>+5 نقاط</span></button>
                        <button onClick={() => handleRewardSelection('medium',10, 20)} disabled={loading} className="w-full bg-yellow-50 border-2 border-yellow-100 text-yellow-700 p-3 rounded-xl font-bold flex justify-between items-center hover:bg-yellow-100 transition-all text-sm"><span>متوسط (20ث)</span><span>+10 نقاط</span></button>
                        <button onClick={() => handleRewardSelection('hard',  15, 30)} disabled={loading} className="w-full bg-red-50    border-2 border-red-100    text-red-700    p-3 rounded-xl font-bold flex justify-between items-center hover:bg-red-100    transition-all text-sm"><span>صعب (30ث)</span><span>+15 نقطة</span></button>
                    </div>
                </>
            ) : (
                <div className="py-8">
                    <span className="text-6xl mb-4 block grayscale">😞</span>
                    <h3 className="text-xl font-black text-gray-800">حظ أوفر!</h3>
                    <button onClick={onExit} className="mt-8 bg-gray-100 px-8 py-3 rounded-xl font-bold text-gray-600 w-full">خروج</button>
                </div>
            )}
        </div>
    );

    // ── ANSWERING REWARD ──────────────────────────────────────────────────────
    if (status === 'answering_reward') return (
        <div className="bg-white w-full max-w-sm rounded-3xl p-5 text-center shadow-2xl animate-in zoom-in mx-2 relative">
            {amIWinner ? (
                <>
                    <div className="absolute top-4 left-4 flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-black text-sm">
                        ⏱ {timeLeft}
                    </div>
                    <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4 mt-2">
                        <span className="text-2xl">🧠</span>
                    </div>
                    <h3 className="text-base font-black text-gray-800 mb-4 px-2">{match.final_question?.questionText}</h3>
                    <div className="grid grid-cols-1 gap-2">
                        {match.final_question?.options.map((opt: string, idx: number) => (
                            <button key={idx} onClick={() => handleRewardAnswer(opt)} disabled={loading}
                                className="w-full bg-white border-2 border-gray-100 p-3 rounded-xl font-bold text-gray-700 hover:border-indigo-500 hover:bg-indigo-50 active:scale-95 transition-all text-sm">
                                {opt}
                            </button>
                        ))}
                    </div>
                </>
            ) : (
                <div className="py-10">
                    <Loader2 className="w-10 h-10 text-indigo-300 animate-spin mx-auto mb-4"/>
                    <h3 className="text-lg font-black text-gray-800">الفائز يجيب الآن...</h3>
                    <button onClick={onExit} className="mt-6 bg-gray-100 px-8 py-2.5 rounded-xl font-bold text-gray-600 text-sm">خروج</button>
                </div>
            )}
        </div>
    );

    // ── FINISHED ──────────────────────────────────────────────────────────────
    if (status === 'finished') return (
        <div className="bg-white w-full max-w-xs rounded-3xl p-8 text-center shadow-2xl animate-in zoom-in mx-2">
            {match.winner_id
                ? <><Trophy className="w-20 h-20 text-green-500 mx-auto mb-4"/><h3 className="text-xl font-black text-gray-800 mb-2">انتهت اللعبة!</h3></>
                : <><Hand className="w-20 h-20 text-gray-400 mx-auto mb-4"/><h3 className="text-xl font-black text-gray-800 mb-2">تعادل! 🤝</h3><p className="text-gray-500 font-bold text-sm mb-4">لا فائز ولا أسئلة في التعادل.</p></>
            }
            <button onClick={onExit} className="mt-4 bg-indigo-600 text-white w-full py-3 rounded-xl font-black hover:bg-indigo-700 shadow-xl">
                العودة للصالة
            </button>
        </div>
    );

    return null;
}
