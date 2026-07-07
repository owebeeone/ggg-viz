import { useGrip } from '@owebeeone/grip-react';
import { SCENARIOS } from '../scenario';
import {
  FOCUSED_ACTOR_TAP,
  SCENARIO_ID,
  SCENARIO_ID_TAP,
  SELECTED_STEP_TAP,
  STEP_INDEX_TAP,
} from '../grips';

const STAGE_LABELS: Record<number, string> = {
  1: 'Stage 1 — substrate (allow-all)',
  2: 'Stage 2 — security enforced',
  3: 'Stack — grip · glial · glade',
};

export default function ScenarioMenu() {
  const currentId = useGrip(SCENARIO_ID);
  const idTap = useGrip(SCENARIO_ID_TAP);
  const stepTap = useGrip(STEP_INDEX_TAP);
  const selectTap = useGrip(SELECTED_STEP_TAP);
  const focusTap = useGrip(FOCUSED_ACTOR_TAP);

  const open = (id: string) => {
    idTap?.set(id);
    stepTap?.set(0);
    selectTap?.set(null);
    focusTap?.set(null);
  };

  return (
    <nav className="scenario-menu">
      {[1, 2, 3].map((stage) => (
        <section key={stage}>
          <h2>{STAGE_LABELS[stage]}</h2>
          <ul>
            {SCENARIOS.filter((s) => s.stage === stage).map((s) => (
              <li key={s.id}>
                <button
                  className={`scenario-item ${s.id === currentId ? 'current' : ''}`}
                  onClick={() => open(s.id)}
                  title={s.summary}
                >
                  <span className="scenario-name">{s.title}</span>
                  <span className="scenario-meta">
                    {s.steps.length} steps · {s.actors.length} actors
                  </span>
                  <span className="scenario-summary">{s.summary}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}
