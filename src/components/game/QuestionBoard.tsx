import type { QuizQuestion } from '../../types/api';

interface Props {
  questionNumber: number;
  currentQuestion: QuizQuestion | null;
  currentOptions: string[];
  pillStates: { id: number; removed: boolean; entering: boolean }[];
  onPillAnimationEnd: (index: number) => void;
}

export default function QuestionBoard({
  questionNumber,
  currentQuestion,
  currentOptions,
  pillStates,
  onPillAnimationEnd
}: Props) {
  return (
    <div id="question-board">
      <p className="q-label">{questionNumber}. {currentQuestion?.prompt.label || "Question"}</p>
      <h1 id="state-name">{currentQuestion ? currentQuestion.prompt.value : "Loading…"}</h1>
      <div id="options-row">
        {currentOptions.map((opt, i) => (
          <div
            key={i}
            id={`opt-${i}`}
            className={`option-pill ${pillStates[i].removed ? 'removed' : ''} ${pillStates[i].entering ? 'entering' : ''}`}
            onAnimationEnd={() => onPillAnimationEnd(i)}
          >
            <span className={`pill-dot dot-${['red', 'green', 'gold', 'blue'][i]}`}></span>
            <span className="pill-text">{opt}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
