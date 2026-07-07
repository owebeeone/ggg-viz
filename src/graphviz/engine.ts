// Private copy of gryth-ui's workspace graph engine
// (packages/plugins/workspace/src/graphEngine.ts), adapted for ggg-viz:
//   - nodes are generic sim bodies (id + seed + dims + role); all CONTENT
//     rendering stays in ggg-viz components,
//   - setInput diffs by id and PRESERVES surviving node positions, so
//     temporary nodes (service instances) enter/leave without re-scattering,
//   - new nodes spawn at their declared seed position.
// The physics loop is kept verbatim in spirit: spring + gravity + repulsion
// + collision + friction, RAF-driven, settles on low activity. No react
// state anywhere — the sim owns its state; a tap publishes snapshots.
import { BaseTap } from '@owebeeone/grip-react';
import { VIZ_GRAPH_ENGINE, VIZ_GRAPH_NODES } from './grips';

export const VBW = 1080;
export const VBH = 640;
const SPRING_LEN = 265;
const SPRING_K = 0.03;
const PADDING = 56;
const GRAVITY = 0.008;
const FRICTION = 0.84;
const REPULSION = 5200;
const SETTLE = 0.18;

export interface SimActorInput {
  id: string;
  seedX: number;
  seedY: number;
  baseW: number;
  baseH: number;
  expW: number;
  expH: number;
  role: string;
  temp: boolean;
}

export interface SimEdge {
  source: string;
  target: string;
}

export interface VizRenderNode {
  id: string;
  role: string;
  temp: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  expanded: boolean;
}

interface PNode extends SimActorInput {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
}

export class VizGraphEngine {
  private nodes: PNode[] = [];
  private links: SimEdge[] = [];
  private inputKey = '';
  private hover: string | null = null;
  private dragId: string | null = null;
  private pinned: string | null = null;
  private dragOffX = 0;
  private dragOffY = 0;
  private publishFn: ((n: VizRenderNode[]) => void) | null = null;
  private raf = 0;
  private running = false;

  setInput(actors: SimActorInput[], edges: SimEdge[], scope = '') {
    const key = `${scope}::${actors.map((a) => a.id).join('|')}::${edges
      .map((e) => `${e.source}->${e.target}`)
      .join('|')}`;
    if (key === this.inputKey) return;
    const scopeChanged = !this.inputKey.startsWith(`${scope}::`);
    this.inputKey = key;

    // Diff by id: survivors keep position+velocity; newcomers seed.
    const prior = new Map(this.nodes.map((n) => [n.id, n]));
    this.nodes = actors.map((a) => {
      const old = scopeChanged ? undefined : prior.get(a.id);
      return {
        ...a,
        x: old?.x ?? a.seedX,
        y: old?.y ?? a.seedY,
        vx: old?.vx ?? (Math.random() - 0.5) * 2,
        vy: old?.vy ?? (Math.random() - 0.5) * 2,
        width: old?.width ?? a.baseW,
        height: old?.height ?? a.baseH,
      };
    });
    this.links = edges;
    if (scopeChanged) this.pinned = null;
    this.publishFn?.(this.snapshot());
    this.wake();
  }

  current() {
    return this.snapshot();
  }

  attach(fn: (n: VizRenderNode[]) => void) {
    this.publishFn = fn;
    fn(this.snapshot());
    this.wake();
  }

  detach() {
    this.publishFn = null;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.running = false;
  }

  setHover(id: string | null) {
    if (this.hover !== id) {
      this.hover = id;
      this.wake();
    }
  }

  pin(id: string | null) {
    if (this.pinned !== id) {
      this.pinned = id;
      this.wake();
    }
  }

  pinnedId() {
    return this.pinned;
  }

  startDrag(id: string, p: { x: number; y: number }) {
    this.dragId = id;
    const n = this.nodes.find((x) => x.id === id);
    if (n) {
      this.dragOffX = p.x - n.x;
      this.dragOffY = p.y - n.y;
    }
    this.wake();
  }

  moveDrag(p: { x: number; y: number }) {
    if (!this.dragId) return;
    const n = this.nodes.find((x) => x.id === this.dragId);
    if (n) {
      n.x = p.x - this.dragOffX;
      n.y = p.y - this.dragOffY;
      n.vx = 0;
      n.vy = 0;
    }
    this.wake();
  }

  endDrag() {
    if (this.dragId) {
      this.dragId = null;
      this.wake();
    }
  }

  scatter() {
    this.nodes.forEach((n) => {
      n.vx = (Math.random() - 0.5) * 22;
      n.vy = (Math.random() - 0.5) * 22;
    });
    this.wake();
  }

  private isExpanded(id: string) {
    return this.pinned === id || this.hover === id || this.dragId === id;
  }

  private snapshot(): VizRenderNode[] {
    return this.nodes.map((n) => ({
      id: n.id,
      role: n.role,
      temp: n.temp,
      x: n.x,
      y: n.y,
      w: n.width,
      h: n.height,
      expanded: this.isExpanded(n.id),
    }));
  }

  private wake() {
    if (!this.running && this.publishFn) {
      this.running = true;
      this.raf = requestAnimationFrame(() => this.step());
    }
  }

  private step() {
    const { nodes, links, dragId } = this;
    if (!nodes.length) {
      this.publishFn?.([]);
      this.running = false;
      return;
    }
    let activity = 0;

    nodes.forEach((n) => {
      const exp = this.isExpanded(n.id);
      const tw = exp ? n.expW : n.baseW;
      const th = exp ? n.expH : n.baseH;
      n.width += (tw - n.width) * 0.16;
      n.height += (th - n.height) * 0.16;
      activity += Math.abs(tw - n.width) + Math.abs(th - n.height);
    });

    links.forEach((l) => {
      const s = nodes.find((n) => n.id === l.source);
      const t = nodes.find((n) => n.id === l.target);
      if (!s || !t) return;
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
      const f = (dist - SPRING_LEN) * SPRING_K;
      const fx = (dx / dist) * f;
      const fy = (dy / dist) * f;
      if (s.id !== dragId) {
        s.vx += fx;
        s.vy += fy;
      }
      if (t.id !== dragId) {
        t.vx -= fx;
        t.vy -= fy;
      }
    });

    nodes.forEach((n) => {
      if (n.id === dragId) return;
      n.vx += (VBW / 2 - n.x) * GRAVITY;
      n.vy += (VBH / 2 - n.y) * GRAVITY;
    });

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const dxRepel = b.x - a.x;
        const dyRepel = b.y - a.y;
        const distSq = Math.max(2400, dxRepel * dxRepel + dyRepel * dyRepel);
        const dist = Math.sqrt(distSq);
        const force = REPULSION / distSq;
        const fx = (dxRepel / dist) * force;
        const fy = (dyRepel / dist) * force;
        if (a.id !== dragId) {
          a.vx -= fx;
          a.vy -= fy;
        }
        if (b.id !== dragId) {
          b.vx += fx;
          b.vy += fy;
        }
        const minW = (a.width + b.width) / 2 + PADDING;
        const minH = (a.height + b.height) / 2 + PADDING;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const ox = minW - Math.abs(dx);
        const oy = minH - Math.abs(dy);
        if (ox > 0 && oy > 0) {
          if (ox < oy) {
            const push = (dx > 0 ? 1 : -1) * ox * 0.5;
            if (a.id !== dragId) {
              a.x -= push;
              a.vx -= push * 0.4;
            }
            if (b.id !== dragId) {
              b.x += push;
              b.vx += push * 0.4;
            }
          } else {
            const push = (dy > 0 ? 1 : -1) * oy * 0.5;
            if (a.id !== dragId) {
              a.y -= push;
              a.vy -= push * 0.4;
            }
            if (b.id !== dragId) {
              b.y += push;
              b.vy += push * 0.4;
            }
          }
        }
      }
    }

    nodes.forEach((n) => {
      if (n.id !== dragId) {
        n.x += n.vx;
        n.y += n.vy;
        activity += Math.abs(n.vx) + Math.abs(n.vy);
        n.vx *= FRICTION;
        n.vy *= FRICTION;
      }
      const px = n.width / 2 + 10;
      const py = n.height / 2 + 10;
      if (n.x < px) {
        n.x = px;
        n.vx *= -0.2;
      }
      if (n.x > VBW - px) {
        n.x = VBW - px;
        n.vx *= -0.2;
      }
      if (n.y < py) {
        n.y = py;
        n.vy *= -0.2;
      }
      if (n.y > VBH - py) {
        n.y = VBH - py;
        n.vy *= -0.2;
      }
    });

    this.publishFn?.(this.snapshot());

    if (activity < SETTLE && !dragId) {
      nodes.forEach((n) => {
        const exp = this.isExpanded(n.id);
        n.width = exp ? n.expW : n.baseW;
        n.height = exp ? n.expH : n.baseH;
        n.vx = 0;
        n.vy = 0;
      });
      this.publishFn?.(this.snapshot());
      this.running = false;
      return;
    }
    this.raf = requestAnimationFrame(() => this.step());
  }
}

// The sim tap (tap-owning-a-loop pattern, verbatim from the source): the RAF
// loop runs only while a consumer is connected.
export class VizSimTap extends BaseTap {
  readonly graph = new VizGraphEngine();

  constructor() {
    super({ provides: [VIZ_GRAPH_NODES, VIZ_GRAPH_ENGINE] });
  }

  private publishNodes = (n: VizRenderNode[]) => {
    this.publish(new Map([[VIZ_GRAPH_NODES as never, n as never]]));
  };

  onConnect(dest: unknown, grip: unknown): void {
    super.onConnect(dest as never, grip as never);
    this.graph.attach(this.publishNodes);
  }

  onDisconnect(dest: unknown, grip: unknown): void {
    super.onDisconnect(dest as never, grip as never);
    const has = (this.producer?.getDestinations().size ?? 0) > 0;
    if (!has) this.graph.detach();
  }

  produce(opts?: { destContext?: unknown }): void {
    this.publish(
      new Map([
        [VIZ_GRAPH_NODES as never, this.graph.current() as never],
        [VIZ_GRAPH_ENGINE as never, this.graph as never],
      ]),
      opts?.destContext as never,
    );
  }

  produceOnParams(): void {}
  produceOnDestParams(): void {}
}
