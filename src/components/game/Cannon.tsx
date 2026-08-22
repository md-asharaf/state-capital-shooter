import React from 'react';

interface Props {
  cannonAngle: number;
  loadedBallVisible: boolean;
  isMuzzleFlashing: boolean;
  isRecoiling: boolean;
  isShaking: boolean;
  onAimStart: (e: React.MouseEvent | React.TouchEvent) => void;
  onMuzzleFlashEnd: () => void;
  onCannonAnimationEnd: (e: React.AnimationEvent) => void;
}

export default function Cannon({
  cannonAngle,
  loadedBallVisible,
  isMuzzleFlashing,
  isRecoiling,
  isShaking,
  onAimStart,
  onMuzzleFlashEnd,
  onCannonAnimationEnd
}: Props) {
  return (
    <div id="cannon-area">
      <div id="cannon-pivot">
        <div id="cannon-barrel" style={{ transform: `rotate(${cannonAngle}deg)` }} onMouseDown={onAimStart} onTouchStart={onAimStart}>
          <div id="loaded-ball" style={{ opacity: loadedBallVisible ? 1 : 0 }}></div>
          <div id="muzzle-flash" className={isMuzzleFlashing ? 'fire-flash' : ''} onAnimationEnd={onMuzzleFlashEnd}></div>
        </div>
      </div>
      <div id="cannon-body" className={`${isRecoiling ? 'cannon-recoil' : ''} ${isShaking ? 'cannon-shake' : ''}`} onAnimationEnd={onCannonAnimationEnd} onMouseDown={onAimStart} onTouchStart={onAimStart}>
        <div id="cannon-core"></div>
      </div>
      <div id="cannon-stand"></div>
    </div>
  );
}
