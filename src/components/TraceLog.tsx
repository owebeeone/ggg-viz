import { useGrip } from '@owebeeone/grip-react';
import { stepId } from '../scenario/types';
import { CURRENT_SCENARIO, SELECTED_STEP, SELECTED_STEP_TAP, TRACE } from '../grips';
import { COMMENTS } from '../comments/comments_taps';
import { commentedSteps } from '../comments/model';

export default function TraceLog() {
  const trace = useGrip(TRACE) ?? [];
  const selected = useGrip(SELECTED_STEP) ?? null;
  const selectTap = useGrip(SELECTED_STEP_TAP);
  const scenario = useGrip(CURRENT_SCENARIO);
  const comments = useGrip(COMMENTS) ?? [];
  const noted = scenario ? commentedSteps(comments, scenario.id) : new Set<number>();

  // Newest first; a row's scenario index = its position in the trace prefix.
  const rows = trace.map((s, idx) => ({ s, idx })).reverse();
  return (
    <div className="trace">
      <h3>trace</h3>
      <ul>
        {rows.map(({ s, idx }, pos) => (
          <li key={idx}>
            <button
              className={`rowbtn ${pos === 0 ? 'current' : ''} ${idx === selected ? 'selected' : ''} ${s.response ? 'resp' : ''}`}
              onClick={() => selectTap?.set(idx)}
            >
              <span className={`step-id ${s.variant ? 'variant' : ''}`}>{stepId(s)}</span>
              <span className="frame">{s.frame}</span>
              <span className="route">
                {s.from}
                {s.to ? `→${s.to}` : ''}
              </span>
              {noted.has(idx) && <span className="note-dot" title="has notes">💬</span>}
              {s.gate && <span className={`gate-dot g-${s.gate.status}`} title={s.gate.label} />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
