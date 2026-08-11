document.addEventListener('DOMContentLoaded', async () => {

  // ─── Load Data ────────────────────────────────────────────
  let questions = [];
  let unusedQuestions = [];
  try {
    const res = await fetch('data.json');
    questions = await res.json();
    unusedQuestions = [...questions];
  } catch (e) {
    console.error('Failed to load data.json', e);
    return;
  }

  // ─── DOM ──────────────────────────────────────────────────
  const container = document.getElementById('game-container');
  const qLabelEl = document.querySelector('.q-label');
  const stateNameEl = document.getElementById('state-name');
  const playArea = document.getElementById('play-area');
  const balls = [0, 1, 2, 3].map(i => document.getElementById(`ball-${i}`));
  const optTexts = [0, 1, 2, 3].map(i => document.getElementById(`opt-text-${i}`));
  const optPills = [0, 1, 2, 3].map(i => document.getElementById(`opt-${i}`));
  const cannonBarrel = document.getElementById('cannon-barrel');
  const cannonBody = document.getElementById('cannon-body');
  const bulletEl = document.getElementById('bullet');
  const trajSvg = document.getElementById('trajectory-svg');
  const fiftyBtn = document.getElementById('fifty-fifty-btn');
  const hintBtn = document.getElementById('hint-btn');
  const hintModal = document.getElementById('hint-modal');
  const hintText = document.getElementById('hint-text');
  const closeHint = document.getElementById('close-hint');
  const loadedBall = document.getElementById('loaded-ball');
  const muzzleFlash = document.getElementById('muzzle-flash');
  const restartBtn = document.getElementById('restart-btn');
  const pauseBtn = document.getElementById('pause-btn');
  const pauseOverlay = document.getElementById('pause-overlay');
  const scoreEl = document.getElementById('score-value');

  // ─── State ────────────────────────────────────────────────
  let currentQuestion = null;
  let currentOptions = [];
  let questionNumber = 1;

  // ─── Audio Synthesis ────────────────────────────────────────
  let audioCtx = null;
  function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }
  function playTone(freq, type, duration, vol=0.1) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  }
  function playShootSound() {
    initAudio();
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
  }
  function playCorrectSound() {
    initAudio();
    playTone(523.25, 'sine', 0.15, 0.2); 
    setTimeout(() => playTone(659.25, 'sine', 0.15, 0.2), 100); 
    setTimeout(() => playTone(783.99, 'sine', 0.3, 0.2), 200); 
  }
  function playWrongSound() {
    initAudio();
    playTone(200, 'sawtooth', 0.3, 0.2);
    setTimeout(() => playTone(150, 'sawtooth', 0.4, 0.2), 150);
  }
  let isShooting = false;
  let isPaused = false;
  let isAiming = false;
  let animFrame = null;
  let currentAngleDeg = 0;
  let score = 0;
  let attempted = 0;
  const BARREL_LENGTH = 65;
  let pivotX = 0, pivotY = 0;

  // 9 cols × 4 rows = 36 cells
  // 9 cols × 4 rows = 36 cells
  const GRID_CELLS = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 9; c++) {
      GRID_CELLS.push({
        row: r,
        left: 8 + c * 8.5   // avoids walls
      });
    }
  }

  // ─── Init ─────────────────────────────────────────────────
  computePivot();
  window.addEventListener('resize', computePivot);
  loadNextQuestion();

  // ─── Pivot calculation ────────────────────────────────────
  function computePivot() {
    const pivotEl = document.getElementById('cannon-pivot');
    const cRect = container.getBoundingClientRect();
    const pRect = pivotEl.getBoundingClientRect();
    pivotX = pRect.left + pRect.width / 2 - cRect.left;
    pivotY = pRect.top + pRect.height / 2 - cRect.top;
  }

  function getBarrelTip(angleDeg) {
    const rad = angleDeg * Math.PI / 180;
    return {
      tx: pivotX + Math.sin(rad) * BARREL_LENGTH,
      ty: pivotY - Math.cos(rad) * BARREL_LENGTH
    };
  }

  // ─── Aiming: only cannon body + barrel trigger it ─────────
  [cannonBarrel, cannonBody].forEach(el => {
    el.addEventListener('mousedown', onAimStart);
    el.addEventListener('touchstart', (e) => { e.preventDefault(); onAimStart(e.touches[0]); }, { passive: false });
  });

  window.addEventListener('mousemove', onAimMove);
  window.addEventListener('touchmove', (e) => { if (isAiming) { e.preventDefault(); onAimMove(e.touches[0]); } }, { passive: false });
  window.addEventListener('mouseup', onAimRelease);
  window.addEventListener('touchend', (e) => { if (isAiming) { e.preventDefault(); onAimRelease(e.changedTouches[0]); } }, { passive: false });
  window.addEventListener('mouseleave', () => { if (isAiming) { isAiming = false; clearTrajectory(); } });

  function onAimStart(e) {
    if (isShooting || isPaused) return;
    computePivot();
    isAiming = true;
    updateAim(e);
  }

  function onAimMove(e) {
    if (!isAiming || isShooting || isPaused) return;
    updateAim(e);
  }

  function onAimRelease(e) {
    if (!isAiming) return;
    isAiming = false;
    if (isShooting || isPaused) { clearTrajectory(); return; }
    clearTrajectory();
    const { tx, ty } = getBarrelTip(currentAngleDeg);
    triggerCannonRecoil();
    fireBullet(tx, ty, currentAngleDeg);
  }

  function updateAim(e) {
    const cRect = container.getBoundingClientRect();
    const mx = e.clientX - cRect.left;
    const my = e.clientY - cRect.top;
    const dx = mx - pivotX;
    const dy = my - pivotY;
    if (dy >= 0) { clearTrajectory(); return; }

    let deg = Math.atan2(dx, -dy) * 180 / Math.PI;
    deg = Math.max(-75, Math.min(75, deg));
    currentAngleDeg = deg;
    cannonBarrel.style.transform = `rotate(${deg}deg)`;
    const { tx, ty } = getBarrelTip(deg);
    drawTrajectory(tx, ty, deg);
  }

  // ─── Cannon recoil ────────────────────────────────────────
  function triggerCannonRecoil() {
    cannonBody.classList.remove('cannon-recoil');
    void cannonBody.offsetWidth;
    cannonBody.classList.add('cannon-recoil');
    cannonBody.addEventListener('animationend', () => cannonBody.classList.remove('cannon-recoil'), { once: true });
  }

  function triggerCannonShake() {
    cannonBody.classList.remove('cannon-shake');
    void cannonBody.offsetWidth;
    cannonBody.classList.add('cannon-shake');
    cannonBody.addEventListener('animationend', () => cannonBody.classList.remove('cannon-shake'), { once: true });
  }

  // ─── Trajectory ───────────────────────────────────────────
  function drawTrajectory(ox, oy, angleDeg) {
    clearTrajectory();
    const cRect = container.getBoundingClientRect();
    const paRect = playArea.getBoundingClientRect();
    const wallLeft = paRect.left - cRect.left;
    const wallRight = paRect.right - cRect.left;
    const wallTop = paRect.top - cRect.top + 12;

    const rad = angleDeg * Math.PI / 180;
    let dirX = Math.sin(rad);
    const dirY = -Math.cos(rad);
    const STEP = 22;

    let sx = ox, sy = oy;
    for (let d = 0; d < 5; d++) {
      sx += dirX * STEP;
      sy += dirY * STEP;
      if (sx < wallLeft + 5) { sx = wallLeft + 5; dirX = Math.abs(dirX); }
      if (sx > wallRight - 5) { sx = wallRight - 5; dirX = -Math.abs(dirX); }
      if (sy < wallTop) break;

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', sx);
      circle.setAttribute('cy', sy);
      circle.setAttribute('r', Math.max(2, 4.5 - d * 0.35));
      circle.setAttribute('fill', `rgba(255,255,255,${0.88 - d * 0.1})`);
      trajSvg.appendChild(circle);
    }
  }

  function clearTrajectory() {
    while (trajSvg.firstChild) trajSvg.removeChild(trajSvg.firstChild);
  }

  // ─── Fire Bullet ──────────────────────────────────────────
  function fireBullet(startX, startY, angleDeg) {
    playShootSound();
    isShooting = true;
    balls.forEach(b => b.classList.remove('floating'));
    
    loadedBall.style.opacity = '0';
    muzzleFlash.classList.remove('fire-flash');
    void muzzleFlash.offsetWidth;
    muzzleFlash.classList.add('fire-flash');

    const cRect = container.getBoundingClientRect();
    const paRect = playArea.getBoundingClientRect();
    const wallLeft = paRect.left - cRect.left;
    const wallRight = paRect.right - cRect.left;
    const wallTop = paRect.top - cRect.top + 12;

    const SPEED = 9;
    const rad = angleDeg * Math.PI / 180;
    let vx = Math.sin(rad) * SPEED;
    let vy = -Math.cos(rad) * SPEED;
    const R = 8;

    if (bulletEl.parentElement !== container) container.appendChild(bulletEl);
    let bx = startX - R, by = startY - R;
    bulletEl.style.left = bx + 'px';
    bulletEl.style.top = by + 'px';
    bulletEl.style.position = 'absolute';
    bulletEl.classList.remove('hidden');

    function step() {
      bx += vx; by += vy;
      if (bx < wallLeft) { bx = wallLeft; vx = Math.abs(vx); }
      if (bx > wallRight - R * 2) { bx = wallRight - R * 2; vx = -Math.abs(vx); }
      bulletEl.style.left = bx + 'px';
      bulletEl.style.top = by + 'px';

      if (by + R < wallTop) { endBullet(false, false); return; }

      const bcx = bx + R, bcy = by + R;
      for (let i = 0; i < balls.length; i++) {
        const ball = balls[i];
        if (ball.classList.contains('hidden')) continue;
        const br = ball.getBoundingClientRect();
        const ballCX = br.left + br.width / 2 - cRect.left;
        const ballCY = br.top + br.height / 2 - cRect.top;
        if (Math.hypot(bcx - ballCX, bcy - ballCY) < 14.5 + R + 2) {
          endBullet(true, currentOptions[i] === currentQuestion.capital);
          checkAnswer(i, ball, ballCX, ballCY);
          return;
        }
      }
      animFrame = requestAnimationFrame(step);
    }
    animFrame = requestAnimationFrame(step);
  }

  function endBullet(hit, correct) {
    bulletEl.classList.add('hidden');
    if (!hit) {
      isShooting = false;
      loadedBall.style.opacity = '1';
      showToast('💨 Miss!', 'error');
      balls.forEach(b => { if (!b.classList.contains('hidden')) b.classList.add('floating'); });
    }
  }

  // ─── Check Answer ─────────────────────────────────────────
  function checkAnswer(index, ball, ballCX, ballCY) {
    const correct = currentOptions[index] === currentQuestion.capital;

    if (correct) {
      score += 100;
      scoreEl.textContent = score;
      scoreEl.classList.remove('bump');
      void scoreEl.offsetWidth;
      scoreEl.classList.add('bump');
      ball.classList.remove('floating');
      ball.classList.add('popping');
      spawnConfetti(ballCX, ballCY);
      playCorrectSound();
      showToast('+100 CORRECT!', 'correct');
    } else {
      triggerCannonShake();
      score = Math.max(0, score - 10);
      scoreEl.textContent = score;
      scoreEl.classList.remove('bump');
      void scoreEl.offsetWidth;
      scoreEl.classList.add('bump');
      ball.classList.remove('floating');
      // Scatter exit direction
      const exitClasses = ['exit-left', 'exit-right', 'exit-up'];
      ball.classList.add(exitClasses[index % 3]);
      optPills[index].classList.add('removed');
      playWrongSound();
      showToast('-10 WRONG!', 'wrong');
    }
    setTimeout(loadNextQuestion, 1300);
  }

  // ─── Confetti burst ───────────────────────────────────────
  const CONFETTI_COLORS = ['#ffd43b', '#ff6b6b', '#69db7c', '#74c0fc', '#f06595', '#fff', '#a9e34b'];
  function spawnConfetti(cx, cy) {
    if (typeof confetti === 'function') {
      const originX = 0.5;
      const originY = 0.5;

      const count = 300;
      const defaults = {
        origin: { x: originX, y: originY },
        colors: CONFETTI_COLORS,
        zIndex: 9999,
        scalar: 1.4,
        disableForReducedMotion: true
      };

      function fire(particleRatio, opts) {
        confetti(Object.assign({}, defaults, opts, {
          particleCount: Math.floor(count * particleRatio)
        }));
      }

      fire(0.25, { spread: 26, startVelocity: 55 });
      fire(0.2, { spread: 60 });
      fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
      fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
      fire(0.1, { spread: 120, startVelocity: 45 });
    }
  }


  // ─── Load Question ────────────────────────────────────────
  function loadNextQuestion() {
    cancelAnimationFrame(animFrame);
    isShooting = false;
    isAiming = false;
    fiftyBtn.disabled = false;
    clearTrajectory();
    bulletEl.classList.add('hidden');
    loadedBall.style.opacity = '1';


    // Scatter remaining visible balls out before loading new question
    balls.forEach((ball, i) => {
      if (!ball.classList.contains('hidden') &&
        !ball.classList.contains('popping') &&
        !ball.classList.contains('exit-left') &&
        !ball.classList.contains('exit-right') &&
        !ball.classList.contains('exit-up')) {
        ball.classList.remove('floating');
        const exits = ['exit-left', 'exit-right', 'exit-up'];
        ball.classList.add(exits[i % 3]);
      }
    });

    // After exit animation, load new question
    setTimeout(() => {
      cannonBarrel.style.transform = 'rotate(0deg)';
      currentAngleDeg = 0;

      if (questions.length === 0) return;
      if (unusedQuestions.length === 0) {
        showToast('🎉 All questions completed! Starting next round!', 'success');
        unusedQuestions = [...questions];
      }
      const qIndex = Math.floor(Math.random() * unusedQuestions.length);
      currentQuestion = unusedQuestions[qIndex];
      unusedQuestions.splice(qIndex, 1);

      // Question text entrance
      stateNameEl.classList.remove('question-entering');
      void stateNameEl.offsetWidth;
      stateNameEl.classList.add('question-entering');
      qLabelEl.textContent = `${questionNumber}. What is the capital of`;
      stateNameEl.textContent = currentQuestion.state + ' ?';
      questionNumber++;

      // 3 unique wrong options
      const wrong = [];
      while (wrong.length < 3) {
        const rq = questions[Math.floor(Math.random() * questions.length)];
        if (rq.capital !== currentQuestion.capital && !wrong.includes(rq.capital)) wrong.push(rq.capital);
      }
      currentOptions = [currentQuestion.capital, ...wrong].sort(() => Math.random() - 0.5);

      // Update pills with staggered entrance
      optTexts.forEach((el, i) => el.textContent = currentOptions[i]);
      optPills.forEach((p, i) => {
        p.classList.remove('removed', 'entering');
        void p.offsetWidth;
        p.style.animationDelay = `${i * 0.07}s`;
        p.classList.add('entering');
        p.addEventListener('animationend', () => { p.classList.remove('entering'); p.style.animationDelay = ''; }, { once: true });
      });

      // Pick 4 non-overlapping cells
      const paRect = playArea.getBoundingClientRect();
      const shuffled = [...GRID_CELLS].sort(() => Math.random() - 0.5);
      const chosen = [];
      const BALL_D = 29;
      for (const cell of shuffled) {
        const cx = (cell.left / 100) * paRect.width;
        const cy = 25 + cell.row * 39;
        let ok = true;
        for (const c of chosen) {
          const ox = (c.left / 100) * paRect.width;
          const oy = 25 + c.row * 39;
          if (Math.hypot(cx - ox, cy - oy) < BALL_D + 8) { ok = false; break; }
        }
        if (ok) chosen.push(cell);
        if (chosen.length === 4) break;
      }

      // Staggered ball entrance
      balls.forEach((ball, i) => {
        ball.className = `ball ${['color-red', 'color-green', 'color-gold', 'color-blue'][i]}`;
        ball.style.opacity = '';
        ball.style.animation = '';
        ball.style.left = `${chosen[i].left}%`;
        ball.style.top = `${25 + chosen[i].row * 39}px`;
        ball.style.animationDelay = `${i * 0.08}s`;
        setTimeout(() => {
          ball.classList.add('entering');
          ball.addEventListener('animationend', () => {
            ball.classList.remove('entering');
            ball.style.animationDelay = `${(Math.random() * 1.5).toFixed(2)}s`;
            ball.classList.add('floating');
          }, { once: true });
        }, i * 80);
      });
    }, 480); // wait for exit animations
  }

  // ─── Feedback Popup ────────────────────────────────────────
  function showToast(msg, type) {
    const popup = document.createElement('div');
    popup.className = `feedback-popup ${type}`;
    popup.textContent = msg;
    container.appendChild(popup);
    setTimeout(() => popup.remove(), 1200);
  }

  // ─── 50/50 ────────────────────────────────────────────────
  function useFiftyFifty() {
    if (fiftyBtn.disabled || isShooting) return;
    fiftyBtn.disabled = true;
    const wrongIdx = currentOptions
      .map((o, i) => o !== currentQuestion.capital ? i : -1)
      .filter(i => i !== -1)
      .sort(() => Math.random() - 0.5)
      .slice(0, 2);
    wrongIdx.forEach(i => {
      balls[i].classList.remove('floating');
      const exits = ['exit-left', 'exit-right', 'exit-up'];
      balls[i].classList.add(exits[i % 3]);
      optPills[i].classList.add('removed');
      balls[i].addEventListener('animationend', () => balls[i].classList.add('hidden'), { once: true });
    });
  }

  // ─── Buttons ──────────────────────────────────────────────
  fiftyBtn.addEventListener('click', useFiftyFifty);

  hintBtn.addEventListener('click', () => {
    if (!currentQuestion) return;
    hintText.textContent = currentQuestion.hint;
    hintModal.classList.remove('hidden');
  });
  closeHint.addEventListener('click', () => hintModal.classList.add('hidden'));

  restartBtn.addEventListener('click', () => {
    cancelAnimationFrame(animFrame);
    isShooting = false;
    isAiming = false;
    score = 0;
    attempted = 0;
    questionNumber = 1;
    scoreEl.textContent = '0';
    bulletEl.classList.add('hidden');
    clearTrajectory();
    unusedQuestions = [...questions];
    loadNextQuestion();
  });

  function togglePause() {
    isPaused = !isPaused;
    pauseOverlay.classList.toggle('hidden', !isPaused);
    pauseBtn.querySelector('span').textContent = isPaused ? '▶️' : '⏸';
    if (!isPaused && !isShooting) {
      balls.forEach(b => { if (!b.classList.contains('hidden')) b.classList.add('floating'); });
    }
  }
  pauseBtn.addEventListener('click', togglePause);
  pauseOverlay.addEventListener('click', () => { if (isPaused) togglePause(); });
});
