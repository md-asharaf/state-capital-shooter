interface Props {
  score: number;
  isBumpingScore: boolean;
  onBumpEnd: () => void;
}

export default function TopHeader({ score, isBumpingScore, onBumpEnd }: Props) {
  return (
    <div id="top-header">
      <img id="app-logo" src="./assets/logo.png" alt="State Shooter" />
      <div id="score-bar">
        <span id="score-icon">🏆</span>
        <span id="score-value" className={isBumpingScore ? 'bump' : ''} onAnimationEnd={onBumpEnd}>
          {score}
        </span>
      </div>
    </div>
  );
}
