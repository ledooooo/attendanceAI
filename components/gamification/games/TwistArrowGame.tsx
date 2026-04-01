import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../../supabaseClient';
import {
  Target, CheckCircle, XCircle, Globe, Volume2, VolumeX, Loader2, ArrowRight,
  Star, Clock, Activity, Zap
} from 'lucide-react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { Employee } from '../../../types';

interface Props {
  onStart: () => Promise<void>;
  onComplete: (points: number, isWin: boolean) => void;
  employee?: Employee;
}

const LEVELS = [
  { id: 'easy', label: 'مبتدئ', pins: 10, speed: 2.2, points: 15, color: 'from-emerald-400 to-teal-500', reverse: false },
  { id: 'medium', label: 'مُتمرس', pins: 14, speed: 3.5, points: 25, color: 'from-blue-500 to-indigo-600', reverse: false },
  { id: 'hard', label: 'خبير ذكاء', pins: 18, speed: 4.5, points: 35, color: 'from-rose-500 to-red-600', reverse: true }
];

const BONUS_LEVELS = [
  { id: 'سهل', points: 5, time: 15 },
  { id: 'متوسط', points: 10, time: 20 },
  { id: 'صعب', points: 15, time: 30 }
];

export default function TwistArrowGame({ onStart, onComplete, employee }: Props) {
  const [phase, setPhase] = useState<'setup' | 'playing' | 'puzzle_solved' | 'loading_quiz' | 'quiz' | 'summary'>('setup');
  const [starting, setStarting] = useState(false);

  // Game Logic
  const [level, setLevel] = useState<typeof LEVELS[0]>(LEVELS[0]);
  const [rotation, setRotation] = useState(0);
  const [attachedPins, setAttachedPins] = useState<number[]>([]); // relative angles
  const [remainingPins, setRemainingPins] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isVibrating, setIsVibrating] = useState(false);

  // Bow & Arrow
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragCurrent, setDragCurrent] = useState({ x: 0, y: 0 });
  const [aimAngle, setAimAngle] = useState(0);
  const [power, setPower] = useState(0);
  const [isFlying, setIsFlying] = useState(false);
  const [flyProgress, setFlyProgress] = useState(0); // 0 to 1
  const [flyAngle, setFlyAngle] = useState(0);
  const bowRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();

  // Audio & Bonus
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [volume, setVolume] = useState(0.5);
  const [language, setLanguage] = useState<'auto' | 'ar' | 'en'>('auto');
  const [totalScore, setTotalScore] = useState(0);
  const [quizQuestion, setQuizQuestion] = useState<any>(null);
  const [selectedBonus, setSelectedBonus] = useState<typeof BONUS_LEVELS[0] | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);

  const requestRef = useRef<number>();
  const handleQuizAnswerRef = useRef<(idx: number) => void>();
  const audioCache = useRef<{ [key: string]: HTMLAudioElement }>({});

  // ─── Audio Helper ─────────────────────────────────────────────────────────
  const playSound = useCallback((type: 'win' | 'lose' | 'hit' | 'tick' | 'select') => {
    if (!soundEnabled) return;
    let url = '';
    switch (type) {
      case 'win': url = '/applause.mp3'; break;
      case 'lose': url = '/fail.mp3'; break;
      case 'hit': url = '/click.mp3'; break;
      case 'tick': url = '/sounds/tick.mp3'; break;
      case 'select': url = '/sounds/select.mp3'; break;
      default: return;
    }
    try {
      let audio = audioCache.current[url];
      if (!audio) {
        audio = new Audio(url);
        audioCache.current[url] = audio;
      }
      audio.volume = volume;
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } catch (e) {}
  }, [soundEnabled, volume]);

  const isMedical = ['بشر', 'أسنان', 'صيدل', 'اسره'].some(s =>
    (employee?.job_title || '').includes(s) || (employee?.specialty || '').includes(s)
  );
  const isEn = language === 'auto' ? isMedical : language === 'en';

  // ─── Game Engine ──────────────────────────────────────────────────────────
  const animateRotation = useCallback(() => {
    if (phase === 'playing' && !isGameOver) {
      setRotation(prev => {
        let speed = level.speed;
        if (level.reverse) {
          const cycle = Math.sin(Date.now() / 1500);
          speed = level.speed * (cycle > 0.5 ? 1.5 : cycle < -0.5 ? -1.5 : 1);
        }
        return (prev + speed) % 360;
      });
      requestRef.current = requestAnimationFrame(animateRotation);
    }
  }, [phase, isGameOver, level]);

  useEffect(() => {
    if (phase === 'playing') requestRef.current = requestAnimationFrame(animateRotation);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [phase, animateRotation]);

  const startGame = async () => {
    setStarting(true);
    try { await onStart(); } catch { setStarting(false); return; }
    setAttachedPins([]);
    setRemainingPins(level.pins);
    setRotation(0);
    setIsGameOver(false);
    setTotalScore(0);
    setPhase('playing');
    setStarting(false);
  };

  // ─── Bow & Arrow Logic ─────────────────────────────────────────────────────
  const handleDragStart = (e: React.PointerEvent) => {
    if (isGameOver || remainingPins <= 0 || phase !== 'playing' || isFlying) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;
    setIsDragging(true);
    setDragStart({ x: startX, y: startY });
    setDragCurrent({ x: startX, y: startY });
    setPower(0);
    setAimAngle(0);
  };

  const handleDragMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    setDragCurrent({ x: currentX, y: currentY });

    // Calculate drag vector from start point
    const dx = currentX - dragStart.x;
    const dy = currentY - dragStart.y;
    // Power is distance limited to max 100px
    const distance = Math.min(Math.sqrt(dx*dx + dy*dy), 100);
    setPower(distance / 100); // 0 to 1

    // Aim angle: direction from drag start to current (relative to screen)
    // We want the angle from the bow center (0,0) toward the drag point, but we'll use the drag direction
    // Actually the angle of the string pull: it's the angle from the bow (origin) to the current drag point
    // The bow is at (0,0) in its local coordinates. The drag start is also (0,0) because we start at bow center? Wait, the drag start is where the finger first touches, which should be at the bow center (the string anchor). But the player may drag anywhere. We'll treat the vector from bow center (0,0) to current drag point as the pull direction.
    // So aimAngle = atan2(dy, dx) in radians, converted to degrees, relative to vertical down (90°)
    let angleRad = Math.atan2(dy, dx);
    let angleDeg = angleRad * 180 / Math.PI;
    // Convert to angle relative to positive X axis (0° right, 90° up) but we want injection angle measured from bottom center (90° down). 
    // The injection will be at 90° (down) minus this angle? Actually easier: The arrow will be shot at angle = (aimAngle from X-axis) relative to the screen, then we compute hit angle as the line from bow to cell center.
    setAimAngle(angleDeg);
  };

  const handleDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (power > 0.1) {
      // Launch arrow
      shootWithBow(aimAngle, power);
    }
    // Reset visual
    setPower(0);
    setAimAngle(0);
  };

  const shootWithBow = (angleDeg: number, powerVal: number) => {
    if (remainingPins <= 0 || isGameOver || isFlying) return;
    // Calculate the absolute injection angle: the direction from bow to cell center
    // Bow is at bottom center, cell center is at top center (relative). The line from bow to cell is vertical (90° down from cell perspective).
    // Actually the bow is at the bottom of the screen, the cell is above. The direction to inject is straight up? But the arrow flies to the cell at a specific angle determined by power and aim.
    // Simpler: The player's drag angle directly determines the hit angle on the cell (like the old tap system). So we'll use the angleDeg (relative to horizontal) and compute the hit angle on the cell as: 
    // The cell is at center, and the arrow comes from below. The arrow's direction is determined by the drag angle. The angle at which it strikes the cell is the same as the direction from the bow to the hit point on the cell. We'll assume the arrow travels in a straight line from bow to cell at the given angle, and hits the cell at that angle. So we can compute the absolute hit angle as: hitAngle = (90 - (angleDeg + 90))? Let's simplify: we'll treat angleDeg as the angle of the arrow relative to the positive X axis (0° right, 90° up). The cell is at (0,0) of the world, bow at (0, -bigY). The hit point on the cell is along the line from bow to cell at angleDeg. The angle at which the arrow strikes the cell is the direction from cell center to hit point, which is opposite. For simplicity, we'll use the old system: we know the player wants to inject at a certain angle, and that angle should be the relative angle on the cell (the same as the angle from the cell's center to the arrow's impact point). But it's messy. Instead, I'll use a simpler mapping: The drag angle (relative to horizontal) determines the angle around the cell (0° = right, 90° = up, 180° = left, 270° = down). Since the bow is at bottom, the usable range is roughly between 45° and 135° (pointing upward). We'll map angleDeg from -45° to 45° to 45° to 135° around the cell. Or we can just use the angleDeg as the absolute hit angle directly. This is easier: we'll treat angleDeg as the absolute angle (in degrees) of the injection point on the cell, measured from the positive X axis (0° right, 90° up). Then we check collision with existing needles.
    // But the player's drag direction is relative to the bow position. We'll compute the direction from bow to cell: (0, -distance) vector. The angle of that is 270° (or -90°). The player pulls back, which should create an angle offset. The arrow will be shot at that angle. So we'll compute the hit angle as: 
    // Let deltaX = dragCurrent.x - dragStart.x, deltaY = dragCurrent.y - dragStart.y. The angle of the arrow relative to the vertical (down) is atan2(deltaX, -deltaY). That gives the angle offset from the vertical. The injection angle on the cell (measured from the positive X axis) is: 90° (pointing up) + angleOffset. So injectionAngle = 90 + angleOffset (in degrees). We'll use that.
    let angleOffsetRad = Math.atan2(dragCurrent.x - dragStart.x, dragStart.y - dragCurrent.y); // note: y reversed because screen Y increases downward
    let angleOffsetDeg = angleOffsetRad * 180 / Math.PI;
    let absoluteHitAngle = (90 + angleOffsetDeg + 360) % 360;

    // Add a bit of randomness based on power? maybe not.
    // Also, the needle's flight animation can be shown.
    setIsFlying(true);
    setFlyAngle(absoluteHitAngle);
    setFlyProgress(0);
    // Animate flight
    const startTime = performance.now();
    const duration = 200; // ms, maybe adjust based on power (higher power = faster)
    const animateFlight = (now: number) => {
      const elapsed = now - startTime;
      let progress = Math.min(elapsed / duration, 1);
      setFlyProgress(progress);
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animateFlight);
      } else {
        // Flight finished, now determine hit/miss
        setIsFlying(false);
        // Calculate relative angle on cell
        const relativeHitAngle = (absoluteHitAngle - rotation + 360) % 360;
        const collision = attachedPins.some(relAngle => {
          const diff = Math.abs(relAngle - relativeHitAngle);
          return diff < 14 || diff > 346;
        });
        if (collision) {
          handleLose();
        } else {
          playSound('hit');
          if (navigator.vibrate) navigator.vibrate(50);
          confetti({
            particleCount: 30,
            spread: 45,
            origin: { x: 0.5, y: 0.8 },
            startVelocity: 15,
            colors: ['#4f46e5', '#06b6d4', '#ffffff'],
            decay: 0.9,
          });
          setAttachedPins(prev => [...prev, relativeHitAngle]);
          setRemainingPins(prev => prev - 1);
          if (remainingPins === 1) handleWin();
        }
      }
    };
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    animationRef.current = requestAnimationFrame(animateFlight);
  };

  const handleWin = () => {
    setIsGameOver(true);
    playSound('win');
    confetti({ particleCount: 200, spread: 80, origin: { y: 0.7 } });
    setTotalScore(level.points);
    setTimeout(() => setPhase('puzzle_solved'), 1200);
  };

  const handleLose = () => {
    setIsGameOver(true);
    setIsVibrating(true);
    playSound('lose');
    if (navigator.vibrate) navigator.vibrate(200);
    toast.error(isEn ? 'Contamination! Needle collision!' : 'تلوث! الإبر اصطدمت ببعضها');
    setTimeout(() => {
      setIsVibrating(false);
      onComplete(0, false);
    }, 1500);
  };

  // ─── Bonus AI Logic (unchanged) ───────────────────────────────────────────
  const fetchAIQuestion = async (bonus: typeof BONUS_LEVELS[0]) => {
    setSelectedBonus(bonus);
    setPhase('loading_quiz');
    try {
      const { data } = await supabase.functions.invoke('generate-smart-quiz', {
        body: {
          specialty: employee?.job_title || employee?.specialty || 'طبيب بشرى',
          domain: 'طبي وعلمي',
          difficulty: bonus.id,
          length: 'قصير',
          language: isEn ? 'English (Professional Medical Terminology)' : 'ar',
          question_count: 5
        }
      });
      const q = Array.isArray(data) ? data[0] : (data.questions ? data.questions[0] : data);
      const charToIndex: Record<string, number> = { 'A': 0, 'B': 1, 'C': 2, 'D': 3, 'a': 0, 'b': 1, 'c': 2, 'd': 3 };
      setQuizQuestion({
        question_text: q.question_text || q.question,
        options: q.options || [q.option_a, q.option_b, q.option_c, q.option_d],
        correct_index: charToIndex[q.correct_option || q.correct_answer] ?? 0,
        explanation: q.explanation
      });
      setTimeLeft(bonus.time);
      setPhase('quiz');
    } catch (err) {
      onComplete(totalScore, true);
    }
  };

  const handleQuizAnswer = useCallback((idx: number) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(idx);
    playSound('select');
    if (idx === quizQuestion?.correct_index) {
      playSound('win');
      setTotalScore(prev => prev + selectedBonus!.points);
    } else {
      playSound('lose');
    }
    setPhase('summary');
  }, [selectedAnswer, quizQuestion, selectedBonus, playSound]);

  useEffect(() => { handleQuizAnswerRef.current = handleQuizAnswer; }, [handleQuizAnswer]);

  useEffect(() => {
    if (phase !== 'quiz' || selectedAnswer !== null) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          playSound('tick');
          handleQuizAnswerRef.current?.(-1);
          return 0;
        }
        playSound('tick');
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, selectedAnswer, playSound]);

  // ─── UI Components ─────────────────────────────────────────────────────────
  const VolumeControl = () => (
    <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm">
      <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-1">
        {soundEnabled ? <Volume2 className="w-4 h-4 text-indigo-600" /> : <VolumeX className="w-4 h-4 text-gray-400" />}
      </button>
      {soundEnabled && (
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="w-20 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
      )}
    </div>
  );

  // ─── Screens ───────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <div className="text-center py-6 px-4 animate-in zoom-in-95 flex flex-col h-[85vh] bg-gradient-to-br from-slate-50 to-indigo-50/30 rounded-[2.5rem]">
        <div className="w-24 h-24 bg-gradient-to-br from-indigo-600 to-purple-800 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-2xl rotate-12 animate-pulse-glow">
          <Activity className="w-12 h-12 text-white animate-pulse" />
        </div>
        <h3 className="text-3xl font-black text-gray-800 mb-2">{isEn ? 'Cell Injector' : 'حقنة الخلية'}</h3>
        <p className="text-sm font-bold text-gray-500 mb-8 max-w-xs mx-auto leading-relaxed">
          {isEn ? 'Pull the bowstring to aim and shoot! Power = distance.' : 'اسحب وتر القوس لتصويب وإطلاق! القوة = المسافة.'}
        </p>
        <div className="grid grid-cols-1 gap-3 mb-8">
          {LEVELS.map(lvl => (
            <button key={lvl.id} onClick={() => setLevel(lvl)}
              className={`p-5 rounded-2xl border-2 transition-all flex justify-between items-center ${level.id === lvl.id ? 'bg-white border-indigo-500 shadow-xl scale-105' : 'bg-white/50 border-gray-100 hover:border-indigo-200'}`}>
              <div className="text-right">
                <span className={`text-transparent bg-clip-text bg-gradient-to-r ${lvl.color} font-black text-xl block`}>{lvl.label}</span>
                <span className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">{lvl.pins} VIALS | {lvl.points} PTS</span>
              </div>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${level.id === lvl.id ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                <Zap className={`w-5 h-5 ${level.id === lvl.id ? 'text-indigo-600' : 'text-gray-400'}`} />
              </div>
            </button>
          ))}
        </div>
        <div className="mt-auto flex flex-col gap-4">
          <div className="flex justify-center gap-3">
            <button onClick={() => setLanguage(l => l==='ar'?'en':(l==='en'?'auto':'ar'))} className="px-5 py-2 rounded-xl bg-white text-gray-700 text-xs font-black border border-gray-200 shadow-sm">
              <Globe className="w-4 h-4 inline ml-1"/> {language.toUpperCase()}
            </button>
            <VolumeControl />
          </div>
          <button onClick={startGame} disabled={starting} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black text-xl shadow-lg shadow-indigo-200 active:scale-95 transition-all">
            {starting ? <Loader2 className="w-6 h-6 animate-spin mx-auto"/> : (isEn ? 'START MISSION' : 'ابدأ المهمة')}
          </button>
        </div>
      </div>
    );
  }

  // Playing screen with bow
  if (phase === 'playing') {
    // Calculate string endpoint for visual
    let stringEndX = 0, stringEndY = 0;
    if (isDragging) {
      const dx = dragCurrent.x - dragStart.x;
      const dy = dragCurrent.y - dragStart.y;
      // Limit distance to 100px
      const dist = Math.min(Math.sqrt(dx*dx + dy*dy), 100);
      const angle = Math.atan2(dy, dx);
      stringEndX = Math.cos(angle) * dist;
      stringEndY = Math.sin(angle) * dist;
    }
    // Flying needle animation
    const flyX = isFlying ? (Math.sin(flyAngle * Math.PI / 180) * flyProgress * 300) : 0;
    const flyY = isFlying ? (Math.cos(flyAngle * Math.PI / 180) * flyProgress * 300) : 0;
    return (
      <div
        className="max-w-md mx-auto flex flex-col h-[85vh] select-none touch-none"
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
      >
        <div className="flex justify-between items-center p-6 shrink-0 z-50">
          <div className="relative bg-white/60 backdrop-blur-md rounded-2xl p-4 shadow-lg border border-white/30 w-32">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-tighter">{isEn ? 'Remaining' : 'المتبقي'}</span>
                <span className="text-4xl font-black text-indigo-600 tabular-nums block leading-none">{remainingPins}</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                <Target className="w-5 h-5 text-indigo-600" />
              </div>
            </div>
          </div>
          <div className="bg-white/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
            <span className="text-xs font-black text-gray-600 uppercase tracking-widest">{level.label}</span>
          </div>
        </div>

        <div className="flex-1 relative flex items-center justify-center">
          {/* Power meter */}
          {isDragging && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-32 bg-gray-200 rounded-full h-2 overflow-hidden">
              <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${power * 100}%` }}></div>
            </div>
          )}

          {/* Central Cell */}
          <div className="relative w-48 h-48 md:w-56 md:h-56 rounded-full z-20 flex items-center justify-center">
            {/* Rotating cell body */}
            <div
              className="absolute inset-0 rounded-full"
              style={{ transform: `rotate(${rotation}deg)` }}
            >
              <div className="w-full h-full bg-gradient-to-br from-indigo-600 via-purple-700 to-pink-600 rounded-full
                            shadow-[0_0_30px_rgba(99,102,241,0.6),inset_0_-10px_20px_rgba(0,0,0,0.4)]
                            border-2 border-white/30 backdrop-blur-sm
                            before:absolute before:inset-0 before:rounded-full before:bg-white/20 before:blur-lg
                            after:absolute after:inset-0 after:rounded-full after:bg-[radial-gradient(circle_at_30%_30%,white,transparent)] after:opacity-30">
              </div>
              {/* Attached needles (inside rotating container) */}
              {attachedPins.map((relAngle, i) => (
                <div
                  key={i}
                  className="absolute w-1 h-44 origin-bottom"
                  style={{
                    transform: `rotate(${relAngle}deg) translateY(-50%)`,
                    bottom: '50%',
                  }}
                >
                  <div className="w-1.5 h-28 bg-gradient-to-b from-gray-300 to-gray-500 rounded-full mx-auto relative">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-3 bg-red-600/80 rounded-t-full"></div>
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-2 bg-gray-200 rounded-full"></div>
                  </div>
                  <div className="w-2.5 h-2.5 bg-white border border-gray-400 rounded-full mx-auto -mt-1 shadow-md"></div>
                </div>
              ))}
            </div>
            {/* Static hit counter (non-rotating) */}
            <div className="relative z-10 bg-black/30 backdrop-blur-sm rounded-full w-16 h-16 flex items-center justify-center">
              <span className="text-3xl font-black text-white">{attachedPins.length}</span>
            </div>
          </div>

          {/* Bow (far from cell) */}
          <div
            ref={bowRef}
            className="absolute bottom-8 left-1/2 transform -translate-x-1/2 w-32 h-32 pointer-events-auto"
          >
            {/* Bow arc */}
            <svg className="w-full h-full" viewBox="0 0 100 100">
              <path
                d="M 20 70 Q 50 20, 80 70"
                stroke="white"
                strokeWidth="4"
                fill="none"
                strokeLinecap="round"
              />
              {/* String */}
              <line
                x1="20"
                y1="70"
                x2="80"
                y2="70"
                stroke="white"
                strokeWidth="2"
                strokeDasharray="4"
              />
              {/* Drawn string */}
              {isDragging && (
                <line
                  x1="20"
                  y1="70"
                  x2={50 + stringEndX}
                  y2={70 + stringEndY}
                  stroke="orange"
                  strokeWidth="3"
                />
              )}
              {isDragging && (
                <line
                  x1="80"
                  y1="70"
                  x2={50 + stringEndX}
                  y2={70 + stringEndY}
                  stroke="orange"
                  strokeWidth="3"
                />
              )}
              {/* Arrow nock */}
              <circle cx="50" cy="70" r="3" fill="white" />
            </svg>
          </div>

          {/* Flying arrow visual */}
          {isFlying && (
            <div
              className="absolute w-8 h-1 bg-orange-500 rounded-full shadow-lg"
              style={{
                left: `calc(50% + ${flyX}px)`,
                top: `calc(100% - 80px + ${flyY}px)`,
                transform: `rotate(${flyAngle}deg)`,
                transition: 'none',
              }}
            />
          )}
        </div>
        <div className="p-4 text-center text-gray-400 text-xs">
          {isEn ? 'Drag the string backward to aim and charge' : 'اسحب الوتر للخلف لتوجيه السهم وشحن الطاقة'}
        </div>
      </div>
    );
  }

  // Other screens unchanged...
  if (phase === 'puzzle_solved') {
    return (
      <div className="text-center py-10 px-4 animate-in slide-in-from-bottom" dir="rtl">
        <div className="w-24 h-24 bg-emerald-100 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-inner rotate-12">
          <CheckCircle className="w-12 h-12 text-emerald-600" />
        </div>
        <h3 className="text-3xl font-black text-gray-800 mb-3">{isEn ? 'Perfect Sterilization!' : 'تطهير كامل! 🎉'}</h3>
        <p className="text-lg font-bold text-gray-600 mb-8 leading-relaxed">
          دقة مثالية في حقن الخلايا.<br/>
          كسبت <span className="text-indigo-600">{level.points} نقطة</span>. ضاعفها الآن!
        </p>
        <div className="grid grid-cols-1 gap-3 max-w-sm mx-auto">
          {BONUS_LEVELS.map(bonus => (
            <button key={bonus.id} onClick={() => fetchAIQuestion(bonus)}
              className="bg-white border-2 border-gray-100 p-5 rounded-2xl hover:border-indigo-500 hover:shadow-xl transition-all active:scale-95 flex justify-between items-center shadow-sm">
              <span className="font-black text-gray-800">مكافأة {bonus.id}</span>
              <span className="bg-indigo-50 text-indigo-700 font-black px-4 py-1.5 rounded-xl text-xs flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-current"/> +{bonus.points}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (phase === 'loading_quiz') {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-indigo-600 animate-pulse text-center">
        <Loader2 className="w-16 h-16 mb-4 animate-spin mx-auto" />
        <p className="font-black text-xl tracking-tighter">جاري سحب عينة الأسئلة من المختبر...</p>
      </div>
    );
  }

  if (phase === 'quiz' || phase === 'summary') {
    const isEnglishQ = /^[A-Za-z]/.test(quizQuestion?.question_text || '');
    return (
      <div className="max-w-xl mx-auto w-full animate-in zoom-in-95 py-6 px-4" dir="rtl">
        {phase === 'summary' && (
          <div className="text-center mb-8 bg-white p-8 rounded-[2.5rem] shadow-2xl border border-indigo-50">
            <p className="text-gray-400 font-black text-xs uppercase mb-1">الرصيد المكتسب</p>
            <h2 className="text-6xl font-black text-indigo-600 mb-6 tracking-tighter">{totalScore}</h2>
            <button onClick={() => onComplete(totalScore, true)} className="w-full bg-gray-900 text-white py-5 rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2">
              تحصيل النقاط <ArrowRight className="w-6 h-6" />
            </button>
          </div>
        )}

        {quizQuestion && (
          <div className="bg-white rounded-[2rem] p-6 shadow-xl border-t-[12px] border-indigo-600">
            <div className="flex justify-between items-center mb-6">
              <span className="bg-amber-50 text-amber-700 px-4 py-2 rounded-xl font-black text-xs flex items-center gap-2">
                <Star className="w-4 h-4 fill-current"/> +{selectedBonus?.points}
              </span>
              {phase === 'quiz' && (
                <div className={`px-4 py-2 rounded-xl font-black text-xs flex items-center gap-2 ${timeLeft <= 5 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 text-gray-500'}`}>
                  <Clock className="w-4 h-4"/> {timeLeft}s
                </div>
              )}
            </div>

            <h3 className={`text-xl font-black text-gray-800 leading-tight mb-8 ${isEnglishQ ? 'text-left' : 'text-right'}`} dir={isEnglishQ ? 'ltr' : 'rtl'}>
              {quizQuestion.question_text}
            </h3>

            <div className="grid grid-cols-1 gap-3">
              {quizQuestion.options.map((option: string, idx: number) => {
                let btnClass = 'bg-slate-50 border-2 border-transparent text-gray-700 hover:bg-white hover:border-indigo-100';
                if (phase === 'summary') {
                  if (idx === quizQuestion.correct_index) btnClass = 'bg-emerald-500 border-emerald-600 text-white shadow-lg z-10 scale-105';
                  else if (idx === selectedAnswer) btnClass = 'bg-red-500 border-red-600 text-white shadow-lg opacity-80';
                  else btnClass = 'bg-gray-50 border-gray-100 opacity-40';
                }
                return (
                  <button
                    key={idx}
                    onClick={() => handleQuizAnswerRef.current?.(idx)}
                    disabled={phase === 'summary'}
                    className={`${btnClass} p-5 rounded-2xl font-bold text-base transition-all flex items-center justify-between ${isEnglishQ ? 'text-left' : 'text-right'}`}
                  >
                    <span className="flex-1">{option}</span>
                    {phase === 'summary' && idx === quizQuestion.correct_index && <CheckCircle className="w-6 h-6 ml-2"/>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}