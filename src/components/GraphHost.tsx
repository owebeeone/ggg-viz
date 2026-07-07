import { useGrip } from '@owebeeone/grip-react';
import { stepId, type Actor } from '../scenario/types';
import {
  ACTIVE_EDGE,
  ACTOR_ACTIVITY,
  ACTOR_STATE,
  CURRENT_SCENARIO,
  CURRENT_STEP,
  FOCUSED_ACTOR,
  FOCUSED_ACTOR_TAP,
  SELECTED_STEP_TAP,
  STEP_INDEX,
  VISIBLE_ACTORS,
} from '../grips';
import { VIZ_GRAPH_ENGINE, VIZ_GRAPH_NODES } from '../graphviz/grips';
import { VBH, VBW, type SimActorInput, type VizRenderNode } from '../graphviz/engine';
import ActorNode from './ActorNode';

function toCanvas(svg: SVGSVGElement, clientX: number, clientY: number) {
  const rect = svg.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * (VBW / rect.width),
    y: (clientY - rect.top) * (VBH / rect.height),
  };
}

function boundaryIntersection(from: VizRenderNode, to: VizRenderNode) {
  const dx = from.x - to.x;
  const dy = from.y - to.y;
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return { x: to.x, y: to.y };
  const scale = Math.min((to.w / 2) / (Math.abs(dx) || Infinity), (to.h / 2) / (Math.abs(dy) || Infinity));
  return { x: to.x + dx * scale, y: to.y + dy * scale };
}

// Base/expanded dims by role — geometry hints for the sim.
const DIMS: Record<string, { baseW: number; baseH: number; expW: number; expH: number }> = {
  client: { baseW: 176, baseH: 62, expW: 300, expH: 290 },
  node: { baseW: 204, baseH: 70, expW: 330, expH: 340 },
  plane: { baseW: 220, baseH: 58, expW: 300, expH: 250 },
  provider: { baseW: 204, baseH: 70, expW: 330, expH: 350 },
  service: { baseW: 176, baseH: 58, expW: 300, expH: 270 },
};

function simInput(a: Actor): SimActorInput {
  const d = DIMS[a.role] ?? DIMS.node;
  return { id: a.id, seedX: a.x, seedY: a.y, role: a.role, temp: a.temp ?? false, ...d };
}

// A hexagon path for temporary (service) nodes — the "different shape".
function hexPath(w: number, h: number): string {
  const x = w / 2;
  const y = h / 2;
  const c = Math.min(18, w * 0.12);
  return `M ${-x + c} ${-y} L ${x - c} ${-y} L ${x} 0 L ${x - c} ${y} L ${-x + c} ${y} L ${-x} 0 Z`;
}

export default function GraphHost() {
  const scenario = useGrip(CURRENT_SCENARIO);
  const visible = useGrip(VISIBLE_ACTORS) ?? [];
  const activity = useGrip(ACTOR_ACTIVITY) ?? new Map();
  const state = useGrip(ACTOR_STATE) ?? new Map();
  const step = useGrip(CURRENT_STEP);
  const edge = useGrip(ACTIVE_EDGE);
  const stepIndex = useGrip(STEP_INDEX) ?? 0;
  const engine = useGrip(VIZ_GRAPH_ENGINE);
  const nodes = useGrip(VIZ_GRAPH_NODES) ?? [];
  const focused = useGrip(FOCUSED_ACTOR) ?? null;
  const focusTap = useGrip(FOCUSED_ACTOR_TAP);
  const selectTap = useGrip(SELECTED_STEP_TAP);

  if (!scenario) return <div className="graph-wrap" />;

  const visibleSet = new Set(visible);
  const actorsById = new Map(scenario.actors.map((a) => [a.id, a]));

  // Feed the sim (idempotent; keyed by scenario + visible ids). Same pattern
  // as gryth-ui's WorkspaceViewer: setInput in render, engine dedups.
  const inputs = scenario.actors.filter((a) => visibleSet.has(a.id)).map(simInput);
  const pairs: Array<{ source: string; target: string }> = [];
  const seen = new Set<string>();
  for (const s of scenario.steps) {
    if (s.kind !== 'message' || !s.to) continue;
    const key = [s.from, s.to].sort().join('~');
    if (!seen.has(key)) {
      seen.add(key);
      pairs.push({ source: s.from, target: s.to });
    }
  }
  const visiblePairs = pairs.filter((p) => visibleSet.has(p.source) && visibleSet.has(p.target));
  engine?.setInput(inputs, visiblePairs, scenario.id);
  // The FOCUSED_ACTOR grip is the source of truth for expansion; the engine's
  // pin follows it (idempotent), so menu resets and comment jumps expand too.
  if (engine && engine.pinnedId() !== focused) engine.pin(focused);

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const ordered = [...nodes].sort((a, b) => Number(a.expanded) - Number(b.expanded));

  // Active edge geometry from LIVE positions.
  let activeLine = null;
  let callout = null;
  if (edge && step) {
    const s = byId.get(edge.from);
    const t = byId.get(edge.to);
    if (s && t) {
      const ti = boundaryIntersection(s, t);
      const si = boundaryIntersection(t, s);
      const cls = edge.response ? 'resp' : 'req';
      activeLine = (
        <g className={`edge-active ${cls}`} onClick={() => selectTap?.set(stepIndex)}>
          <path
            className="edge-wire"
            d={`M ${si.x} ${si.y} L ${ti.x} ${ti.y}`}
            markerEnd={`url(#gv-arrow-${cls})`}
          />
        </g>
      );
      const mid = { x: (si.x + ti.x) / 2, y: (si.y + ti.y) / 2 - 16 };
      const caption = `${step.frame} — ${edge.response ? 'response' : 'message sent'}`;
      const w = caption.length * 6.6 + 26;
      const lx = mid.x - w / 2;
      const ly = mid.y - 14;
      callout = (
        <g className={`edge-active ${cls}`} onClick={() => selectTap?.set(stepIndex)}>
          <g className="edge-label">
            <rect x={lx} y={ly} width={w} height={24} rx="12" />
            <text x={lx + w / 2} y={ly + 16} textAnchor="middle">
              {caption}
            </text>
          </g>
          {step.gate && (
            <g className={`gate-badge gate-${step.gate.status}`}>
              <rect x={mid.x - w / 2} y={mid.y + 14} width={w} height={18} rx="6" />
              <text x={mid.x} y={mid.y + 27} textAnchor="middle">
                ⛩ {step.gate.label}
              </text>
            </g>
          )}
        </g>
      );
    }
  }

  // Internal-step badge rides its actor (drawn in the callout layer, on top).
  let internalBadge = null;
  if (step && step.kind === 'internal') {
    const n = byId.get(step.from);
    if (n) {
      const caption = `${stepId(step)} ${step.label}`;
      const w = caption.length * 6.4 + 24;
      internalBadge = (
        <g
          className={`gate-badge gate-${step.gate?.status ?? 'designed'}`}
          onClick={() => selectTap?.set(stepIndex)}
        >
          <rect x={n.x - w / 2} y={n.y - n.h / 2 - 26} width={w} height={20} rx="7" />
          <text x={n.x} y={n.y - n.h / 2 - 12} textAnchor="middle">
            {step.gate ? '⛩ ' : '⚙ '}
            {caption}
          </text>
        </g>
      );
    }
  }

  return (
    <div className="graph-wrap">
      <div className="graph-toolbar">
        <span className="graph-hint">
          drag to anchor · click a node to pin its state · click the edge label for the payload
        </span>
        <button className="graph-ghost" onClick={() => engine?.scatter()}>
          ↻ re-layout
        </button>
      </div>
      <svg
        className="graph-svg"
        viewBox={`0 0 ${VBW} ${VBH}`}
        preserveAspectRatio="xMidYMid meet"
        onMouseMove={(e) => engine?.moveDrag(toCanvas(e.currentTarget, e.clientX, e.clientY))}
        onMouseUp={() => engine?.endDrag()}
        onMouseLeave={() => engine?.endDrag()}
        onClick={() => focusTap?.set(null)}
      >
        <defs>
          <marker id="gv-arrow-req" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent)" />
          </marker>
          <marker id="gv-arrow-resp" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--resp)" />
          </marker>
        </defs>

        {/* base topology (under everything) */}
        <g>
          {visiblePairs.map((p) => {
            const a = byId.get(p.source);
            const b = byId.get(p.target);
            if (!a || !b) return null;
            const ai = boundaryIntersection(b, a);
            const bi = boundaryIntersection(a, b);
            return (
              <line
                key={`${p.source}~${p.target}`}
                className="edge-base"
                x1={ai.x}
                y1={ai.y}
                x2={bi.x}
                y2={bi.y}
              />
            );
          })}
        </g>

        {activeLine}

        {/* nodes */}
        <g>
          {ordered.map((n) => {
            const actor = actorsById.get(n.id);
            if (!actor) return null;
            return (
              <g
                key={n.id}
                className={`gv-node role-${n.role} ${n.temp ? 'temp' : ''} act-${activity.get(n.id) ?? 'idle'}`}
                transform={`translate(${n.x}, ${n.y})`}
                onMouseEnter={() => engine?.setHover(n.id)}
                onMouseLeave={() => engine?.setHover(null)}
                onMouseDown={(e) => {
                  const svg = (e.currentTarget as SVGGElement).ownerSVGElement;
                  if (svg) engine?.startDrag(n.id, toCanvas(svg, e.clientX, e.clientY));
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  focusTap?.set(focused === n.id ? null : n.id);
                }}
                style={{ cursor: 'grab' }}
              >
                {n.temp ? (
                  <path className="gv-box" d={hexPath(n.w, n.h)} />
                ) : (
                  <rect className="gv-box" x={-n.w / 2} y={-n.h / 2} width={n.w} height={n.h} rx={12} />
                )}
                {!n.temp && <rect className="gv-stripe" x={-n.w / 2} y={-n.h / 2} width={5} height={n.h} rx={2} />}
                <foreignObject
                  x={-n.w / 2 + 10}
                  y={-n.h / 2 + 6}
                  width={n.w - 18}
                  height={n.h - 12}
                >
                  <ActorNode
                    actor={actor}
                    activity={activity.get(n.id) ?? 'idle'}
                    expanded={n.expanded}
                    state={state.get(n.id) ?? {}}
                    touched={new Set(Object.keys(step?.sets?.[n.id] ?? {}))}
                  />
                </foreignObject>
              </g>
            );
          })}
        </g>

        {/* callouts last — never hidden behind nodes */}
        {callout}
        {internalBadge}
      </svg>
    </div>
  );
}
