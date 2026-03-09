import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import { Trophy, Hand, Loader2, WifiOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { Employee } from '../../../types';

// ─── Constants ────────────────────────────────────────────────────────────────
const MOVE_TIMER_SECS = 30;
const OFFLINE_CLOSE_SECS = 30;

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function checkXOWinner(board: string[]): string | 'draw' | null {
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (const [a,b,c] of lines) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
    }
    if (!board.includes(null as any)) return 'draw';
    return null;
}

// ─── Audio ────────────────────────────────────────────────────────────────────
function useSound() {
    const ctx = useRef<AudioContext | null>(null);
    const get = () => {
        if (!ctx.current) ctx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        return ctx.current;
    };
    return useCallback((type: 'tick' | 'timeout') => {
        try {
            const ac = get(), now = ac.currentTime;
            if (type === 'tick') {
                const o = ac.createOscillator(), g = ac.createGain();
                o.connect(g); g.connect(ac.destination);
                o.type = 'sine'; o.frequency.value = 880;
                g.gain.setValueAtTime(0.1, now);
                g.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
                o.start(now); o.stop(now + 0.07);
            }
            if (type === 'timeout') {
                [330, 220].forEach((f, i) => {
                    const o = ac.createOscillator(), g = ac.createGain();
                    o.connect(g); g.connect(ac.destination);
                    o.type = 'sine'; o.frequency.value = f;
                    const t = now + i * 0.2;
                    g.gain.setValueAtTime(0.18, t);
                    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
                    o.start(t); o.stop(t + 0.25);
                });
            }
        } catch (_) {}
    }, []);
}

// ─── Move Timer Ring ──────────────────────────────────────────────────────────
function MoveTimerRing({ seconds, urgent }: { seconds: number; urgent: boolean }) {
    const r = 18, circ = 2 * Math.PI * r;
    const color = seconds <= 5 ? '#ef4444' : seconds <= 10 ? '#f97316' : '#6366f1';
    return (
        <div className="relative w-10 h-10 flex items-center justify-center">
            <svg width={40} height={40} viewBox="0 0 40 40" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={20} cy={20} r={r} fill="none" stroke="#e5e7eb" strokeWidth={3}/>
                <circle cx={20} cy={20} r={r} fill="none" stroke={color} strokeWidth={3}
                    strokeDasharray={circ}
                    strokeDashoffset={circ * (1 - seconds / MOVE_TIMER_SECS)}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}/>
            </svg>
            <span className={`absolute text-[10px] font-black ${urgent ? 'text-red-600 animate-pulse' : 'text-indigo-700'}`}>
                {seconds}
            </span>
        </div>
    );
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
    const play     = useSound();
    const me       = match.players?.find((p: any) => p.id === employee.employee_id);
    const opponent = match.players?.find((p: any) => p.id !== employee.employee_id);
    const amIWinner = match.winner_id === employee.employee_id;
    const status: string = match.status;

    // ── Move timer ────────────────────────────────────────────────────────────
    const [moveTimer, setMoveTimer] = useState(MOVE_TIMER_SECS);
    const [offlineCountdown, setOfflineCountdown] = useState<number | null>(null);
    const [opponentOffline, setOpponentOffline] = useState(false);
    const prevTurnRef = useRef<string | null>(null);
    const timerPlayedRef = useRef<Set<number>>(new Set());

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

    // Countdown
    useEffect(() => {
        if (status !== 'playing') return;
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
    }, [match.game_state?.current_turn, status]);

    // Offline close countdown
    useEffect(() => {
        if (offlineCountdown === null) return;
        if (offlineCountdown <= 0) {
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

    const isMyTurn = match.game_state?.current_turn === employee.employee_id;

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
        <div className="flex flex-col gap-2 w-full max-w-[300px] items-center">

            {/* Offline alert */}
            {opponentOffline && (
                <div className="bg-red-50 border-2 border-red-300 rounded-2xl px-3 py-2 flex items-center gap-2 w-full animate-in slide-in-from-top">
                    <WifiOff className="w-4 h-4 text-red-500 flex-shrink-0"/>
                    <div className="flex-1">
                        <p className="text-xs font-black text-red-700">{opponent?.name || 'المنافس'} غير متصل!</p>
                        <p className="text-[10px] text-red-400 font-bold">تغلق خلال {offlineCountdown}ث</p>
                    </div>
                    <span className="text-sm font-black text-red-600 bg-red-100 w-7 h-7 rounded-full flex items-center justify-center">{offlineCountdown}</span>
                </div>
            )}

            {/* Turn + Timer row */}
            <div className="flex items-center justify-between w-full px-1">
                <div className={`text-xs font-black px-3 py-1.5 rounded-full border ${
                    isMyTurn ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-gray-50 border-gray-200 text-gray-400'
                }`}>
                    {isMyTurn ? '← دورك!' : `دور ${opponent?.name || '...'}`}
                </div>
                <MoveTimerRing seconds={moveTimer} urgent={moveTimer <= 5}/>
            </div>

            {/* Board */}
            <div className="grid grid-cols-3 gap-2 bg-white p-3 rounded-3xl shadow-2xl border border-gray-100 w-full aspect-square">
                {match.game_state.board.map((cell: string, idx: number) => (
                    <button key={idx} onClick={() => handleCellClick(idx)}
                        disabled={cell !== null || match.game_state.current_turn !== employee.employee_id}
                        className={`rounded-xl text-4xl font-black flex items-center justify-center transition-all ${
                            !cell
                                ? isMyTurn
                                    ? 'bg-gray-50 hover:bg-indigo-50 hover:scale-105 active:scale-95'
                                    : 'bg-gray-50'
                                : cell === 'X'
                                    ? 'bg-indigo-50 text-indigo-600'
                                    : 'bg-rose-50 text-rose-500'
                        }`}>
                        {cell && <span className="animate-in zoom-in spin-in-12">{cell}</span>}
                    </button>
                ))}
            </div>
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
