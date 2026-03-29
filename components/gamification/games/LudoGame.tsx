import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { supabase } from './lib/supabase';

interface Player {
  id: string;
  name: string;
  color: 'green' | 'yellow' | 'red' | 'blue';
  pieces: number[];
  isAI: boolean;
  isEliminated: boolean;
}

interface GameState {
  id: string;
  status: 'waiting' | 'playing' | 'finished';
  currentPlayerIndex: number;
  players: Player[];
  diceValue: number | null;
  diceRolled: boolean;
  winner: string | null;
  difficulty: 'easy' | 'medium' | 'hard';
  settings: {
    darkMode: boolean;
    soundEnabled: boolean;
  };
  lastMove: { playerId: string; pieceIndex: number; from: number; to: number } | null;
}

interface CellInfo {
  type: 'path' | 'start' | 'home' | 'safe' | 'center';
  color?: 'green' | 'yellow' | 'red' | 'blue';
  index?: number;
  homeIndex?: number;
}

const BOARD_SIZE = 15;
const SAFE_ZONES = [0, 8, 13, 21, 26, 34, 39, 47]; // Safe squares on the board

const COLORS = {
  green: { bg: 'bg-green-500', bgDark: 'bg-green-600', light: 'bg-green-300', text: 'text-green-600', hex: '#22c55e' },
  yellow: { bg: 'bg-yellow-500', bgDark: 'bg-yellow-600', light: 'bg-yellow-300', text: 'text-yellow-600', hex: '#eab308' },
  red: { bg: 'bg-red-500', bgDark: 'bg-red-600', light: 'bg-red-300', text: 'text-red-600', hex: '#ef4444' },
  blue: { bg: 'bg-blue-500', bgDark: 'bg-blue-600', light: 'bg-blue-300', text: 'text-blue-600', hex: '#3b82f6' },
};

const PLAYER_NAMES = ['أخضر', 'أصفر', 'أحمر', 'أزرق'];
const PLAYER_COLORS: ('green' | 'yellow' | 'red' | 'blue')[] = ['green', 'yellow', 'red', 'blue'];

// Generate the board cells
const generateBoardCells = (): CellInfo[][] => {
  const cells: CellInfo[][] = [];
  const pathOrder = [
    // Outer ring - clockwise from green start
    [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
    [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
    [0, 7],
    [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
    [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
    [7, 14],
    [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
    [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
    [14, 7],
    [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
    [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
    [7, 0],
  ];

  for (let i = 0; i < BOARD_SIZE; i++) {
    cells[i] = [];
    for (let j = 0; j < BOARD_SIZE; j++) {
      cells[i][j] = { type: 'path', index: -1 };
    }
  }

  // Mark path cells
  pathOrder.forEach((pos, idx) => {
    cells[pos[0]][pos[1]] = { type: 'path', index: idx };
  });

  // Mark safe zones
  [0, 8, 13, 21, 26, 34, 39, 47].forEach(idx => {
    const pos = pathOrder[idx];
    cells[pos[0]][pos[1]] = { type: 'safe', index: idx };
  });

  // Home bases (corners)
  cells[0][0] = { type: 'start', color: 'green' };
  cells[0][14] = { type: 'start', color: 'yellow' };
  cells[14][14] = { type: 'start', color: 'red' };
  cells[14][0] = { type: 'start', color: 'blue' };

  // Home columns
  // Green home (going right)
  for (let i = 0; i < 6; i++) {
    cells[7][i] = { type: 'home', color: 'green', homeIndex: i };
  }
  // Yellow home (going down)
  for (let i = 0; i < 6; i++) {
    cells[i][7] = { type: 'home', color: 'yellow', homeIndex: i };
  }
  // Red home (going left)
  for (let i = 0; i < 6; i++) {
    cells[7][14 - i] = { type: 'home', color: 'red', homeIndex: i };
  }
  // Blue home (going up)
  for (let i = 0; i < 6; i++) {
    cells[14 - i][7] = { type: 'home', color: 'blue', homeIndex: i };
  }

  // Center
  cells[7][7] = { type: 'center' };

  return cells;
};

const PATH_ORDER = [
  [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  [0, 7],
  [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  [7, 14],
  [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  [14, 7],
  [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  [7, 0],
];

// Start positions for each color
const START_POSITIONS: Record<string, number> = {
  green: 0,
  yellow: 13,
  red: 26,
  blue: 39,
};

// Home entry positions (51 is the goal, each color enters home column before that)
const HOME_ENTRY: Record<string, number> = {
  green: 50,
  yellow: 11,
  red: 24,
  blue: 37,
};

// Calculate position on path for a piece
const getPositionOnPath = (color: string, pathIndex: number): [number, number] | null => {
  if (pathIndex < 0) return null;
  if (pathIndex >= 52) return [7, 7]; // Center (finished)
  
  // Home column positions
  if (pathIndex >= 52) {
    const homeIdx = pathIndex - 52;
    switch (color) {
      case 'green': return [7, 5 - homeIdx];
      case 'yellow': return [homeIdx + 1, 7];
      case 'red': return [7, 9 + homeIdx];
      case 'blue': return [13 - homeIdx, 7];
      default: return null;
    }
  }
  
  return PATH_ORDER[pathIndex] || null;
};

// Calculate the path index for a piece based on its current position
const calculatePathIndex = (color: string, pieces: number[]): number[] => {
  return pieces.map(piece => {
    if (piece < 0) return -1; // In base
    if (piece >= 56) return 52; // Finished (at center)
    
    const startPos = START_POSITIONS[color];
    const actualPos = (startPos + piece) % 52;
    return actualPos;
  });
};

const LudoGame: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [playerColor, setPlayerColor] = useState<'green' | 'yellow' | 'red' | 'blue' | null>(null);
  const [boardCells, setBoardCells] = useState<CellInfo[][]>(() => generateBoardCells());
  const [showConfetti, setShowConfetti] = useState(false);
  const [lastDiceRoll, setLastDiceRoll] = useState<number | null>(null);
  const [animatingPieces, setAnimatingPieces] = useState<Set<string>>(new Set());
  const [showRewardQuestion, setShowRewardQuestion] = useState(false);
  const [rewardQuestion, setRewardQuestion] = useState<{ question: string; correct: string; options: string[] } | null>(null);
  const [selectedPiece, setSelectedPiece] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  
  const audioContext = useRef<AudioContext | null>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const diceRolledRef = useRef(false);

  // Keep ref in sync
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Initialize audio
  const initAudio = useCallback(() => {
    if (!audioContext.current) {
      audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }, []);

  // Play sound
  const playSound = useCallback((type: 'dice' | 'move' | 'capture' | 'win' | 'lose' | 'click') => {
    if (!gameState?.settings.soundEnabled) return;
    initAudio();
    
    const ctx = audioContext.current;
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    switch (type) {
      case 'dice':
        oscillator.frequency.value = 300;
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.1);
        break;
      case 'move':
        oscillator.frequency.value = 400;
        gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.05);
        break;
      case 'capture':
        oscillator.type = 'sawtooth';
        oscillator.frequency.value = 200;
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.3);
        break;
      case 'win':
        const notes = [523, 659, 784, 1047];
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.15);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.3);
          osc.start(ctx.currentTime + i * 0.15);
          osc.stop(ctx.currentTime + i * 0.15 + 0.3);
        });
        return;
      case 'lose':
        oscillator.frequency.value = 150;
        gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.5);
        break;
      case 'click':
        oscillator.frequency.value = 500;
        gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.03);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.03);
        break;
    }
  }, [gameState?.settings.soundEnabled, initAudio]);

  // Fire confetti
  const fireConfetti = useCallback((color?: string) => {
    if (!gameState?.settings.darkMode) {
      const colors = color ? [COLORS[color as keyof typeof COLORS].hex] : ['#22c55e', '#eab308', '#ef4444', '#3b82f6'];
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors,
      });
    }
  }, [gameState?.settings.darkMode]);

  // Generate reward question
  const generateRewardQuestion = useCallback(() => {
    const questions = [
      { q: 'ماهو لون السماء؟', options: ['أزرق', 'أخضر', 'أحمر', 'أصفر'], correct: 'أزرق' },
      { q: 'كم عدد أيام الأسبوع؟', options: ['5', '6', '7', '8'], correct: '7' },
      { q: 'ماهو أكبر كوكب في مجموعتنا الشمسية؟', options: ['المريخ', 'الأرض', 'المشتري', 'زحل'], correct: 'المشتري' },
      { q: 'ماهو الحيوان الذي يطير؟', options: ['القط', 'الكلب', 'الخفاش', 'السمك'], correct: 'الخفاش' },
      { q: 'كم عدد ألوان قوس قزح؟', options: ['5', '6', '7', '8'], correct: '7' },
      { q: 'ماهو أطول نهر في العالم؟', options: ['الأمازون', 'النيل', 'الدانوب', 'الس复活ني'], correct: 'النيل' },
    ];
    const q = questions[Math.floor(Math.random() * questions.length)];
    setRewardQuestion({ question: q.q, options: q.options, correct: q.correct });
    setShowRewardQuestion(true);
  }, []);

  // Create room
  const createRoom = async () => {
    if (!playerName.trim()) {
      setMessage('الرجاء إدخال اسمك');
      return;
    }

    setIsCreating(true);
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newState: GameState = {
      id: code,
      status: 'waiting',
      currentPlayerIndex: 0,
      players: [
        { id: 'local', name: playerName, color: 'green', pieces: [-1, -1, -1, -1], isAI: false, isEliminated: false },
      ],
      diceValue: null,
      diceRolled: false,
      winner: null,
      difficulty: 'medium',
      settings: { darkMode: true, soundEnabled: true },
      lastMove: null,
    };

    const { error } = await supabase.from('ludo_games').insert({
      id: code,
      status: 'waiting',
      data: newState,
    });

    if (error) {
      setMessage('حدث خطأ في إنشاء الغرفة');
      setIsCreating(false);
      return;
    }

    setRoomCode(code);
    setPlayerColor('green');
    setGameState(newState);
    setIsCreating(false);
    setMessage('');
  };

  // Join room
  const joinRoom = async () => {
    if (!playerName.trim()) {
      setMessage('الرجاء إدخال اسمك');
      return;
    }
    if (!roomCode.trim()) {
      setMessage('الرجاء إدخال رمز الغرفة');
      return;
    }

    setIsJoining(true);

    const { data, error } = await supabase
      .from('ludo_games')
      .select('data')
      .eq('id', roomCode.toUpperCase())
      .single();

    if (error || !data) {
      setMessage('الغرفة غير موجودة');
      setIsJoining(false);
      return;
    }

    const state: GameState = data.data;
    
    // Find available color
    const usedColors = state.players.map(p => p.color);
    const availableColor = PLAYER_COLORS.find(c => !usedColors.includes(c));
    
    if (!availableColor) {
      setMessage('الغرفة ممتلئة');
      setIsJoining(false);
      return;
    }

    const newPlayer: Player = {
      id: 'local',
      name: playerName,
      color: availableColor,
      pieces: [-1, -1, -1, -1],
      isAI: false,
      isEliminated: false,
    };

    state.players.push(newPlayer);

    await supabase
      .from('ludo_games')
      .update({ data: state, status: state.players.length >= 2 ? 'playing' : 'waiting' })
      .eq('id', roomCode.toUpperCase());

    setPlayerColor(availableColor);
    setGameState(state);
    setIsJoining(false);
    setMessage('');
  };

  // Roll dice
  const rollDice = async () => {
    if (!gameState || gameState.diceRolled || !playerColor) return;
    
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (currentPlayer.color !== playerColor) {
      setMessage('ليس دورك');
      return;
    }

    diceRolledRef.current = true;
    playSound('dice');
    
    // Animate dice
    let rollCount = 0;
    const rollInterval = setInterval(() => {
      setLastDiceRoll(Math.floor(Math.random() * 6) + 1);
      rollCount++;
      if (rollCount >= 10) {
        clearInterval(rollInterval);
      }
    }, 50);

    setTimeout(async () => {
      const value = Math.floor(Math.random() * 6) + 1;
      setLastDiceRoll(value);
      playSound('dice');

      let newState = { ...gameState, diceValue: value, diceRolled: true };

      // Check if player can move any piece
      const movablePieces = getMovablePieces(currentPlayer, value);
      
      if (movablePieces.length === 0) {
        // No valid moves, pass turn
        setTimeout(() => {
          nextTurn();
        }, 1000);
      } else if (movablePieces.length === 1) {
        // Auto-move if only one option
        await movePiece(movablePieces[0], value);
      } else {
        setMessage('اختر قطعة للتحريك');
      }

      setGameState(newState);
    }, 600);
  };

  // Get movable pieces
  const getMovablePieces = (player: Player, diceValue: number): number[] => {
    const movable: number[] = [];
    
    player.pieces.forEach((piece, idx) => {
      if (piece < 0 && diceValue === 6) {
        // Can bring piece out of base
        movable.push(idx);
      } else if (piece >= 0 && piece < 56) {
        // Can move on board
        const newPos = piece + diceValue;
        if (newPos <= 56) {
          movable.push(idx);
        }
      }
    });

    return movable;
  };

  // Move piece
  const movePiece = async (pieceIndex: number, diceValue: number) => {
    if (!gameState) return;

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const oldPos = currentPlayer.pieces[pieceIndex];
    const pieceKey = `${currentPlayer.color}-${pieceIndex}`;
    
    // Add animation
    setAnimatingPieces(prev => new Set([...prev, pieceKey]));

    let newPos: number;
    let capturedPiece = false;

    if (oldPos < 0 && diceValue === 6) {
      // Bring out of base
      newPos = 0;
    } else {
      newPos = oldPos + diceValue;
    }

    // Check for capture (only on path squares, not safe zones or home columns)
    if (newPos < 52) {
      const pathIdx = (START_POSITIONS[currentPlayer.color] + newPos) % 52;
      
      // Check if it's a safe zone
      if (!SAFE_ZONES.includes(pathIdx)) {
        gameState.players.forEach((otherPlayer, otherIdx) => {
          if (otherIdx !== gameState.currentPlayerIndex && !otherPlayer.isEliminated) {
            otherPlayer.pieces.forEach((otherPiece, otherPieceIdx) => {
              if (otherPiece >= 0 && otherPiece < 52) {
                const otherPathIdx = (START_POSITIONS[otherPlayer.color] + otherPiece) % 52;
                if (otherPathIdx === pathIdx) {
                  // Capture!
                  otherPlayer.pieces[otherPieceIdx] = -1;
                  capturedPiece = true;
                  playSound('capture');
                  fireConfetti(currentPlayer.color);
                }
              }
            });
          }
        });
      }
    }

    currentPlayer.pieces[pieceIndex] = newPos;
    playSound('move');

    // Check for win (all pieces at center)
    if (currentPlayer.pieces.every(p => p >= 56)) {
      currentPlayer.isEliminated = true; // Mark as finished
      fireConfetti(currentPlayer.color);
      playSound('win');
      
      if (gameState.players.filter(p => !p.isEliminated).length === 1) {
        const winner = gameState.players.find(p => !p.isEliminated);
        gameState.winner = winner?.id || null;
        gameState.status = 'finished';
        setShowConfetti(true);
      }
    }

    setGameState({ ...gameState });
    
    setTimeout(() => {
      setAnimatingPieces(prev => {
        const next = new Set(prev);
        next.delete(pieceKey);
        return next;
      });
    }, 500);

    // Generate reward question on 6
    if (diceValue === 6 && Math.random() > 0.5) {
      setTimeout(() => {
        generateRewardQuestion();
      }, 600);
    }

    // Reset and next turn
    setTimeout(() => {
      if (diceValue === 6 && !capturedPiece) {
        // Roll again on 6 (unless captured)
        setGameState(prev => prev ? { ...prev, diceValue: null, diceRolled: false } : null);
        diceRolledRef.current = false;
        setMessage('لفة أخرى!');
      } else {
        nextTurn();
      }
    }, 800);
  };

  // Next turn
  const nextTurn = () => {
    if (!gameState) return;

    let nextIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
    let attempts = 0;
    
    // Skip eliminated players
    while (gameState.players[nextIndex].isEliminated && attempts < gameState.players.length) {
      nextIndex = (nextIndex + 1) % gameState.players.length;
      attempts++;
    }

    setGameState({
      ...gameState,
      currentPlayerIndex: nextIndex,
      diceValue: null,
      diceRolled: false,
    });
    diceRolledRef.current = false;
    setSelectedPiece(null);
    setMessage('');
  };

  // Handle piece selection
  const handlePieceClick = (pieceIndex: number) => {
    if (!gameState || !gameState.diceRolled || gameState.diceValue === null) return;
    
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (currentPlayer.color !== playerColor) return;

    const movable = getMovablePieces(currentPlayer, gameState.diceValue);
    if (movable.includes(pieceIndex)) {
      movePiece(pieceIndex, gameState.diceValue);
    }
  };

  // Handle reward question answer
  const handleRewardAnswer = async (answer: string) => {
    if (!rewardQuestion) return;

    setShowRewardQuestion(false);

    if (answer === rewardQuestion.correct) {
      fireConfetti();
      playSound('win');
      setMessage('إجابة صحيحة! مكافأة: لفة إضافية');
      
      // Give extra roll
      setGameState(prev => prev ? { ...prev, diceRolled: false, diceValue: null } : null);
      diceRolledRef.current = false;
    } else {
      setMessage('إجابة خاطئة');
      nextTurn();
    }

    setRewardQuestion(null);
  };

  // Render cell
  const renderCell = (cell: CellInfo, row: number, col: number) => {
    const baseClasses = 'w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-xs sm:text-sm font-bold border';
    
    if (cell.type === 'start') {
      return (
        <div key={`${row}-${col}`} className={`${baseClasses} ${COLORS[cell.color!].bg} text-white border-gray-600 rounded-lg`}>
          🏠
        </div>
      );
    }

    if (cell.type === 'home') {
      return (
        <div key={`${row}-${col}`} className={`${baseClasses} ${COLORS[cell.color!].light} ${COLORS[cell.color!].text} border-gray-300 rounded`}>
          {cell.homeIndex !== undefined && <span className="text-xs">{cell.homeIndex + 1}</span>}
        </div>
      );
    }

    if (cell.type === 'center') {
      return (
        <div key={`${row}-${col}`} className={`${baseClasses} bg-gradient-to-br from-yellow-400 to-orange-500 text-white border-orange-600 rounded-full`}>
          ⭐
        </div>
      );
    }

    if (cell.type === 'safe') {
      return (
        <div key={`${row}-${col}`} className={`${baseClasses} bg-gray-200 ${gameState?.settings.darkMode ? 'bg-gray-700' : ''} border-gray-400 rounded`}>
          ⬟
        </div>
      );
    }

    if (cell.type === 'path' && cell.index !== undefined) {
      // Check for pieces on this cell
      const piecesOnCell: { color: string; pieceIndex: number }[] = [];
      gameState?.players.forEach(player => {
        const pathIndices = calculatePathIndex(player.color, player.pieces);
        pathIndices.forEach((pathIdx, pieceIdx) => {
          if (pathIdx === cell.index) {
            piecesOnCell.push({ color: player.color, pieceIndex: pieceIdx });
          }
        });
      });

      return (
        <div
          key={`${row}-${col}`}
          className={`${baseClasses} bg-white ${gameState?.settings.darkMode ? 'bg-gray-800' : ''} border-gray-300 rounded-sm relative`}
        >
          {piecesOnCell.map((piece, idx) => (
            <div
              key={idx}
              className={`absolute w-5 h-5 sm:w-6 sm:h-6 ${COLORS[piece.color as keyof typeof COLORS].bg} rounded-full border-2 border-white flex items-center justify-center text-white text-xs shadow-lg transition-all duration-300 ${
                animatingPieces.has(`${piece.color}-${piece.pieceIndex}`) ? 'scale-125 animate-bounce' : ''
              }`}
              style={{
                top: idx * 2 + 2,
                left: idx * 2 + 2,
              }}
              onClick={() => {
                if (gameState?.players[gameState.currentPlayerIndex].color === playerColor && 
                    gameState.diceRolled && 
                    gameState.players[gameState.currentPlayerIndex].color === piece.color) {
                  handlePieceClick(piece.pieceIndex);
                }
              }}
            >
              {piece.pieceIndex + 1}
            </div>
          ))}
        </div>
      );
    }

    return (
      <div key={`${row}-${col}`} className={`${baseClasses} ${gameState?.settings.darkMode ? 'bg-gray-900' : 'bg-gray-100'} border-transparent`}>
      </div>
    );
  };

  // Render base area
  const renderBase = (color: 'green' | 'yellow' | 'red' | 'blue') => {
    const player = gameState?.players.find(p => p.color === color);
    const pieces = player?.pieces.filter(p => p < 0) || [];

    return (
      <div className={`p-2 rounded-lg ${COLORS[color].bg} flex flex-col items-center gap-1`}>
        <div className={`text-white text-xs font-bold`}>{PLAYER_NAMES[PLAYER_COLORS.indexOf(color)]}</div>
        <div className="grid grid-cols-2 gap-1">
          {[0, 1, 2, 3].map(idx => {
            const inBase = player?.pieces[idx] !== undefined && player.pieces[idx] < 0;
            return (
              <div
                key={idx}
                className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full ${COLORS[color].light} border-2 border-white flex items-center justify-center text-xs font-bold cursor-pointer transition-all ${
                  inBase ? 'opacity-100' : 'opacity-30'
                } ${
                  animatingPieces.has(`${color}-${idx}`) ? 'animate-bounce scale-110' : ''
                }`}
                onClick={() => {
                  if (inBase && gameState?.diceValue === 6 && gameState.diceRolled && player?.color === playerColor) {
                    handlePieceClick(idx);
                  }
                }}
              >
                {idx + 1}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render player info
  const renderPlayerInfo = (color: 'green' | 'yellow' | 'red' | 'blue', index: number) => {
    const player = gameState?.players[index];
    if (!player) return null;

    const isCurrentPlayer = gameState?.currentPlayerIndex === index;
    const isYou = player.color === playerColor;

    return (
      <div
        key={color}
        className={`p-3 rounded-lg ${COLORS[color].bgDark} ${isCurrentPlayer ? 'ring-4 ring-yellow-400' : ''} transition-all`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-white font-bold">{player.name}</span>
            {isYou && <span className="text-xs bg-white/20 px-2 py-0.5 rounded text-white">(أنت)</span>}
            {player.isAI && <span className="text-xs bg-white/20 px-2 py-0.5 rounded text-white">(كمبيوتر)</span>}
          </div>
          {isCurrentPlayer && (
            <span className="text-yellow-300 text-sm animate-pulse">🎯 دورك</span>
          )}
        </div>
        <div className="flex gap-1 mt-2">
          {player.pieces.map((piece, idx) => (
            <div
              key={idx}
              className={`w-6 h-6 rounded-full ${COLORS[color].light} flex items-center justify-center text-xs font-bold ${
                piece >= 56 ? 'bg-yellow-400' : ''
              }`}
            >
              {piece >= 56 ? '✓' : piece < 0 ? '·' : piece}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Toggle dark mode
  const toggleDarkMode = () => {
    if (!gameState) return;
    const newState = { ...gameState, settings: { ...gameState.settings, darkMode: !gameState.settings.darkMode } };
    setGameState(newState);
    supabase.from('ludo_games').update({ data: newState }).eq('id', gameState.id);
  };

  // Toggle sound
  const toggleSound = () => {
    if (!gameState) return;
    const newState = { ...gameState, settings: { ...gameState.settings, soundEnabled: !gameState.settings.soundEnabled } };
    setGameState(newState);
    supabase.from('ludo_games').update({ data: newState }).eq('id', gameState.id);
  };

  // Main menu
  if (!gameState) {
    return (
      <div className={`min-h-screen ${gameState?.settings.darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-500 to-purple-600'} p-4`}>
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">🎲 لعبة اللودو</h1>
            <p className="text-white/80">-four players -</p>
          </div>

          <div className="bg-white/10 backdrop-blur rounded-2xl p-6 space-y-4">
            <input
              type="text"
              placeholder="اسمك"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full p-3 rounded-lg bg-white/20 text-white placeholder-white/60 border border-white/30 focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />

            <button
              onClick={createRoom}
              disabled={isCreating}
              className="w-full p-3 bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white rounded-lg font-bold transition-all"
            >
              {isCreating ? 'جاري الإنشاء...' : '🏠 إنشاء غرفة جديدة'}
            </button>

            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-white/30"></div>
              <span className="text-white/60 text-sm">أو</span>
              <div className="flex-1 h-px bg-white/30"></div>
            </div>

            <input
              type="text"
              placeholder="رمز الغرفة"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              className="w-full p-3 rounded-lg bg-white/20 text-white placeholder-white/60 border border-white/30 focus:outline-none focus:ring-2 focus:ring-yellow-400 text-center font-mono text-lg"
            />

            <button
              onClick={joinRoom}
              disabled={isJoining}
              className="w-full p-3 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg font-bold transition-all"
            >
              {isJoining ? 'جاري الانضمام...' : '🚪 انضم لغرفة'}
            </button>

            {message && (
              <div className="text-red-300 text-center text-sm">{message}</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Waiting room
  if (gameState.status === 'waiting') {
    return (
      <div className={`min-h-screen ${gameState.settings.darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-500 to-purple-600'} p-4`}>
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">🏠 غرفة اللودو</h1>
            <p className="text-white/80">رمز الغرفة: <span className="font-mono text-2xl">{roomCode}</span></p>
          </div>

          <div className="bg-white/10 backdrop-blur rounded-2xl p-6 space-y-4">
            <h2 className="text-white text-xl font-bold">اللاعبون ({gameState.players.length}/4)</h2>
            
            {PLAYER_COLORS.map(color => {
              const player = gameState.players.find(p => p.color === color);
              return (
                <div key={color} className={`p-3 rounded-lg ${COLORS[color].bgDark} ${player ? '' : 'opacity-50'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{player ? '✅' : '⏳'}</span>
                    <span className="text-white font-bold">{player?.name || PLAYER_NAMES[PLAYER_COLORS.indexOf(color)]}</span>
                  </div>
                </div>
              );
            })}

            {message && (
              <div className="text-red-300 text-center text-sm">{message}</div>
            )}

            {playerColor && (
              <button
                onClick={toggleSound}
                className="p-2 bg-white/20 rounded-lg text-white"
              >
                {gameState.settings.soundEnabled ? '🔊 صوت' : '🔇 صامت'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Game finished
  if (gameState.status === 'finished') {
    const winner = gameState.players.find(p => p.id === gameState.winner);

    return (
      <div className={`min-h-screen ${gameState.settings.darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-500 to-purple-600'} p-4`}>
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">🎉 انتهت اللعبة!</h1>
            {winner && (
              <div className={`text-2xl font-bold text-white ${COLORS[winner.color].bg} p-4 rounded-xl mt-4`}>
                🏆 الفائز: {winner.name}
              </div>
            )}
          </div>

          <div className="bg-white/10 backdrop-blur rounded-2xl p-6">
            <h2 className="text-white text-xl font-bold mb-4">الترتيب النهائي</h2>
            {gameState.players.map((player, idx) => (
              <div key={player.id} className={`p-3 rounded-lg mb-2 ${COLORS[player.color].bgDark}`}>
                <span className="text-white font-bold">
                  {idx + 1}. {player.name} {player.id === gameState.winner ? '👑' : ''}
                </span>
              </div>
            ))}

            <button
              onClick={() => {
                setGameState(null);
                setRoomCode('');
                setPlayerColor(null);
              }}
              className="w-full mt-4 p-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold"
            >
              العب مرة أخرى
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Playing game
  return (
    <div className={`min-h-screen ${gameState.settings.darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-500 to-purple-600'} p-2 sm:p-4`}>
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl sm:text-2xl font-bold text-white">🎲 اللودو</h1>
          <div className="flex gap-2">
            <button
              onClick={toggleSound}
              className="p-2 bg-white/20 rounded-lg text-white hover:bg-white/30"
            >
              {gameState.settings.soundEnabled ? '🔊' : '🔇'}
            </button>
            <button
              onClick={toggleDarkMode}
              className="p-2 bg-white/20 rounded-lg text-white hover:bg-white/30"
            >
              {gameState.settings.darkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </div>

        {message && (
          <div className="text-center text-yellow-300 font-bold mb-2">{message}</div>
        )}
      </div>

      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-4">
        {/* Board */}
        <div className="flex-shrink-0">
          <div className={`p-2 rounded-2xl ${gameState.settings.darkMode ? 'bg-gray-800' : 'bg-white'} shadow-xl`}>
            <div className="grid grid-cols-15 gap-0.5" style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))` }}>
              {boardCells.map((row, rowIdx) =>
                row.map((cell, colIdx) => renderCell(cell, rowIdx, colIdx))
              )}
            </div>
          </div>
        </div>

        {/* Side panel */}
        <div className="flex-1 space-y-4">
          {/* Players */}
          <div className={`p-4 rounded-2xl ${gameState.settings.darkMode ? 'bg-gray-800' : 'bg-white'} shadow-xl`}>
            <h2 className="text-lg font-bold mb-3 text-gray-800 dark:text-white">اللاعبون</h2>
            <div className="grid grid-cols-2 gap-2">
              {PLAYER_COLORS.map((color, idx) => renderPlayerInfo(color, idx))}
            </div>
          </div>

          {/* Dice */}
          <div className={`p-4 rounded-2xl ${gameState.settings.darkMode ? 'bg-gray-800' : 'bg-white'} shadow-xl text-center`}>
            <h2 className="text-lg font-bold mb-3 text-gray-800 dark:text-white">النرد</h2>
            <div 
              className={`text-6xl mb-4 ${lastDiceRoll ? 'animate-spin' : ''}`}
              onAnimationEnd={() => setLastDiceRoll(gameState.diceValue)}
            >
              {lastDiceRoll ? ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][lastDiceRoll - 1] : '🎲'}
            </div>
            
            {gameState.players[gameState.currentPlayerIndex]?.color === playerColor && !gameState.diceRolled && (
              <button
                onClick={rollDice}
                className="px-8 py-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-xl font-bold text-lg hover:scale-105 transition-transform shadow-lg"
              >
                🎲 ادبح!
              </button>
            )}
            
            {gameState.diceRolled && (
              <div className="text-green-500 font-bold">
                الرقم: {gameState.diceValue}
              </div>
            )}
          </div>

          {/* Color indicator */}
          <div className={`p-4 rounded-2xl ${gameState.settings.darkMode ? 'bg-gray-800' : 'bg-white'} shadow-xl text-center`}>
            <div className={`inline-block w-8 h-8 rounded-full ${COLORS[playerColor!].bg} border-4 border-white shadow-lg`}></div>
            <p className="text-gray-800 dark:text-white mt-2 font-bold">
              أنت: {PLAYER_NAMES[PLAYER_COLORS.indexOf(playerColor!)]}
            </p>
          </div>
        </div>
      </div>

      {/* Reward Question Modal */}
      {showRewardQuestion && rewardQuestion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`${gameState.settings.darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl p-6 max-w-sm w-full`}>
            <h3 className="text-xl font-bold mb-4 text-center text-gray-800 dark:text-white">
              🎁 سؤال المكافأة!
            </h3>
            <p className="text-lg mb-4 text-center text-gray-700 dark:text-gray-200">
              {rewardQuestion.question}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {rewardQuestion.options.map(option => (
                <button
                  key={option}
                  onClick={() => handleRewardAnswer(option)}
                  className={`p-3 rounded-lg font-bold transition-all ${
                    gameState.settings.darkMode
                      ? 'bg-gray-700 text-white hover:bg-gray-600'
                      : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Confetti overlay */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-40">
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-3 h-3 rounded-full animate-bounce"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                backgroundColor: ['#22c55e', '#eab308', '#ef4444', '#3b82f6'][Math.floor(Math.random() * 4)],
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${1 + Math.random() * 2}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default LudoGame;
