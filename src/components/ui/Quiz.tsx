import { useId, useState } from 'react';
import { RichText } from './Tex';

interface ChoiceQuizProps {
  question: string;
  options: string[];
  /** Index of the correct option. */
  answer: number;
  /** Shown after any attempt, right or wrong. */
  explanation: string;
}

/** Multiple-choice "check yourself" question. Text supports $math$ and \$ for dollars. */
export function Quiz({ question, options, answer, explanation }: ChoiceQuizProps) {
  const [picked, setPicked] = useState<number | null>(null);
  const id = useId();
  const answered = picked !== null;
  const correct = picked === answer;
  return (
    <div className="quiz" role="group" aria-labelledby={id}>
      <p className="quiz-q" id={id}><span className="quiz-badge">Check yourself</span><RichText>{question}</RichText></p>
      <div className="quiz-options">
        {options.map((o, i) => {
          const state = !answered ? '' : i === answer ? 'right' : i === picked ? 'wrong' : 'dim';
          return (
            <button key={i} type="button" className={`quiz-option ${state}`} onClick={() => setPicked(i)} aria-pressed={picked === i}>
              <span className="quiz-letter">{String.fromCharCode(65 + i)}</span>
              <span><RichText>{o}</RichText></span>
            </button>
          );
        })}
      </div>
      {answered && (
        <div className={`quiz-feedback ${correct ? 'right' : 'wrong'}`} role="status">
          <strong>{correct ? 'Correct.' : 'Not quite.'}</strong> <RichText>{explanation}</RichText>
          {!correct && (
            <button type="button" className="quiz-retry" onClick={() => setPicked(null)}>Try again</button>
          )}
        </div>
      )}
    </div>
  );
}

interface NumericQuizProps {
  question: string;
  answer: number;
  /** Absolute tolerance for a correct answer. */
  tolerance?: number;
  /** Shown before the input, e.g. "\$". */
  prefix?: string;
  explanation: string;
}

/** Numeric-answer "check yourself" question. */
export function NumericQuiz({ question, answer, tolerance = 0.01, prefix, explanation }: NumericQuizProps) {
  const [value, setValue] = useState('');
  const [checked, setChecked] = useState<boolean | null>(null);
  const id = useId();
  const check = () => {
    const x = Number(value.replace(/[,$\s]/g, ''));
    setChecked(Number.isFinite(x) && value.trim() !== '' && Math.abs(x - answer) <= tolerance);
  };
  return (
    <div className="quiz" role="group" aria-labelledby={id}>
      <p className="quiz-q" id={id}><span className="quiz-badge">Check yourself</span><RichText>{question}</RichText></p>
      <form className="quiz-numeric" onSubmit={(e) => { e.preventDefault(); check(); }}>
        {prefix && <span className="quiz-prefix"><RichText>{prefix}</RichText></span>}
        <input inputMode="decimal" value={value} onChange={(e) => { setValue(e.target.value); setChecked(null); }} aria-label="Your answer" />
        <button type="submit" className="ctl-button">Check</button>
      </form>
      {checked !== null && (
        <div className={`quiz-feedback ${checked ? 'right' : 'wrong'}`} role="status">
          <strong>{checked ? 'Correct.' : 'Not quite.'}</strong> {checked ? <RichText>{explanation}</RichText> : 'Have another go — or reveal the answer.'}
          {!checked && (
            <button type="button" className="quiz-retry" onClick={() => { setValue(String(answer)); setChecked(true); }}>Reveal answer</button>
          )}
        </div>
      )}
    </div>
  );
}
