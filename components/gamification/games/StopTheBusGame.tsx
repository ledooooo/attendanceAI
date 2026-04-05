import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CheckCircle, XCircle, Flag, Users, Trophy, Timer, Crown, Star, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';

// ─── Constants ────────────────────────────────────────────────────────────────
const TIMER_SECS = 120; // 2 minutes
const MAX_PLAYERS = 10;

// ─── Categories ──────────────────────────────────────────────────────────────
const CATEGORIES = [
  { key: 'male',    label: 'اسم ذكر',     emoji: '👨' },
  { key: 'female',  label: 'اسم أنثى',    emoji: '👩' },
  { key: 'plant',   label: 'نبات',         emoji: '🌿' },
  { key: 'food',    label: 'أكلة',         emoji: '🍽️' },
  { key: 'object',  label: 'جماد',         emoji: '📦' },
  { key: 'animal',  label: 'حيوان',        emoji: '🐾' },
  { key: 'country', label: 'بلد',          emoji: '🌍' },
  { key: 'famous',  label: 'مشهور',        emoji: '⭐' },
];

type Answers = Record<string, string>;
type Evaluation = Record<string, number>; // playerId -> score

type PlayerRecord = {
  playerId:   string;
  playerName: string;
  answers:    Answers;
  stopped:    boolean;
  stoppedAt:  number;
};

type GameState = {
  letter:        string;
  startedAt:     number;
  records:       PlayerRecord[];
  evaluations:   Evaluation;
  evaluatedBy:   string | null;
  isEvaluated:   boolean;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function pickLetter() {
  const LETTERS = ['أ','ب','ت','ث','ج','ح','خ','د','ذ','ر','ز','س','ش','ص','ض','ط','ظ','ع','غ','ف','ق','ك','ل','م','ن','ه','و','ي'];
  return LETTERS[Math.floor(Math.random() * LETTERS.length)];
}

function emptyAnswers(): Answers {
  return Object.fromEntries(CATEGORIES.map(c => [c.key, '']));
}

function validCount(answers: Answers, letter: string): number {
  return Object.values(answers).filter(v =>
    v.trim().startsWith(letter) && v.trim().length > 1
  ).length;
}

// ─── Timer Ring Component ────────────────────────────────────────────────────
function TimerRing({ seconds, total }: { seconds: number; total: number }) {
  const r = 26, circ = 2 * Math.PI * r;
  const color = seconds <= 20 ? '#ef4444' : seconds <= 45 ? '#f97316' : '#22c55e';

  return (
    <div className="relative w-14 h-14 flex items-center justify-center flex-shrink-0">
      <svg width={56} height={56} viewBox="0 0 56 56" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={28} cy={28} r={r} fill="none" stroke="#e5e7eb" strokeWidth={4.5}/>
        <circle cx={28} cy={28} r={r} fill="none" stroke={color} strokeWidth={4.5}
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - seconds / total)}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.4s' }}/>
      </svg>
      <span className={`absolute text-xs font-black ${seconds <= 20 ? 'text-red-600 animate-pulse' : seconds <= 45 ? 'text-orange-600' : 'text-green-700'}`}>
        {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
      </span>
    </div>
  );
}

// ─── Answer Form Component ──────────────────────────────────────────────────
function AnswerForm({ letter, answers, onChange, disabled }: {
  letter: string; answers: Answers;
  onChange: (key: string, val: string) => void;
  disabled: boolean;
}) {
  const filled = validCount(answers, letter);

  return (
    <div className="space-y-1.5">
      {CATEGORIES.map(cat => {
        const val = answers[cat.key] ?? '';
        const valid = val.trim().startsWith(letter) && val.trim().length > 1;
        const has = val.trim().length > 0;

        return (
          <div key={cat.key} className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all ${
            valid ? 'border-green-400 bg-green-50' :
            has ? 'border-orange-300 bg-orange-50' :
            'border-gray-200 bg-white'
          }`}>
            <span className="text-base flex-shrink-0">{cat.emoji}</span>
            <span className="text-[11px] font-black text-gray-500 w-14 flex-shrink-0">{cat.label}</span>
            <input
              type="text"
              value={val}
              onChange={e => onChange(cat.key, e.target.value)}
              disabled={disabled}
              placeholder={`يبدأ بـ "${letter}"`}
              dir="rtl"
              className="flex-1 text-sm font-bold bg-transparent outline-none text-gray-800 placeholder:text-gray-300 disabled:opacity-50 min-w-0"
            />
            {valid && <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0"/>}
            {!valid && has && <XCircle className="w-4 h-4 text-orange-400 flex-shrink-0"/>}
          </div>
        );
      })}
      <div className="flex items-center justify-between px-1 pt-0.5">
        <span className="text-[11px] font-bold text-gray-400">{filled}/{CATEGORIES.length} صحيح</span>
        <div className="flex gap-1">
          {CATEGORIES.map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full ${i < filled ? 'bg-green-400' : 'bg-gray-200'}`}/>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Waiting Room Component ──────────────────────────────────────────────────
function WaitingRoom({
  players,
  myId,
  isHost,
  onStart,
  onLeave,
  gameCode
}: {
  players: { id: string; name: string }[];
  myId: string;
  isHost: boolean;
  onStart: () => void;
  onLeave: () => void;
  gameCode: string;
}) {
  return (
    <div className="text-center py-6 px-4">
      <div className="w-24 h-24 bg-gradient-to-br from-violet-500 to-purple-700 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-2xl">
        <span className="text-5xl">🚌</span>
      </div>

      <h3 className="text-2xl font-black text-gray-800 mb-1">أوتوبيس كومبليت!</h3>
      <p className="text-sm font-bold text-gray-400 mb-2">كود الغرفة: <span className="text-violet-600 font-black">{gameCode}</span></p>

      <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-black text-gray-700">
            <Users className="w-4 h-4 inline ml-1"/>
            اللاعبين ({players.length}/{MAX_PLAYERS})
          </p>
        </div>

        <div className="flex flex-wrap gap-2 justify-center">
          {players.map((p, index) => (
            <div
              key={p.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all ${
                p.id === myId
                  ? 'bg-violet-100 border-violet-400'
                  : 'bg-white border-gray-200'
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                index === 0 ? 'bg-amber-400 text-white' : 'bg-violet-100 text-violet-700'
              }`}>
                {index === 0 ? <Crown className="w-4 h-4" /> : index + 1}
              </div>
              <span className={`text-sm font-bold ${
                p.id === myId ? 'text-violet-700' : 'text-gray-700'
              }`}>
                {p.name}
                {p.id === myId && <span className="text-xs text-violet-400 mr-1">(أنت)</span>}
              </span>
              {index === 0 && <Star className="w-4 h-4 text-amber-500" />}
            </div>
          ))}

          {/* Empty slots */}
          {Array.from({ length: Math.min(MAX_PLAYERS - players.length, 3) }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50"
            >
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <UserPlus className="w-4 h-4 text-gray-400" />
              </div>
              <span className="text-sm font-bold text-gray-400">في انتظار...</span>
            </div>
          ))}
        </div>
      </div>

      {isHost ? (
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={onStart}
            disabled={players.length < 1}
            className="bg-gradient-to-r from-violet-500 to-purple-700 text-white px-10 py-4 rounded-2xl font-black text-lg shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🎲 ابدأ اللعبة ({players.length} لاعب)
          </button>
          {players.length < 1 && (
            <p className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl">
              ⏳ في انتظار اللاعبين...
            </p>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 justify-center text-sm font-bold text-gray-400 bg-gray-50 rounded-xl py-3">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-violet-500 rounded-full animate-spin"/>
          في انتظار المضيف لبدء اللعبة...
        </div>
      )}

      <button
        onClick={onLeave}
        className="mt-4 text-sm font-bold text-gray-400 hover:text-gray-600"
      >
        ← مغادرة الغرفة
      </button>
    </div>
  );
}

// ─── Results Table Component ─────────────────────────────────────────────────
function ResultsTable({
  records,
  letter,
  evaluations,
  isHost,
  onEvaluate,
  onStartEvaluation,
  isEvaluated
}: {
  records: PlayerRecord[];
  letter: string;
  evaluations: Evaluation;
  isHost: boolean;
  isEvaluated: boolean;
  onEvaluate: (playerId: string, score: number) => void;
  onStartEvaluation: () => void;
}) {
  // Calculate total scores
  const calculateTotal = (playerId: string): number => {
    if (!evaluations[playerId]) return 0;
    return Object.values(evaluations[playerId] as Record<string, number>).reduce((sum, val) => sum + val, 0);
  };

  const totalEvaluations = evaluations ? Object.keys(evaluations).length : 0;
  const allEvaluated = records.length > 0 && totalEvaluations === records.length;

  return (
    <div className="space-y-4">
      {/* Table Header */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-violet-500 to-purple-600 text-white">
                <th className="px-3 py-3 text-right font-black text-xs sticky left-0 bg-violet-600 z-10">
                  <Users className="w-4 h-4 inline ml-1"/>
                  اللاعب
                </th>
                {CATEGORIES.map(cat => (
                  <th key={cat.key} className="px-2 py-3 text-center font-black text-xs min-w-[80px]">
                    {cat.emoji} {cat.label}
                  </th>
                ))}
                <th className="px-3 py-3 text-center font-black text-xs bg-violet-700">
                  <Trophy className="w-4 h-4 inline ml-1"/>
                  المجموع
                </th>
              </tr>
            </thead>
            <tbody>
              {records.map((record, index) => {
                const isMe = false; // We can add this if needed
                return (
                  <tr
                    key={record.playerId}
                    className={`border-b border-gray-100 last:border-0 ${
                      record.stopped ? 'bg-green-50' : 'bg-white'
                    }`}
                  >
                    <td className="px-3 py-2 sticky left-0 bg-inherit z-10">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0 ? 'bg-amber-400 text-white' : 'bg-violet-100 text-violet-700'
                        }`}>
                          {index === 0 ? '👑' : index + 1}
                        </div>
                        <span className="font-bold text-gray-800">
                          {record.playerName}
                          {record.stopped && <span className="text-green-500 mr-1">✓</span>}
                        </span>
                      </div>
                    </td>
                    {CATEGORIES.map(cat => {
                      const val = record.answers[cat.key]?.trim() ?? '';
                      const valid = val.startsWith(letter) && val.length > 1;
                      const catScore = evaluations[record.playerId]?.[cat.key];

                      return (
                        <td key={cat.key} className="px-2 py-2 text-center min-w-[80px]">
                          {val ? (
                            <div className="space-y-1">
                              <span className={`text-xs font-bold block ${
                                valid ? 'text-gray-800' : 'text-red-500 line-through'
                              }`}>
                                {val}
                              </span>
                              {isHost && !isEvaluated && (
                                <div className="flex gap-1 justify-center">
                                  {[10, 5, 0].map(score => (
                                    <button
                                      key={score}
                                      onClick={() => onEvaluate(record.playerId, score)}
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                                        catScore === score
                                          ? score === 10 ? 'bg-green-500 text-white'
                                          : score === 5 ? 'bg-yellow-500 text-white'
                                          : 'bg-red-500 text-white'
                                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                      }`}
                                    >
                                      {score}
                                    </button>
                                  ))}
                                </div>
                              )}
                              {isEvaluated && catScore !== undefined && (
                                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                                  catScore === 10 ? 'bg-green-100 text-green-700' :
                                  catScore === 5 ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-red-100 text-red-700'
                                }`}>
                                  {catScore}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )
                        );
                      })}
                    </td>
                    <td className="px-3 py-2 text-center bg-gray-50">
                      <span className="font-black text-violet-700">
                        {calculateTotal(record.playerId)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Evaluation Status */}
      {isHost && !isEvaluated && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 text-center">
          <p className="text-sm font-black text-amber-800 mb-2">
            <Star className="w-4 h-4 inline ml-1"/>
            أنت المضيف - قيّم إجابات اللاعبين
          </p>
          <p className="text-xs text-amber-600 mb-3">
            اضغط على 10 للإجابة الصحيحة، 5 للإجابة المقبولة، 0 للخاطئة
          </p>
          {allEvaluated && (
            <div className="bg-green-100 text-green-800 rounded-xl py-2 px-4 inline-block">
              ✓ تم تقييم كل الإجابات
            </div>
          )}
        </div>
      )}

      {/* Final Scores */}
      {isEvaluated && (
        <div className="bg-gradient-to-r from-violet-500 to-purple-600 rounded-2xl p-4 text-white text-center">
          <p className="font-black text-lg mb-2">🏆 الترتيب النهائي</p>
          <div className="space-y-2">
            {[...records]
              .sort((a, b) => calculateTotal(b.playerId) - calculateTotal(a.playerId))
              .map((record, index) => (
                <div
                  key={record.playerId}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl ${
                    index === 0 ? 'bg-amber-400 text-amber-900' :
                    index === 1 ? 'bg-gray-200 text-gray-700' :
                    index === 2 ? 'bg-amber-700 text-amber-100' :
                    'bg-white/20'
                  }`}
                >
                  <span className="font-bold">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                    {' '}{record.playerName}
                  </span>
                  <span className="font-black">{calculateTotal(record.playerId)} نقطة</span>
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function StopTheBusGame() {
  const [gameState, setGameState] = useState<'menu' | 'join' | 'waiting' | 'playing' | 'finished'>('menu');
  const [players, setPlayers] = useState<{ id: string; name: string }[]>([]);
  const [myId, setMyId] = useState('');
  const [gameCode, setGameCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [hostName, setHostName] = useState('');

  // Game state
  const [letter, setLetter] = useState('');
  const [answers, setAnswers] = useState<Answers>(emptyAnswers());
  const [timeLeft, setTimeLeft] = useState(TIMER_SECS);
  const [stopped, setStopped] = useState(false);
  const [records, setRecords] = useState<PlayerRecord[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation>({});
  const [isEvaluated, setIsEvaluated] = useState(false);
  const [startedAt, setStartedAt] = useState(0);

  const prevTickRef = useRef(TIMER_SECS);
  const soundedStop = useRef(false);
  const savedOnStop = useRef(false);

  // Simulate other players joining (for demo)
  const [simulatedPlayers, setSimulatedPlayers] = useState<{ id: string; name: string }[]>([]);

  // Is this player the host?
  const isHost = players.length > 0 && [...players].sort((a, b) => a.id.localeCompare(b.id))[0]?.id === myId;

  // ── Join/Create Room ──────────────────────────────────────────────────────────
  const handleCreateRoom = () => {
    if (!hostName.trim()) {
      toast.error('أدخل اسمك أولاً');
      return;
    }
    const newId = 'host_' + Math.random().toString(36).substr(2, 9);
    const code = Math.random().toString(36).substr(2, 6).toUpperCase();

    setMyId(newId);
    setGameCode(code);
    setPlayers([{ id: newId, name: hostName.trim() }]);
    setGameState('waiting');
    toast.success(`تم إنشاء الغرفة! كود: ${code}`);
  };

  const handleJoinRoom = () => {
    if (!playerName.trim()) {
      toast.error('أدخل اسمك أولاً');
      return;
    }
    if (!joinCode.trim()) {
      toast.error('أدخل كود الغرفة');
      return;
    }

    const newId = 'player_' + Math.random().toString(36).substr(2, 9);
    setMyId(newId);
    setGameCode(joinCode.toUpperCase());

    // Simulate joining (in real app, this would connect to server)
    setPlayers(prev => [...prev, { id: newId, name: playerName.trim() }]);
    setGameState('waiting');
    toast.success('تم الانضمام للغرفة!');
  };

  // ── Start Game ──────────────────────────────────────────────────────────────
  const handleStart = () => {
    const newLetter = pickLetter();
    setLetter(newLetter);
    setStartedAt(Date.now());
    setGameState('playing');
    toast.success(`حرف الجولة: ${newLetter}`);
  };

  // ── Timer ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (gameState !== 'playing' || !startedAt) return;

    const tick = () => {
      const left = Math.max(0, TIMER_SECS - Math.floor((Date.now() - startedAt) / 1000));
      setTimeLeft(left);

      if ([30, 20, 10, 5, 4, 3, 2, 1].includes(left) && left !== prevTickRef.current) {
        prevTickRef.current = left;
        // Play tick sound
      }

      if (left === 0 && !savedOnStop.current && !stopped) {
        savedOnStop.current = true;
        handleTimerEnd();
      }
    };

    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [gameState, startedAt]);

  const handleTimerEnd = useCallback(() => {
    saveMyAnswers(false);
  }, [answers, records, players, myId, stopped]);

  // ── Save Answers ─────────────────────────────────────────────────────────────
  const saveMyAnswers = (iAmStopper: boolean) => {
    if (stopped) return;

    setStopped(true);

    const record: PlayerRecord = {
      playerId: myId,
      playerName: players.find(p => p.id === myId)?.name || 'لاعب',
      answers: { ...answers },
      stopped: iAmStopper,
      stoppedAt: Date.now(),
    };

    const updatedRecords = [...records.filter(r => r.playerId !== myId), record];
    setRecords(updatedRecords);

    // Check if all players have submitted
    if (updatedRecords.length >= players.length) {
      setTimeout(() => {
        setGameState('finished');
      }, 1000);
    }
  };

  // ── Stop Button ─────────────────────────────────────────────────────────────
  const handleStop = () => {
    if (stopped) return;
    saveMyAnswers(true);
  };

  // ── Evaluate Answer ─────────────────────────────────────────────────────────
  const handleEvaluate = (playerId: string, score: number) => {
    // Find which category is being evaluated based on current selection
    // For simplicity, we'll evaluate all unanswered categories at once
    setEvaluations(prev => {
      const playerEval = prev[playerId] || {};
      const playerRecord = records.find(r => r.playerId === playerId);
      if (!playerRecord) return prev;

      // Get categories that haven't been evaluated yet for this player
      const evaluatedCats = Object.keys(playerEval);
      const nextCat = CATEGORIES.find(c => !evaluatedCats.includes(c.key));

      if (!nextCat) return prev;

      return {
        ...prev,
        [playerId]: {
          ...playerEval,
          [nextCat.key]: score,
        }
      };
    });
  };

  // ── Complete Evaluation ─────────────────────────────────────────────────────
  const handleCompleteEvaluation = () => {
    setIsEvaluated(true);
    toast.success('تم تقييم جميع الإجابات!');
  };

  // ── Add Simulated Player (Demo) ─────────────────────────────────────────────
  const addSimulatedPlayer = () => {
    if (simulatedPlayers.length >= MAX_PLAYERS - 1) {
      toast.error('الغرفة ممتلئة!');
      return;
    }

    const names = ['أحمد', 'محمد', 'فاطمة', 'عمر', 'سارة', 'يوسف', 'نورة', 'خالد', 'ليلى', 'عبدالله'];
    const randomName = names[Math.floor(Math.random() * names.length)] + ' ' + Math.floor(Math.random() * 100);
    const newId = 'sim_' + Math.random().toString(36).substr(2, 9);

    const newPlayer = { id: newId, name: randomName };
    setSimulatedPlayers(prev => [...prev, newPlayer]);
    setPlayers(prev => [...prev, newPlayer]);
    toast.success(`${randomName} انضم للغرفة!`);
  };

  // ── Add Simulated Records (Demo) ─────────────────────────────────────────────
  const addSimulatedRecord = () => {
    const simPlayer = simulatedPlayers.find(p => !records.find(r => r.playerId === p.id));
    if (!simPlayer) return;

    const sampleAnswers: Answers = {
      male: letter ? String.fromCharCode(letter.charCodeAt(0) + 1) + 'حمد' : 'أحمد',
      female: 'أمينة',
      plant: 'ليمون',
      food: 'كبسة',
      object: 'كتاب',
      animal: 'قطة',
      country: 'مصر',
      famous: 'عمرو دياب',
    };

    const record: PlayerRecord = {
      playerId: simPlayer.id,
      playerName: simPlayer.name,
      answers: sampleAnswers,
      stopped: false,
      stoppedAt: Date.now(),
    };

    setRecords(prev => [...prev, record]);

    if (records.length + 1 >= players.length) {
      setTimeout(() => {
        setGameState('finished');
      }, 1000);
    }
  };

  // ── Menu Screen ─────────────────────────────────────────────────────────────
  if (gameState === 'menu') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-100 via-purple-50 to-indigo-100 p-4 flex items-center justify-center">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-32 h-32 bg-gradient-to-br from-violet-500 to-purple-700 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-2xl">
              <span className="text-6xl">🚌</span>
            </div>
            <h1 className="text-3xl font-black text-gray-800 mb-2">أوتوبيس كومبليت!</h1>
            <p className="text-gray-500 font-bold">لعبة الجماعات</p>
          </div>

          <div className="bg-white rounded-3xl shadow-xl p-6 space-y-4">
            {/* Create Room */}
            <div className="space-y-3">
              <h3 className="text-lg font-black text-gray-800 text-center">🏠 إنشاء غرفة جديدة</h3>
              <input
                type="text"
                value={hostName}
                onChange={e => setHostName(e.target.value)}
                placeholder="أدخل اسمك"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-violet-400 outline-none text-right font-bold"
                dir="rtl"
              />
              <button
                onClick={handleCreateRoom}
                className="w-full bg-gradient-to-r from-violet-500 to-purple-700 text-white py-4 rounded-2xl font-black text-lg shadow-xl hover:scale-105 active:scale-95 transition-all"
              >
                🎲 إنشاء غرفة
              </button>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-gray-200"/>
              <span className="text-gray-400 text-sm font-bold">أو</span>
              <div className="flex-1 h-px bg-gray-200"/>
            </div>

            {/* Join Room */}
            <div className="space-y-3">
              <h3 className="text-lg font-black text-gray-800 text-center">🔗 الانضمام لغرفة</h3>
              <input
                type="text"
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                placeholder="أدخل اسمك"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-violet-400 outline-none text-right font-bold"
                dir="rtl"
              />
              <input
                type="text"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                placeholder="أدخل كود الغرفة"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-violet-400 outline-none text-center font-black text-xl tracking-widest"
                maxLength={6}
              />
              <button
                onClick={handleJoinRoom}
                className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl hover:scale-105 active:scale-95 transition-all"
              >
                🚪 انضم للغرفة
              </button>
            </div>
          </div>

          <p className="text-center text-gray-400 text-xs mt-4">
            {MAX_PLAYERS} لاعبين كحد أقصى
          </p>
        </div>
      </div>
    );
  }

  // ── Waiting Room ─────────────────────────────────────────────────────────────
  if (gameState === 'waiting') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-100 via-purple-50 to-indigo-100 p-4">
        <WaitingRoom
          players={players}
          myId={myId}
          isHost={isHost}
          onStart={handleStart}
          onLeave={() => setGameState('menu')}
          gameCode={gameCode}
        />

        {/* Demo: Add simulated players */}
        {isHost && gameState === 'waiting' && (
          <div className="max-w-md mx-auto mt-4 bg-white rounded-2xl p-4 shadow-lg">
            <p className="text-xs text-center text-gray-500 mb-2">🔧 للتجربة (إضافة لاعبين وهميين):</p>
            <div className="flex gap-2">
              <button
                onClick={addSimulatedPlayer}
                className="flex-1 bg-violet-100 text-violet-700 py-2 rounded-xl font-bold text-sm hover:bg-violet-200 transition-all"
              >
                + إضافة لاعب
              </button>
              <button
                onClick={addSimulatedRecord}
                className="flex-1 bg-green-100 text-green-700 py-2 rounded-xl font-bold text-sm hover:bg-green-200 transition-all"
              >
                + محاكاة إجابة
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Playing ─────────────────────────────────────────────────────────────────
  if (gameState === 'playing') {
    const filledCount = validCount(answers, letter);
    const myRecord = records.find(r => r.playerId === myId);

    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-100 via-purple-50 to-indigo-100 p-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-700 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-3xl font-black text-white">{letter}</span>
              </div>
              <div>
                <p className="text-sm font-black text-gray-700">حرف الجولة</p>
                <p className="text-xs text-gray-400">
                  {stopped ? '✅ انتهيت' : `${filledCount}/${CATEGORIES.length} صحيحة`}
                </p>
              </div>
            </div>
            <TimerRing seconds={timeLeft} total={TIMER_SECS}/>
          </div>

          {/* Players status */}
          <div className="bg-white rounded-xl p-3 mb-4 shadow-sm">
            <p className="text-xs font-bold text-gray-500 mb-2">
              <Users className="w-3 h-3 inline ml-1"/>
              اللاعبون ({records.length}/{players.length} أتموا)
            </p>
            <div className="flex flex-wrap gap-2">
              {players.map((p, i) => {
                const done = !!records.find(r => r.playerId === p.id);
                return (
                  <div key={p.id} className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                    done ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {done ? '✓' : '⏳'} {p.name}
                  </div>
                );
              })}
            </div>
          </div>

          {stopped ? (
            <div className="bg-white rounded-2xl p-6 shadow-lg text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-3"/>
              <p className="font-black text-xl text-gray-800 mb-2">تم حفظ إجاباتك! ✓</p>
              <p className="text-sm text-gray-400 mb-4">في انتظار اللاعبين الآخرين...</p>

              <div className="space-y-2">
                {players.map(p => {
                  const done = !!records.find(r => r.playerId === p.id);
                  return (
                    <div key={p.id} className={`flex items-center justify-between px-4 py-2 rounded-xl ${
                      done ? 'bg-green-50' : 'bg-gray-50'
                    }`}>
                      <span className="font-bold text-sm">{p.name}</span>
                      <span className={`text-xs font-bold ${done ? 'text-green-600' : 'text-gray-400'}`}>
                        {done ? '✓ أتم' : '⏳ ينتظر'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
              <AnswerForm
                letter={letter}
                answers={answers}
                onChange={(key, val) => setAnswers(prev => ({ ...prev, [key]: val }))}
                disabled={stopped}
              />

              <button
                onClick={handleStop}
                className="w-full mt-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Flag className="w-5 h-5"/>
                🛑 خلصت! أوقف الأتوبيس
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Finished ─────────────────────────────────────────────────────────────────
  if (gameState === 'finished') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-100 via-purple-50 to-indigo-100 p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Header */}
          <div className="bg-gradient-to-br from-violet-500 to-purple-700 text-white rounded-2xl p-4 text-center">
            <div className="text-4xl mb-2">🚌</div>
            <h3 className="font-black text-2xl mb-1">انتهت الجولة!</h3>
            <p className="text-purple-100">
              حرف الجولة: <span className="text-3xl font-black text-white mx-1">{letter}</span>
            </p>
          </div>

          {/* Results Table */}
          <ResultsTable
            records={records}
            letter={letter}
            evaluations={evaluations}
            isHost={isHost}
            onEvaluate={handleEvaluate}
            onStartEvaluation={handleCompleteEvaluation}
            isEvaluated={isEvaluated}
          />

          {/* Complete Evaluation Button */}
          {isHost && !isEvaluated && (
            <button
              onClick={handleCompleteEvaluation}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl hover:scale-105 active:scale-95 transition-all"
            >
              ✓ إنهاء التقييم وعرض النتائج
            </button>
          )}

          {/* Back to Menu */}
          <button
            onClick={() => {
              setGameState('menu');
              setPlayers([]);
              setRecords([]);
              setEvaluations({});
              setIsEvaluated(false);
              setStopped(false);
              setAnswers(emptyAnswers());
              setTimeLeft(TIMER_SECS);
              setSimulatedPlayers([]);
            }}
            className="w-full bg-white text-gray-700 py-3 rounded-2xl font-bold shadow-lg hover:bg-gray-50 transition-all"
          >
            ← العودة للقائمة الرئيسية
          </button>
        </div>
      </div>
    );
  }

  return null;
}
