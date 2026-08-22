interface Props {
  fiftyDisabled: boolean;
  isPaused: boolean;
  onUseFiftyFifty: () => void;
  onShowHint: () => void;
  onRestartClick: () => void;
  onTogglePause: () => void;
}

export default function BottomBar({
  fiftyDisabled,
  isPaused,
  onUseFiftyFifty,
  onShowHint,
  onRestartClick,
  onTogglePause,
}: Props) {
  return (
    <div id="bottom-bar">
      <div id="fifty-area">
        <button id="fifty-fifty-btn" title="50/50" disabled={fiftyDisabled} onClick={onUseFiftyFifty}>
          <img src="./assets/fifty.png" alt="50/50" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </button>
      </div>
      <div id="right-btns">
        <button className="round-btn blue-btn" title="Hint" onClick={onShowHint}>
          <span>💡</span>
        </button>
        <button className="round-btn orange-btn" title="Restart" onClick={onRestartClick}>
          <span style={{ color: 'white', fontSize: '1.4rem', paddingBottom: '2px' }}>🔄</span>
        </button>
        <button className="round-btn pink-btn" title="Pause" onClick={onTogglePause}>
          <span>{isPaused ? '▶️' : '⏸'}</span>
        </button>
      </div>
    </div>
  );
}
