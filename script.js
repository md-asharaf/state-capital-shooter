document.addEventListener('DOMContentLoaded', async () => {

  // ─── Load Data ────────────────────────────────────────────
  let questions = [];
  try {
    const res = await fetch('data.json');
    questions = await res.json();
  } catch (e) {
    console.error('Failed to load data.json', e);
    return;
  }

  // ─── DOM ──────────────────────────────────────────────────
  const container = document.getElementById('game-container');
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
  const toast = document.getElementById('toast');
  const restartBtn = document.getElementById('restart-btn');
  const pauseBtn = document.getElementById('pause-btn');
  const pauseOverlay = document.getElementById('pause-overlay');
  const scoreEl      = document.getElementById('score-value');

  // ─── State ────────────────────────────────────────────────
  let currentQuestion = null;
  let currentOptions = [];
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
  // left: 8%→85% (avoids left/right wall, gives ~8% padding each side)
  // top: row gaps of 22% each, starting at 8% (well below candybar)
  const GRID_CELLS = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 9; c++) {
      GRID_CELLS.push({
        top: 8 + r * 22,   //  8, 30, 52, 74%
        left: 8 + c * 8.5   //  8, 16.5, 25, 33.5, 42, 50.5, 59, 67.5, 76%
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
    const wallTop = paRect.top - cRect.top + 22;

    const rad = angleDeg * Math.PI / 180;
    let dirX = Math.sin(rad);
    const dirY = -Math.cos(rad);
    const STEP = 22;

    let sx = ox, sy = oy;
    for (let d = 0; d < 7; d++) {
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
    isShooting = true;
    balls.forEach(b => b.classList.remove('floating'));

    const cRect = container.getBoundingClientRect();
    const paRect = playArea.getBoundingClientRect();
    const wallLeft = paRect.left - cRect.left;
    const wallRight = paRect.right - cRect.left;
    const wallTop = paRect.top - cRect.top + 22;

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
      balls.forEach(b => { if (!b.classList.contains('hidden')) b.classList.add('floating'); });
    }
  }

  // ─── Check Answer ─────────────────────────────────────────
  function checkAnswer(index, ball, ballCX, ballCY) {
    isShooting = false;
    attempted++;
    const correct = currentOptions[index] === currentQuestion.capital;

    if (correct) {
      score++;
      scoreEl.textContent = `${score}/${attempted}`;
      scoreEl.classList.remove('bump');
      void scoreEl.offsetWidth;
      scoreEl.classList.add('bump');
      ball.classList.remove('floating');
      ball.classList.add('popping');
      spawnConfetti(ballCX, ballCY);
      showToast('✅ Correct!', 'success');
    } else {
      triggerCannonShake();
      ball.classList.remove('floating');
      // Scatter exit direction
      const exitClasses = ['exit-left', 'exit-right', 'exit-up'];
      ball.classList.add(exitClasses[index % 3]);
      optPills[index].classList.add('removed');
      showToast('❌ Wrong!', 'error');
    }
    setTimeout(loadNextQuestion, 1300);
  }

  // ─── Confetti burst ───────────────────────────────────────
  const CONFETTI_COLORS = ['#ffd43b', '#ff6b6b', '#69db7c', '#74c0fc', '#f06595', '#fff', '#a9e34b'];
  function spawnConfetti(cx, cy) {
    for (let i = 0; i < 22; i++) {
      const el = document.createElement('div');
      el.style.cssText = `
        position: absolute;
        width: ${6 + Math.random() * 6}px;
        height: ${6 + Math.random() * 6}px;
        border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
        background: ${CONFETTI_COLORS[i % CONFETTI_COLORS.length]};
        pointer-events: none;
        z-index: 999;
        left: ${cx - 4}px;
        top:  ${cy - 4}px;
      `;
      container.appendChild(el);

      const angle = (i / 22) * 360 + (Math.random() * 20 - 10);
      const dist  = 55 + Math.random() * 80;
      const tx    = Math.cos(angle * Math.PI / 180) * dist;
      const ty    = Math.sin(angle * Math.PI / 180) * dist;
      const rot   = (Math.random() * 720 - 360) + 'deg';
      const delay = Math.random() * 100;

      // Web Animations API — each element gets its own computed values
      const anim = el.animate([
        { transform: 'translate(0,0) rotate(0deg) scale(1)',          opacity: 1 },
        { transform: `translate(${tx}px,${ty}px) rotate(${rot}) scale(0.4)`, opacity: 0 }
      ], {
        duration: 650 + Math.random() * 200,
        delay,
        easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        fill: 'forwards'
      });
      anim.onfinish = () => el.remove();
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
      const qIndex = Math.floor(Math.random() * questions.length);
      currentQuestion = questions[qIndex];

      // Question text entrance
      stateNameEl.classList.remove('question-entering');
      void stateNameEl.offsetWidth;
      stateNameEl.classList.add('question-entering');
      stateNameEl.textContent = currentQuestion.state + ' ?';

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
        const cy = (cell.top / 100) * paRect.height;
        let ok = true;
        for (const c of chosen) {
          const ox = (c.left / 100) * paRect.width;
          const oy = (c.top / 100) * paRect.height;
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
        ball.style.top = `${chosen[i].top}%`;
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

  // ─── Toast ────────────────────────────────────────────────
  let toastTimer = null;
  function showToast(msg, type) {
    clearTimeout(toastTimer);
    toast.textContent = msg;
    toast.className = `toast ${type}`;
    toastTimer = setTimeout(() => toast.classList.add('hidden'), 1200);
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
    scoreEl.textContent = '0/0';
    bulletEl.classList.add('hidden');
    clearTrajectory();
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
