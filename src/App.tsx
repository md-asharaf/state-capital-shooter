import { useEffect, useRef, useState } from 'react';
import { fetchQuizData } from './api/fetchQuiz';
import { playShootSound, playCorrectSound, playWrongSound } from './utils/audio';
import { spawnConfettiBurst } from './utils/confetti';
import Toast from './components/ui/Toast';
import TopHeader from './components/ui/TopHeader';
import BottomBar from './components/ui/BottomBar';
import QuestionBoard from './components/game/QuestionBoard';
import Cannon from './components/game/Cannon';
import PlayArea from './components/game/PlayArea';
import { GameOverlay, HintModal, ConfirmModal, PauseOverlay } from './components/ui/Overlays';
import type { QuizQuestion } from './types/api';

type FetchState = 'idle' | 'loading' | 'done' | 'error';

const secureRandom = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;

export default function App() {
  const [quizFetchState, setQuizFetchState] = useState<FetchState>('idle');
  const [quizError, setQuizError] = useState<string>('');
  const [gameStarted, setGameStarted] = useState(false);

  const [score, setScore] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null);
  const [currentOptions, setCurrentOptions] = useState<string[]>([]);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [showHint, setShowHint] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [showConfirmRestart, setShowConfirmRestart] = useState(false);

  const [cannonAngle, setCannonAngle] = useState(0);
  const [bulletPos, setBulletPos] = useState({ x: 0, y: 0, visible: false });
  const [trajectoryPoints, setTrajectoryPoints] = useState<{ x: number, y: number, r: number, fill: string }[]>([]);
  const [loadedBallVisible, setLoadedBallVisible] = useState(true);

  const [isRecoiling, setIsRecoiling] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [isBumpingScore, setIsBumpingScore] = useState(false);
  const [isMuzzleFlashing, setIsMuzzleFlashing] = useState(false);

  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const playAreaRef = useRef<HTMLDivElement>(null);

  const [ballStates, setBallStates] = useState([
    { id: 0, hidden: true, classes: '', x: 0, y: 0 },
    { id: 1, hidden: true, classes: '', x: 0, y: 0 },
    { id: 2, hidden: true, classes: '', x: 0, y: 0 },
    { id: 3, hidden: true, classes: '', x: 0, y: 0 },
  ]);

  const [pillStates, setPillStates] = useState([
    { id: 0, removed: false, entering: false },
    { id: 1, removed: false, entering: false },
    { id: 2, removed: false, entering: false },
    { id: 3, removed: false, entering: false },
  ]);

  const [fiftyDisabled, setFiftyDisabled] = useState(false);

  // Mutable Game State
  const stateRef = useRef({
    isShooting: false,
    isAiming: false,
    isPaused: false,
    currentAngleDeg: 0,
    animFrame: 0,
    pivotX: 0,
    pivotY: 0,
    unusedQuestions: [] as QuizQuestion[],
    allQuestions: [] as QuizQuestion[],
    score: 0,
    currentOptions: [] as string[],
    currentQuestion: null as QuizQuestion | null,
    audioCtx: null as AudioContext | null,
  });

  useEffect(() => { stateRef.current.isPaused = isPaused; }, [isPaused]);
  useEffect(() => { stateRef.current.score = score; }, [score]);
  useEffect(() => { stateRef.current.currentOptions = currentOptions; }, [currentOptions]);
  useEffect(() => { stateRef.current.currentQuestion = currentQuestion; }, [currentQuestion]);

  const fetchQuiz = async () => {
    setQuizFetchState('loading');
    setQuizError('');
    try {
      const data = await fetchQuizData();
      stateRef.current.allQuestions = data;
      stateRef.current.unusedQuestions = [...data];
      setQuizFetchState('done');
      setGameStarted(true);
      setTimeout(loadNextQuestion, 100);
    } catch (err) {
      setQuizError(err instanceof Error ? err.message : 'Failed to fetch quiz data');
      setQuizFetchState('error');
    }
  };

  const startNewSession = () => {
    setGameOver(false);
    setGameStarted(false);
    setQuizFetchState('idle');
    cancelAnimationFrame(stateRef.current.animFrame);
    stateRef.current.isShooting = false;
    stateRef.current.isAiming = false;
    setScore(0);
    setQuestionNumber(0);
    setBulletPos(prev => ({ ...prev, visible: false }));
    clearTrajectory();
    fetchQuiz();
  };





  const computePivot = () => {
    const pivotEl = document.getElementById('cannon-pivot');
    if (!pivotEl || !containerRef.current) return;
    const cRect = containerRef.current.getBoundingClientRect();
    const pRect = pivotEl.getBoundingClientRect();
    stateRef.current.pivotX = pRect.left + pRect.width / 2 - cRect.left;
    stateRef.current.pivotY = pRect.top + pRect.height / 2 - cRect.top;
  };

  useEffect(() => {
    window.addEventListener('resize', computePivot);
    return () => window.removeEventListener('resize', computePivot);
  }, []);

  const getBarrelTip = (angleDeg: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    const BARREL_LENGTH = 65;
    return {
      tx: stateRef.current.pivotX + Math.sin(rad) * BARREL_LENGTH,
      ty: stateRef.current.pivotY - Math.cos(rad) * BARREL_LENGTH,
    };
  };

  const clearTrajectory = () => {
    setTrajectoryPoints([]);
  };

  const drawTrajectory = (ox: number, oy: number, angleDeg: number) => {
    clearTrajectory();
    if (!containerRef.current || !playAreaRef.current) return;
    const cRect = containerRef.current.getBoundingClientRect();
    const paRect = playAreaRef.current.getBoundingClientRect();
    const wallLeft = paRect.left - cRect.left;
    const wallRight = paRect.right - cRect.left;
    const wallTop = paRect.top - cRect.top + 12;

    const rad = (angleDeg * Math.PI) / 180;
    let dirX = Math.sin(rad);
    const dirY = -Math.cos(rad);
    const STEP = 22;

    let sx = ox, sy = oy;
    const points = [];
    for (let d = 0; d < 5; d++) {
      sx += dirX * STEP;
      sy += dirY * STEP;
      if (sx < wallLeft + 5) { sx = wallLeft + 5; dirX = Math.abs(dirX); }
      if (sx > wallRight - 5) { sx = wallRight - 5; dirX = -Math.abs(dirX); }
      if (sy < wallTop) break;

      points.push({
        x: sx,
        y: sy,
        r: Math.max(2, 4.5 - d * 0.35),
        fill: `rgba(255,255,255,${0.88 - d * 0.1})`
      });
    }
    setTrajectoryPoints(points);
  };

  const updateAim = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const cRect = containerRef.current.getBoundingClientRect();
    const mx = clientX - cRect.left;
    const my = clientY - cRect.top;
    const dx = mx - stateRef.current.pivotX;
    const dy = my - stateRef.current.pivotY;
    if (dy >= 0) {
      clearTrajectory();
      return;
    }

    let deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
    deg = Math.max(-75, Math.min(75, deg));
    stateRef.current.currentAngleDeg = deg;
    setCannonAngle(deg);

    const { tx, ty } = getBarrelTip(deg);
    drawTrajectory(tx, ty, deg);
  };

  const handleAimStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (stateRef.current.isShooting || stateRef.current.isPaused) return;
    computePivot();
    stateRef.current.isAiming = true;
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    updateAim(clientX, clientY);
  };

  // Global aim move / release
  useEffect(() => {
    const onAimMove = (e: MouseEvent | TouchEvent) => {
      if (!stateRef.current.isAiming || stateRef.current.isShooting || stateRef.current.isPaused) return;
      let clientX, clientY;
      if ('touches' in e) {
        clientX = (e as TouchEvent).touches[0].clientX;
        clientY = (e as TouchEvent).touches[0].clientY;
      } else {
        clientX = (e as MouseEvent).clientX;
        clientY = (e as MouseEvent).clientY;
      }
      updateAim(clientX, clientY);
    };

    const onAimRelease = () => {
      if (!stateRef.current.isAiming) return;
      stateRef.current.isAiming = false;
      if (stateRef.current.isShooting || stateRef.current.isPaused) {
        clearTrajectory();
        return;
      }
      clearTrajectory();
      const deg = stateRef.current.currentAngleDeg;
      const { tx, ty } = getBarrelTip(deg);

      // trigger recoil
      setIsRecoiling(true);

      fireBullet(tx, ty, deg);
    };

    const onMouseLeave = () => {
      if (stateRef.current.isAiming) {
        stateRef.current.isAiming = false;
        clearTrajectory();
      }
    };

    window.addEventListener('mousemove', onAimMove);
    window.addEventListener('touchmove', onAimMove, { passive: false });
    window.addEventListener('mouseup', onAimRelease);
    window.addEventListener('touchend', onAimRelease, { passive: false });
    window.addEventListener('mouseleave', onMouseLeave);

    return () => {
      window.removeEventListener('mousemove', onAimMove);
      window.removeEventListener('touchmove', onAimMove);
      window.removeEventListener('mouseup', onAimRelease);
      window.removeEventListener('touchend', onAimRelease);
      window.removeEventListener('mouseleave', onMouseLeave);
    };
  }, []);



  const showToastMsg = (msg: string, type: string) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 1200);
  };

  const triggerCannonShake = () => setIsShaking(true);
  const bumpScore = () => setIsBumpingScore(true);

  function loadNextQuestion() {
    cancelAnimationFrame(stateRef.current.animFrame);
    stateRef.current.isShooting = false;
    stateRef.current.isAiming = false;
    setFiftyDisabled(false);
    clearTrajectory();

    setBulletPos(prev => ({ ...prev, visible: false }));
    setLoadedBallVisible(true);

    // Scatter visible balls
    setBallStates(prev => prev.map((b, i) => {
      if (!b.hidden && !b.classes.includes('popping') && !b.classes.includes('exit')) {
        const exits = ['exit-left', 'exit-right', 'exit-up'];
        return { ...b, classes: exits[i % 3] };
      }
      return b;
    }));

    setTimeout(() => {
      setCannonAngle(0);
      stateRef.current.currentAngleDeg = 0;

      const allQ = stateRef.current.allQuestions;
      if (!allQ || allQ.length === 0) return;
      if (stateRef.current.unusedQuestions.length === 0) {
        setGameOver(true);
        return;
      }

      const nextQ = stateRef.current.unusedQuestions.shift();
      if (!nextQ) return;
      setCurrentQuestion(nextQ);
      setQuestionNumber(prev => prev + 1);
      setCurrentOptions([...nextQ.options]);

      setPillStates(prev => prev.map(p => ({ ...p, removed: false, entering: true })));

      const GRID_CELLS = [];
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 9; c++) {
          GRID_CELLS.push({ row: r, col: c, left: 8 + c * 8.5 });
        }
      }

      let paWidth = 420;
      if (playAreaRef.current) {
        paWidth = playAreaRef.current.getBoundingClientRect().width;
      }

      const shuffled = [...GRID_CELLS].sort(() => secureRandom() - 0.5);
      const chosen: { row: number; col: number; left: number }[] = [];
      const BALL_D = 29;
      for (const cell of shuffled) {
        const cx = (cell.left / 100) * paWidth;
        const cy = 25 + cell.row * 39;
        let ok = true;
        for (const c of chosen) {
          if (c.row === cell.row || c.col === cell.col) { ok = false; break; }
          const ox = (c.left / 100) * paWidth;
          const oy = 25 + c.row * 39;
          if (Math.hypot(cx - ox, cy - oy) < BALL_D + 8) { ok = false; break; }
        }
        if (ok) chosen.push(cell);
        if (chosen.length === 4) break;
      }

      setBallStates(prev => prev.map((_, i) => ({
        id: i,
        hidden: false,
        classes: 'entering',
        x: chosen[i].left,
        y: 25 + chosen[i].row * 39
      })));

      setTimeout(() => {
        setBallStates(prev => prev.map(b => ({ ...b, classes: 'floating' })));
      }, 1500);

    }, 480);
  };

  const checkAnswer = (index: number, ballCX: number, ballCY: number) => {
    const isCorrect = stateRef.current.currentOptions[index] === stateRef.current.currentQuestion?.answer;
    if (isCorrect) {
      setScore(s => s + 100);
      bumpScore();
      setBallStates(prev => {
        const next = [...prev];
        next[index].classes = 'popping';
        return next;
      });
      spawnConfettiBurst(ballCX, ballCY, containerRef.current);
      playCorrectSound();
      showToastMsg('+100 CORRECT!', 'correct');
    } else {
      triggerCannonShake();
      setScore(s => Math.max(0, s - 10));
      bumpScore();
      setBallStates(prev => {
        const next = [...prev];
        const exits = ['exit-left', 'exit-right', 'exit-up'];
        next[index].classes = exits[index % 3];
        return next;
      });
      setPillStates(prev => {
        const next = [...prev];
        next[index].removed = true;
        return next;
      });
      playWrongSound();
      showToastMsg('-10 WRONG!', 'wrong');
    }
    setTimeout(loadNextQuestion, 1300);
  };

  const endBullet = (hit: boolean) => {
    setBulletPos(prev => ({ ...prev, visible: false }));
    if (!hit) {
      stateRef.current.isShooting = false;
      setLoadedBallVisible(true);
      showToastMsg('Miss!', 'miss');
    }
  };

  function fireBullet(startX: number, startY: number, angleDeg: number) {
    playShootSound();
    stateRef.current.isShooting = true;

    setBallStates(prev => prev.map(b => ({ ...b, classes: b.classes.replace('floating', '') })));

    setLoadedBallVisible(false);
    setIsMuzzleFlashing(true);

    if (!containerRef.current || !playAreaRef.current) return;
    const cRect = containerRef.current.getBoundingClientRect();
    const paRect = playAreaRef.current.getBoundingClientRect();
    const wallLeft = paRect.left - cRect.left;
    const wallRight = paRect.right - cRect.left;
    const wallTop = paRect.top - cRect.top + 12;

    const SPEED = 9;
    const rad = (angleDeg * Math.PI) / 180;
    let vx = Math.sin(rad) * SPEED;
    let vy = -Math.cos(rad) * SPEED;
    const R = 8;

    let bx = startX - R, by = startY - R;
    setBulletPos({ x: bx, y: by, visible: true });

    const step = () => {
      bx += vx; by += vy;
      if (bx < wallLeft) { bx = wallLeft; vx = Math.abs(vx); }
      if (bx > wallRight - R * 2) { bx = wallRight - R * 2; vx = -Math.abs(vx); }

      setBulletPos({ x: bx, y: by, visible: true });

      if (by + R < wallTop) {
        endBullet(false);
        return;
      }

      const bcx = bx + R, bcy = by + R;
      let hit = false;
      for (let i = 0; i < 4; i++) {
        const ballEl = document.getElementById(`ball-${i}`);
        if (!ballEl || ballEl.classList.contains('hidden') || ballEl.classList.contains('exit-left') || ballEl.classList.contains('exit-right') || ballEl.classList.contains('exit-up')) continue;

        const br = ballEl.getBoundingClientRect();
        const ballCX = br.left + br.width / 2 - cRect.left;
        const ballCY = br.top + br.height / 2 - cRect.top;
        if (Math.hypot(bcx - ballCX, bcy - ballCY) < 14.5 + R + 2) {
          endBullet(true);
          checkAnswer(i, ballCX, ballCY);
          hit = true;
          break;
        }
      }

      if (!hit) {
        stateRef.current.animFrame = requestAnimationFrame(step);
      }
    };
    stateRef.current.animFrame = requestAnimationFrame(step);
  };

  const useFiftyFifty = () => {
    if (fiftyDisabled || stateRef.current.isShooting) return;
    setFiftyDisabled(true);
    const wrongIdx = currentOptions
      .map((o, i) => o !== currentQuestion?.answer ? i : -1)
      .filter(i => i !== -1)
      .sort(() => secureRandom() - 0.5)
      .slice(0, 2);

    setBallStates(prev => prev.map((b, i) => {
      if (wrongIdx.includes(i)) {
        const exits = ['exit-left', 'exit-right', 'exit-up'];
        return { ...b, classes: exits[i % 3] };
      }
      return b;
    }));

    setPillStates(prev => prev.map((p, i) => {
      if (wrongIdx.includes(i)) return { ...p, removed: true };
      return p;
    }));
  };

  const onInGameRestartClick = () => {
    setShowConfirmRestart(true);
    setIsPaused(true);
  };

  const confirmRestart = () => {
    setShowConfirmRestart(false);
    setIsPaused(false);
    startNewSession();
  };

  const cancelRestart = () => {
    setShowConfirmRestart(false);
    setIsPaused(false);
  };



  const togglePause = () => {
    setIsPaused(p => !p);
  };



  return (
    <div id="game-container" ref={containerRef}>
      <GameOverlay
        gameStarted={gameStarted}
        gameOver={gameOver}
        quizFetchState={quizFetchState}
        quizError={quizError}
        score={score}
        onStartSession={startNewSession}
        onFetchQuiz={fetchQuiz}
      />
      <HintModal
        showHint={showHint}
        currentQuestion={currentQuestion}
        onClose={() => setShowHint(false)}
      />
      <ConfirmModal
        showConfirmRestart={showConfirmRestart}
        onCancel={cancelRestart}
        onConfirm={confirmRestart}
      />
      <PauseOverlay
        isPaused={isPaused}
        showConfirmRestart={showConfirmRestart}
        onTogglePause={togglePause}
      />
      <TopHeader
        score={score}
        isBumpingScore={isBumpingScore}
        onBumpEnd={() => setIsBumpingScore(false)}
      />
      <QuestionBoard
        questionNumber={questionNumber}
        currentQuestion={currentQuestion}
        currentOptions={currentOptions}
        pillStates={pillStates}
        onPillAnimationEnd={(i) => setPillStates(prev => {
          const next = [...prev];
          next[i].entering = false;
          return next;
        })}
      />
      <PlayArea
        playAreaRef={playAreaRef}
        ballStates={ballStates}
        trajectoryPoints={trajectoryPoints}
        bulletPos={bulletPos}
      />
      <Cannon
        cannonAngle={cannonAngle}
        loadedBallVisible={loadedBallVisible}
        isMuzzleFlashing={isMuzzleFlashing}
        isRecoiling={isRecoiling}
        isShaking={isShaking}
        onAimStart={handleAimStart}
        onMuzzleFlashEnd={() => setIsMuzzleFlashing(false)}
        onCannonAnimationEnd={(e) => {
          if (e.animationName === 'cannonRecoil') setIsRecoiling(false);
          if (e.animationName === 'cannonShake') setIsShaking(false);
        }}
      />
      <BottomBar
        fiftyDisabled={fiftyDisabled}
        isPaused={isPaused}
        onUseFiftyFifty={useFiftyFifty}
        onShowHint={() => setShowHint(true)}
        onRestartClick={onInGameRestartClick}
        onTogglePause={togglePause}
      />
      <Toast toast={toast} />
    </div>
  );
}
