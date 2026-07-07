import { useGrip } from '@owebeeone/grip-react';
import type { FormEvent } from 'react';
import { stepId } from '../scenario/types';
import {
  CURRENT_SCENARIO,
  CURRENT_STEP,
  FOCUSED_ACTOR,
  FOCUSED_ACTOR_TAP,
  SELECTED_STEP,
  SELECTED_STEP_TAP,
  STEP_INDEX,
  STEP_INDEX_TAP,
} from '../grips';
import { COMMENTS } from '../comments/comments_taps';
import { addComment } from '../comments/comments_taps';
import { commentsForScenario, otherScenarioCount } from '../comments/model';

export default function CommentsPanel() {
  const scenario = useGrip(CURRENT_SCENARIO);
  const step = useGrip(CURRENT_STEP);
  const i = useGrip(STEP_INDEX) ?? 0;
  const focused = useGrip(FOCUSED_ACTOR) ?? null;
  const pinned = useGrip(SELECTED_STEP) ?? null;
  const all = useGrip(COMMENTS) ?? [];
  const stepTap = useGrip(STEP_INDEX_TAP);
  const focusTap = useGrip(FOCUSED_ACTOR_TAP);
  const selectTap = useGrip(SELECTED_STEP_TAP);

  if (!scenario || !step) return null;
  const mine = commentsForScenario(all, scenario.id);
  const elsewhere = otherScenarioCount(all, scenario.id);

  // Uncontrolled form — no state hooks; the DOM holds the draft.
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const text = String(new FormData(form).get('text') ?? '').trim();
    if (!text) return;
    void addComment({
      scenarioId: scenario.id,
      stepIndex: i,
      stepId: stepId(step),
      phase: step.phase,
      focusedActor: focused,
      pinnedStep: pinned,
      text,
    });
    form.reset();
  };

  const jump = (idx: number, actor: string | null) => {
    stepTap?.set(idx);
    selectTap?.set(null);
    focusTap?.set(actor);
  };

  return (
    <div className="comments">
      <h3>
        notes <span className="anchor">@ {stepId(step)}{focused ? ` · ${focused}` : ''}</span>
      </h3>
      <form onSubmit={submit}>
        <textarea
          name="text"
          rows={2}
          placeholder={`Comment on ${scenario.id} at ${stepId(step)}…`}
        />
        <button type="submit">add note</button>
      </form>
      <ul>
        {mine.map((c) => (
          <li key={c.id} className={`c-${c.status}`}>
            <button className="rowbtn" onClick={() => jump(c.stepIndex, c.focusedActor)}>
              <span className="step-id">{c.stepId}</span>
              <span className={`c-status ${c.status}`}>{c.status}</span>
              <span className="c-text">{c.text}</span>
              {c.reply && <span className="c-reply">↳ {c.reply}</span>}
            </button>
          </li>
        ))}
      </ul>
      {elsewhere > 0 && <p className="c-elsewhere">{elsewhere} note{elsewhere === 1 ? '' : 's'} in other traces</p>}
    </div>
  );
}
