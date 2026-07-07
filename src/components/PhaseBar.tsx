import { useGrip } from '@owebeeone/grip-react';
import { CURRENT_SCENARIO, CURRENT_STEP, SELECTED_STEP_TAP, STEP_INDEX_TAP } from '../grips';

export default function PhaseBar() {
  const scenario = useGrip(CURRENT_SCENARIO);
  const step = useGrip(CURRENT_STEP);
  const stepTap = useGrip(STEP_INDEX_TAP);
  const selectTap = useGrip(SELECTED_STEP_TAP);
  if (!scenario) return null;

  return (
    <div className="phasebar">
      {scenario.phases.map((p) => {
        const first = scenario.steps.findIndex((s) => s.phase === p.id);
        const count = scenario.steps.filter((s) => s.phase === p.id).length;
        const current = step?.phase === p.id;
        return (
          <button
            key={p.id}
            className={`phase ${current ? 'current' : ''}`}
            title={p.summary}
            onClick={() => {
              stepTap?.set(first);
              selectTap?.set(null);
            }}
            style={{ flexGrow: count }}
          >
            <span className="phase-id">{p.id}</span> {p.label}
          </button>
        );
      })}
    </div>
  );
}
