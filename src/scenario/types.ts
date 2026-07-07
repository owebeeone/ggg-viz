// The scenario IS the documentation: a typed, declared trace of the discovery
// protocol. Components are thin projections over it — nothing about the
// sequence may live in component code. (The .glade de-noising principle.)

export type ActorRole = 'client' | 'node' | 'plane' | 'provider' | 'service';

export interface ActorInternal {
  id: string;
  label: string;
  note?: string;
}

export interface Actor {
  id: string;
  label: string;
  sub: string; // one-line role description under the title
  role: ActorRole;
  // Declared layout (SVG viewBox units) — data, not component math.
  x: number;
  y: number;
  w: number;
  h: number;
  internals: ActorInternal[]; // revealed when the actor is focused
  blurb: string; // shown when focused
  // Temporary node (e.g. an instantiated service). Rendered only while its
  // folded state carries an `alive` key; drawn with a distinct shape.
  temp?: boolean;
}

// Wire vocabulary + node-internal activities. Frames marked (†) are the glade
// frame vocabulary (SubstrateV1 §6); the rest are iroh calls or node internals.
export type FrameKind =
  | 'HELLO' //           † session open (principal seam)
  | 'HELLO-ACK' //       † resume/heads
  | 'SUBSCRIBE' //       † interest registration per (share, glade id, key)
  | 'UNSUBSCRIBE' //     † interest withdrawal
  | 'OPS' //             † attributed ops to subscribers
  | 'HEADS' //           † version-vector + chain-head exchange
  | 'EXCHANGE' //        † directed request
  | 'EXCHANGE-RESP' //   † directed response (correlation id)
  | 'STATUS' //          † delivery state surfaced to the consumer
  | 'BIND' //            iroh endpoint bind
  | 'PUBLISH' //         iroh: publish reachability (pkarr/DNS, relay)
  | 'RESOLVE' //         iroh: node id → NodeAddr
  | 'ADDR' //            iroh: resolve answer
  | 'DIAL' //            iroh: open connection to NodeAddr
  | 'FOLD' //            node internal: fold(merge(logs))
  | 'ROUTE' //           node internal: provider routing decision
  | 'PROVIDE' //         provider internal: authority session serves a binding
  | 'SPAWN' //           node internal: instantiate a service instance
  | 'TEARDOWN' //        node internal: retire a service instance
  | 'APPEND' //          † op append into a share (directory writes)
  | 'LEASE' //           claim/lease lifecycle event (publish/renew/lapse/takeover)
  | 'DECLARE' //         client: tap declares a BindingDecl (glade-decl)
  | 'EVENT' //           client: glial's rich change event to taps/consumers
  | 'PERSIST' //         client: glial writes the local store
  | 'HYDRATE'; //        client: glial loads cached fold + tail at boot

export type GateKind = 'security' | 'discovery' | 'capability' | 'routing';

// Gates make the punts visible: each carries its design status honestly.
export type GateStatus = 'stub-allow-all' | 'designed' | 'open-question' | 'enforced';

export interface Gate {
  kind: GateKind;
  label: string;
  status: GateStatus;
  note: string;
}

export type Shape = 'value' | 'log' | 'message' | 'stream' | 'exchange' | 'window';

// What the click shows: the routing payload of a message.
export interface Payload {
  share?: string;
  gladeId?: string;
  key?: string; // canonical-CBOR key, rendered as text
  shape?: Shape;
  verb?: string;
  correlationId?: string;
  detail?: Record<string, string>; // frame-specific extras
}

export type StepKind = 'message' | 'internal';

// Per-actor state patches: actorId → { key: value } (null deletes the key).
// Folding these from step 0..i gives every node's visible state at step i —
// the same op-log→fold model the protocol itself uses.
export type StatePatch = Record<string, Record<string, string | null>>;

export interface Step {
  // Catalog reference: the semantic protocol state this step instantiates.
  // Rendered id = state, or `state.variant` when a twist applies.
  state: string;
  variant?: string; // e.g. 'a' → rendered 'C2.a'
  variantNote?: string; // required with variant: what the twist is
  phase: string; // Phase.id
  kind: StepKind; // must match the catalog entry
  from: string; // Actor.id
  to?: string; // Actor.id — absent for internal steps
  frame: FrameKind; // must match the catalog entry
  label: string; // short edge caption ("message sent" line)
  response?: boolean; // response leg (styling + pairing checks)
  payload?: Payload;
  gate?: Gate; // gate.kind must match catalog gateKind when both present
  note: string; // the documentation: what this step means and why
  docRef?: string; // grounding, e.g. 'GladeWorkspaceDirectory §4'
  sets?: StatePatch; // state changes this step causes
}

export function stepId(s: Step): string {
  return s.variant ? `${s.state}.${s.variant}` : s.state;
}

// A catalog entry: one named protocol state, owned globally across all traces.
// Rule: reuse an id only when the step is OBVIOUSLY the same protocol state
// (payload differences are instance data); when in doubt, mint a new id in the
// right area. Variants (`.a`) declare a twist on the base state as data.
export interface CatalogState {
  id: string;
  title: string;
  frame: FrameKind;
  kind: StepKind;
  gateKind?: GateKind; // when the state is inherently gated
  desc: string;
}

export interface Phase {
  id: string;
  label: string;
  summary: string;
}

export interface Scenario {
  id: string; // registry id, e.g. 's-fanout'
  stage: 1 | 2 | 3; // 1 = allow-all substrate, 2 = security enforced, 3 = stack (grip·glial·glade)
  title: string;
  summary: string; // one-liner for the menu
  actors: Actor[];
  phases: Phase[];
  steps: Step[];
  initial?: StatePatch; // pre-existing state before step 0
}
