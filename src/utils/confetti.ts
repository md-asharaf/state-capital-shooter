import confetti from 'canvas-confetti';

export const spawnConfettiBurst = (cx: number, cy: number, containerElement?: HTMLElement | null) => {
  let globalX = cx;
  let globalY = cy;
  if (containerElement) {
    const cRect = containerElement.getBoundingClientRect();
    globalX += cRect.left;
    globalY += cRect.top;
  }
  const CONFETTI_COLORS = ['#ffd43b', '#ff6b6b', '#69db7c', '#74c0fc', '#f06595', '#fff', '#a9e34b'];
  const originX = globalX / window.innerWidth;
  const originY = globalY / window.innerHeight;
  const count = 300;
  const defaults = { origin: { x: originX, y: originY }, colors: CONFETTI_COLORS, zIndex: 9999, scalar: 1.4, disableForReducedMotion: true };
  const fire = (particleRatio: number, opts: confetti.Options) => confetti(Object.assign({}, defaults, opts, { particleCount: Math.floor(count * particleRatio) }));
  fire(0.25, { spread: 26, startVelocity: 55 });
  fire(0.2, { spread: 60 });
  fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
  fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
  fire(0.1, { spread: 120, startVelocity: 45 });
};
