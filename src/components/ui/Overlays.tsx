import type { QuizQuestion } from '../../types/api';

type FetchState = 'idle' | 'loading' | 'done' | 'error';

interface GameOverlayProps {
  gameStarted: boolean;
  gameOver: boolean;
  quizFetchState: FetchState;
  quizError: string;
  score: number;
  onStartSession: () => void;
  onFetchQuiz: () => void;
}

export function GameOverlay({
  gameStarted,
  gameOver,
  quizFetchState,
  quizError,
  score,
  onStartSession,
  onFetchQuiz
}: GameOverlayProps) {
  if (gameStarted && !gameOver) return null;

  if (gameOver && gameStarted) {
    return (
      <div className="loading-overlay" style={{ zIndex: 450 }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '10px', color: '#ffd43b', fontFamily: "'Bangers', cursive", letterSpacing: '2px' }}>Game Over!</h1>
        <p style={{ fontSize: '1.5rem', marginBottom: '30px' }}>Final Score: <strong>{score}</strong></p>
        <button className="start-btn" onClick={onStartSession}>Play Again</button>
      </div>
    );
  }

  return (
    <div className="loading-overlay">
      <img src="./assets/logo.png" alt="Logo" style={{ width: 150, marginBottom: 20 }} />
      {quizFetchState === 'idle' && (
        <button className="start-btn" onClick={onStartSession}>Start Game</button>
      )}
      {quizFetchState === 'loading' && <p>Loading...</p>}
      {quizFetchState === 'error' && (
        <>
          <p className="error-text">
            An unexpected error occurred. Please contact support. Reference ID: {quizError}
          </p>
          <button className="retry-btn" onClick={onFetchQuiz}>Retry</button>
        </>
      )}
    </div>
  );
}

interface HintModalProps {
  showHint: boolean;
  currentQuestion: QuizQuestion | null;
  onClose: () => void;
}

export function HintModal({ showHint, currentQuestion, onClose }: HintModalProps) {
  if (!showHint || !currentQuestion) return null;
  return (
    <div id="hint-modal">
      <div className="hint-box">
        <h3>💡 Hint</h3>
        <p>{currentQuestion.hint || "No hint available"}</p>
        <button onClick={onClose}>Got it!</button>
      </div>
    </div>
  );
}

interface ConfirmModalProps {
  showConfirmRestart: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmModal({ showConfirmRestart, onCancel, onConfirm }: ConfirmModalProps) {
  if (!showConfirmRestart) return null;
  return (
    <div id="confirm-modal">
      <div className="confirm-box">
        <h3>Restart Game?</h3>
        <p>Are you sure you want to restart?</p>
        <div className="confirm-btns">
          <button className="btn-no" onClick={onCancel}>No</button>
          <button className="btn-yes" onClick={onConfirm}>Yes</button>
        </div>
      </div>
    </div>
  );
}

interface PauseOverlayProps {
  isPaused: boolean;
  showConfirmRestart: boolean;
  onTogglePause: () => void;
}

export function PauseOverlay({ isPaused, showConfirmRestart, onTogglePause }: PauseOverlayProps) {
  if (!isPaused || showConfirmRestart) return null;
  return (
    <div id="pause-overlay" onClick={onTogglePause}>
      <div>Paused</div>
      <p>Tap to resume</p>
      <div className="resume-hint">Resume</div>
    </div>
  );
}
