import { useGrip } from '@owebeeone/grip-react';
import { stepId } from '../scenario/types';
import { CURRENT_SCENARIO, CURRENT_STEP, SELECTED_STEP, SELECTED_STEP_TAP } from '../grips';

interface PayloadFields {
  share?: string;
  gladeId?: string;
  key?: string;
  shape?: string;
  verb?: string;
  correlationId?: string;
}

const FIELD_LABELS: Array<[keyof PayloadFields, string]> = [
  ['share', 'share'],
  ['gladeId', 'glade id'],
  ['key', 'stream key'],
  ['shape', 'shape'],
  ['verb', 'verb'],
  ['correlationId', 'correlation'],
];

export default function PayloadPanel() {
  const scenario = useGrip(CURRENT_SCENARIO);
  const current = useGrip(CURRENT_STEP);
  const selectedIdx = useGrip(SELECTED_STEP) ?? null;
  const selectTap = useGrip(SELECTED_STEP_TAP);

  const pinned = selectedIdx !== null;
  const step = pinned && scenario ? (scenario.steps[selectedIdx] ?? current) : current;
  if (!step) return <aside className="payload" />;

  const p = step.payload;
  return (
    <aside className="payload">
      <header>
        <span className={`step-id ${step.variant ? 'variant' : ''}`}>{stepId(step)}</span>
        <span className="frame">{step.frame}</span>
        <span className="route">
          {step.from}
          {step.to ? ` → ${step.to}` : ' (internal)'}
        </span>
        {pinned && (
          <button className="unpin" onClick={() => selectTap?.set(null)} title="follow the slider">
            pinned ✕
          </button>
        )}
      </header>

      {step.variant && (
        <div className="variant-card">
          <span className="variant-tag">variant .{step.variant}</span>
          <p>{step.variantNote}</p>
        </div>
      )}

      {p && (
        <table className="fields">
          <tbody>
            {FIELD_LABELS.filter(([k]) => p[k]).map(([k, label]) => (
              <tr key={k}>
                <td className="k">{label}</td>
                <td className={`v v-${k}`}>{p[k]}</td>
              </tr>
            ))}
            {Object.entries(p.detail ?? {}).map(([k, v]) => (
              <tr key={`d-${k}`}>
                <td className="k">{k}</td>
                <td className="v">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {step.gate && (
        <div className={`gate-card gate-${step.gate.status}`}>
          <div className="gate-head">
            ⛩ {step.gate.kind} gate — {step.gate.label}
            <span className="gate-status">{step.gate.status}</span>
          </div>
          <p>{step.gate.note}</p>
        </div>
      )}

      <p className="note">{step.note}</p>
      {step.docRef && <p className="docref">{step.docRef}</p>}
    </aside>
  );
}
