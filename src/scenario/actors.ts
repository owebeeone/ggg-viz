// The actor pool: every node that can appear in a trace, declared once.
// Traces pick subsets with pick(). x/y are layout seeds for the force engine.
import type { Actor } from './types';

const clientInternals = [
  { id: 'taps', label: 'grip taps', note: 'useGrip consumers — unchanged by sharing' },
  { id: 'session', label: 'glade session', note: 'own origin log + browser folds' },
  { id: 'subs', label: 'subscriptions', note: '(share, glade id, key) interest set' },
  { id: 'dest', label: 'local destination', note: 'offline cache (memory / IndexedDB)' },
];

const localInternals = [
  { id: 'sessions', label: 'session table', note: 'per-consumer sessions (UI, services, nodes)' },
  { id: 'subs', label: 'subscription table', note: '(share, glade id, key?) → sessions' },
  { id: 'home', label: 'home-share replica', note: 'the workspace directory, folded locally' },
  { id: 'store', label: 'store', note: 'per (share, origin) append logs' },
  { id: 'iroh-ep', label: 'iroh endpoint', note: 'node key = machine identity (ed25519)' },
  { id: 'gates', label: 'gates', note: 'HELLO principal · routing · capability seams' },
];

const peerInternals = [
  { id: 'server', label: 'glade server', note: 'same router/store roles, peer side' },
  { id: 'home', label: 'home-share replica', note: 'same directory, another replica' },
  { id: 'grazel', label: 'grazel authority session', note: 'provider for workspace bindings' },
  { id: 'gwz', label: 'gwz-core', note: 'typed multi-repo workspace ops' },
  { id: 'razel', label: 'razel', note: 'build engine (grazel-embedded)' },
  { id: 'wc', label: 'working copy + lock', note: 'the real single-writer resource' },
];

const localBlurb =
  'Router + store + resume (SubstrateV1 §6). Serves from its local replica first, ' +
  'joins iroh to reconcile with peers, and routes keyed interest to claim-holders.';

const peerBlurb =
  'An eligible host holding a checkout. Publishes a leased ServeClaim while holding ' +
  'the local workspace.lock; grazel serves bindings as an authority provider session.';

const clientBlurb =
  'The UI never talks to the network. It appends to its session and subscribes to ' +
  'bindings — mock ↔ shared swaps with zero consumer rewrite.';

export const POOL: Record<string, Actor> = {
  gryth1: {
    id: 'gryth1', label: 'gryth-ui 1', sub: 'browser SPA — TS glade session', role: 'client',
    x: 140, y: 300, w: 190, h: 96, internals: clientInternals, blurb: clientBlurb,
  },
  gryth2: {
    id: 'gryth2', label: 'gryth-ui 2', sub: 'second browser session, same user', role: 'client',
    x: 140, y: 500, w: 190, h: 96, internals: clientInternals, blurb: clientBlurb,
  },
  gryth3: {
    id: 'gryth3', label: 'gryth-ui 3', sub: 'session on another machine', role: 'client',
    x: 140, y: 120, w: 190, h: 96, internals: clientInternals, blurb: clientBlurb,
  },
  local1: {
    id: 'local1', label: 'local node 1', sub: 'user’s gryth node — rust glade server', role: 'node',
    x: 440, y: 340, w: 210, h: 110, internals: localInternals, blurb: localBlurb,
  },
  local2: {
    id: 'local2', label: 'local node 2', sub: 'gryth node on a second machine', role: 'node',
    x: 440, y: 120, w: 210, h: 110, internals: localInternals, blurb: localBlurb,
  },
  iroh: {
    id: 'iroh', label: 'iroh plane', sub: 'discovery + transport (node id → address)', role: 'plane',
    x: 660, y: 60, w: 230, h: 84,
    internals: [
      { id: 'pkarr', label: 'pkarr / DNS publish', note: 'reachability records under node keys' },
      { id: 'relay', label: 'relays', note: 'NAT traversal; carry encrypted traffic only' },
      { id: 'resolve', label: 'resolution', note: 'node id → NodeAddr (direct + relay paths)' },
      { id: 'quic', label: 'QUIC dial', note: 'hole-punch or relay — iroh’s business' },
    ],
    blurb:
      'Only direct calls are shown — iroh owns reachability, never placement or authority ' +
      '(the layer split in GladeWorkspaceDirectory §3).',
  },
  peer1: {
    id: 'peer1', label: 'peer 1 · mac-studio', sub: 'grazel workspace host', role: 'provider',
    x: 860, y: 300, w: 210, h: 110, internals: peerInternals, blurb: peerBlurb,
  },
  peer2: {
    id: 'peer2', label: 'peer 2 · attic-mini', sub: 'grazel workspace host (naps)', role: 'provider',
    x: 860, y: 520, w: 210, h: 110, internals: peerInternals, blurb: peerBlurb,
  },
  peer3: {
    id: 'peer3', label: 'peer 3 · cloud-vm', sub: 'grazel workspace host (always on)', role: 'provider',
    x: 940, y: 130, w: 210, h: 110, internals: peerInternals, blurb: peerBlurb,
  },
  dc1: {
    id: 'dc1', label: 'dc node', sub: 'operator: saas-corp — entry host + warm replica', role: 'node',
    x: 660, y: 560, w: 210, h: 110,
    internals: [
      { id: 'sessions', label: 'session table', note: 'roaming sessions HELLO here' },
      { id: 'plug', label: 'trust plug', note: 'device certs + corp OIDC (per USER policy)' },
      { id: 'replicas', label: 'replicas', note: 'holds only shares whose policy grants saas-corp replica.hold' },
      { id: 'relay', label: 'relay duty', note: 'blind pipe for shares it may not hold' },
      { id: 'chain', label: 'operator chain', note: 'node key → saas-corp org root' },
    ],
    blurb:
      'Topologically identical to every other node — the difference is a trust binding: ' +
      'its key chains to the saas-corp operator, and share policies decide what may live here.',
  },
  guest1: {
    id: 'guest1', label: 'guest session', sub: 'teammate’s session — another user root', role: 'client',
    x: 140, y: 60, w: 190, h: 96,
    internals: [
      { id: 'taps', label: 'grip taps', note: 'same UI, different principal' },
      { id: 'session', label: 'glade session', note: 'own origin log + folds' },
      { id: 'cert', label: 'device cert', note: 'chains to the GUEST user root, not gianni’s' },
      { id: 'cache', label: 'local cache', note: 'holds whatever was ever served — revocation is forward-only' },
    ],
    blurb:
      'A different principal entirely: their device cert chains to their own user root. ' +
      'Everything they may see or do arrives as grant records, never as node-level trust.',
  },
  agent1: {
    id: 'agent1', label: 'mcp agent', sub: 'agent session — attenuated under gianni', role: 'service',
    x: 300, y: 560, w: 190, h: 90,
    internals: [
      { id: 'chain', label: 'delegation chain', note: 'gianni-root → agent key: subset of verbs, TTL' },
      { id: 'session', label: 'glade session', note: 'an ordinary session with a narrower principal' },
      { id: 'mcp', label: 'MCP surface', note: 'tool calls become subscribes/exchanges' },
    ],
    blurb:
      'Agents are first-class access paths (security prompt §1) with rights strictly ' +
      'narrower than their sponsor — the attenuation rule, not a special case.',
  },
  'ui-comp': {
    id: 'ui-comp', label: 'component', sub: 'react component — useGrip consumer', role: 'client',
    x: 120, y: 200, w: 180, h: 90,
    internals: [
      { id: 'render', label: 'render', note: 'thin projection of drips' },
      { id: 'cursor', label: 'cursor state', note: 'live UI state that decides delta vs refresh' },
      { id: 'handlers', label: 'handlers', note: 'writes go through the tap' },
    ],
    blurb: 'Never knows about stores, sessions, or shapes — it renders drips and writes taps.',
  },
  'ui-comp2': {
    id: 'ui-comp2', label: 'column · doc-2', sub: 'react component — mounts the decl on doc-2', role: 'client',
    x: 120, y: 320, w: 180, h: 90,
    internals: [
      { id: 'fill', label: 'domain fill', note: 'document = doc-2 — same decl, different instance' },
      { id: 'render', label: 'render', note: 'thin projection of its own instance’s fold' },
    ],
    blurb: 'A second column over the SAME BindingDecl with a different domain fill — its own instance, its own fold.',
  },
  'ui-comp3': {
    id: 'ui-comp3', label: 'column · doc-1 (2nd view)', sub: 'react component — mounts the decl on doc-1 again', role: 'client',
    x: 120, y: 440, w: 180, h: 90,
    internals: [
      { id: 'fill', label: 'domain fill', note: 'document = doc-1 — the SAME fill as column A' },
      { id: 'render', label: 'render', note: 'attaches to the live instance; no new fold is built' },
    ],
    blurb: 'A third consumer of the same fill (doc-1): it attaches to the existing instance and bumps its refcount — no second fold.',
  },
  tap1: {
    id: 'tap1', label: 'shared tap', sub: 'grip-core — declares via glade-decl, stays thin', role: 'client',
    x: 360, y: 200, w: 190, h: 90,
    internals: [
      { id: 'decl', label: 'BindingDecl', note: '(glade id, shape, authority, retention) — glade-decl types' },
      { id: 'conduit', label: 'conduit', note: 'attributed changes out, rich events in — no assembly here' },
    ],
    blurb: 'GQ-5’s base-tap share seam: declaration + capture/apply hooks. All machinery lives below.',
  },
  'glial-rt': {
    id: 'glial-rt', label: 'glial runtime', sub: 'persistence + assembly + connectivity', role: 'service',
    x: 620, y: 200, w: 210, h: 110,
    internals: [
      { id: 'store', label: 'local store', note: 'IndexedDB — origin log + cached folds; ALWAYS attached' },
      { id: 'engines', label: 'shape engines', note: 'taut-shape folds + reassembly — once per binding' },
      { id: 'events', label: 'event fan-out', note: 'rich {refresh|delta} envelopes to every attached tap' },
      { id: 'sessions', label: 'session manager', note: 'opens glade sessions only when a mount configures one' },
    ],
    blurb:
      'The client kernel (GDL-035): persistence first, glade optional, assembly inside — ' +
      'taps and components never carry sharing machinery.',
  },
  gsession: {
    id: 'gsession', label: 'glade session', sub: 'origin log + destinations — managed by glial', role: 'service',
    x: 860, y: 200, w: 190, h: 90,
    internals: [
      { id: 'origin', label: 'origin log', note: 'seq + prev-hash chain (GQ-9)' },
      { id: 'dests', label: 'destinations', note: 'node over WS; more when configured' },
      { id: 'resume', label: 'resume state', note: 'heads vectors, per session' },
    ],
    blurb: 'The substrate leg of the stack — exists only when glial configuration mounts connectivity.',
  },
  'chat-sup': {
    id: 'chat-sup', label: 'glade-chat supplier', sub: 'wire-attached authority session — declares group surfaces', role: 'provider',
    x: 660, y: 420, w: 210, h: 104,
    internals: [
      { id: 'session', label: 'authority session', note: 'an ordinary wire session (P00-a) — no node internals' },
      { id: 'groups', label: 'groups config', note: 'pre-declared [{id,label}] — stage-1 scope (dynamic creation = create-a-share, F2+P2)' },
      { id: 'decls', label: 'surface decls', note: 'chat.msgs (keyed commons log, one key per group) + chat.groups (value)' },
      { id: 'meta', label: 'chat.groups value', note: 'serves the group list; NOT in the message hot path' },
    ],
    blurb:
      'The authority-side module behind the chat surfaces (GDL-040). It declares one keyed commons ' +
      'log (chat.msgs, group id = key) and serves the chat.groups metadata value. Stage-1 messages ' +
      'are CLIENT appends the node folds + replicates — the supplier is out of the message hot path.',
  },
  'users-sup': {
    id: 'users-sup', label: 'glade-users supplier', sub: 'wire-attached authority — invite exchange + principal directory', role: 'provider',
    x: 660, y: 420, w: 210, h: 104,
    internals: [
      { id: 'session', label: 'authority session', note: 'an ordinary wire session (P00-a) — no node internals' },
      { id: 'invites', label: 'users.invites exchange', note: 'answers accept: token freshness + signature (structural in stage 1)' },
      { id: 'dir', label: 'dir.principals + users.introductions', note: 'serves the principal directory + sponsorship edges (fingerprint-keyed)' },
      { id: 'names', label: 'users.names registry', note: 'optional per-domain handle claims — first-valid-claim-wins fold' },
    ],
    blurb:
      'The authority-side module behind the identity surfaces (GDL-040). It answers the users.invites ' +
      'exchange (token validation) and serves the principal directory; PrincipalRecords are keyed by ' +
      'FINGERPRINT (the key IS the identity). Principal/introduction records are ordinary appends any ' +
      'authorized session makes — the supplier never holds a privileged plane.',
  },
  'svc-diff': {
    id: 'svc-diff', label: 'diff service', sub: 'ephemeral derived-binding authority', role: 'service',
    temp: true,
    x: 640, y: 420, w: 190, h: 90,
    internals: [
      { id: 'left', label: 'left source sub', note: 'subscribes like any session' },
      { id: 'right', label: 'right source sub', note: 'second source, second peer' },
      { id: 'fold', label: 'derived fold', note: 'recomputes diff on source ops' },
      { id: 'auth', label: 'authority binding', note: 'serves ws.diff to subscribers' },
    ],
    blurb:
      'Instantiated on demand for a derived binding no ServeClaim serves. Placement, ' +
      'lifetime, and dedup are open design (GDL-014/016 at user scale).',
  },
};

export function pick(...ids: string[]): Actor[] {
  return ids.map((id) => {
    const a = POOL[id];
    if (!a) throw new Error(`unknown pool actor '${id}'`);
    return a;
  });
}
