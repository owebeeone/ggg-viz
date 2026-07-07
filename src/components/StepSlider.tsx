import { useGrip } from '@owebeeone/grip-react';
import { stepId } from '../scenario/types';
import { clampStep } from '../scenario/fold';
import {
  CURRENT_SCENARIO,
  CURRENT_STEP,
  SELECTED_STEP_TAP,
  STEP_INDEX,
  STEP_INDEX_TAP,
} from '../grips';
import { COMMENTS } from '../comments/comments_taps';
import { commentedSteps } from '../comments/model';

export default function StepSlider() {
  const scenario = useGrip(CURRENT_SCENARIO);
  const i = useGrip(STEP_INDEX) ?? 0;
  const step = useGrip(CURRENT_STEP);
  const stepTap = useGrip(STEP_INDEX_TAP);
  const selectTap = useGrip(SELECTED_STEP_TAP);
  const comments = useGrip(COMMENTS) ?? [];
  if (!scenario) return null;
  const last = scenario.steps.length - 1;
  const ticks = commentedSteps(comments, scenario.id);

  const go = (n: number) => {
    const clamped = clampStep(scenario, n);
    if (clamped === i) return; // blur re-fires 'change' — don't wipe a fresh pin
    stepTap?.set(clamped);
    selectTap?.set(null); // slider motion resumes following the current step
  };

  return (
    <div className="slider">
      <button className="nav" onClick={() => go(i - 1)} disabled={i <= 0} aria-label="previous step">
        ‹
      </button>
      <input
        type="range"
        min={0}
        max={last}
        value={i}
        onChange={(e) => go(Number(e.target.value))}
        aria-label="protocol step"
        list={ticks.size ? 'comment-ticks' : undefined}
      />
      {ticks.size > 0 && (
        <datalist id="comment-ticks">
          {[...ticks].map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      )}
      <button className="nav" onClick={() => go(i + 1)} disabled={i >= last} aria-label="next step">
        ›
      </button>
      <div className="slider-caption">
        <span className="step-id">{step ? stepId(step) : ''}</span> {step?.label}
        <span className="step-count">
          {i + 1} / {last + 1}
        </span>
      </div>
    </div>
  );
}
