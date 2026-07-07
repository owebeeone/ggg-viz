import type { Actor } from '../scenario/types';
import type { Activity } from '../scenario/fold';

// Pure content card rendered inside the graph node's foreignObject.
// Geometry belongs to the engine; THIS is what a node says.
export default function ActorNode({
  actor,
  activity,
  expanded,
  state,
  touched,
}: {
  actor: Actor;
  activity: Activity;
  expanded: boolean;
  state: Record<string, string>;
  touched: Set<string>;
}) {
  const stateEntries = Object.entries(state);
  return (
    <div className={`gv-body role-${actor.role} ${expanded ? 'expanded' : ''}`}>
      <div className="gv-title">
        <strong>{actor.label}</strong>
        {activity !== 'idle' && <span className={`gv-activity act-${activity}`}>{activity}</span>}
        {actor.temp && <span className="gv-temp-chip">ephemeral</span>}
      </div>
      <div className="gv-sub">{actor.sub}</div>
      {expanded && (
        <div className="gv-detail">
          {stateEntries.length > 0 && (
            <table className="gv-state">
              <tbody>
                {stateEntries.map(([k, v]) => (
                  <tr key={k} className={touched.has(k) ? 'touched' : ''}>
                    <td className="k">{k}</td>
                    <td className="v">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <ul className="gv-internals">
            {actor.internals.map((i) => (
              <li key={i.id} title={i.note}>
                <b>{i.label}</b>
                {i.note ? <span> — {i.note}</span> : null}
              </li>
            ))}
          </ul>
          <p className="gv-blurb">{actor.blurb}</p>
        </div>
      )}
    </div>
  );
}
