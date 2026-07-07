// The discovery golden path as declared data. Grounded in:
//   glade/dev-docs/GladeSubstrateV1.md          (frames, sessions, folds, server roles)
//   dev-docs/glade/GladeWorkspaceDirectory.md   (home share, ServeClaim, iroh split)
//   glade/dev-docs/GladeGrythSecurityModelAnalysisPrompt.md (seams, gates)
//   gwz-core/README.md                          (typed workspace ops)
import type { Scenario } from './types';
import { pick } from './actors';

const SUB_V1 = 'GladeSubstrateV1';
const WD = 'GladeWorkspaceDirectory';
const SEC = 'SecurityModelAnalysisPrompt';

export const DISCOVERY: Scenario = {
  id: 's-discovery',
  stage: 1,
  title: 'Discovery — the golden path',
  summary: 'List workspaces from the local replica, join iroh, route a keyed resource, run a gwz exchange, hit a timeout.',

  actors: pick('gryth1', 'local1', 'iroh', 'peer1'),

  phases: [
    { id: 'A', label: 'Local-first list', summary: 'The workspace directory is a share — the list renders from the local replica before any network.' },
    { id: 'B', label: 'Join + peer discovery', summary: 'Bind iroh, publish reachability, resolve known peers, reconcile the home share.' },
    { id: 'C', label: 'Routed resource request', summary: 'A (glade id, key) subscription routes to the provider via the ServeClaim in the home share.' },
    { id: 'D', label: 'Workspace control (gwz)', summary: 'Typed gwz-core requests ride EXCHANGE frames to the claim-holder.' },
    { id: 'E', label: 'Failure: timeout', summary: 'No live claim / unreachable host surfaces as STATUS data, not silence.' },
  ],

  steps: [
    // ---- Phase A: local-first list -------------------------------------
    {
      state: 'A1', phase: 'A', kind: 'message', from: 'gryth1', to: 'local1', frame: 'HELLO',
      label: 'session open',
      payload: { detail: { session: 'sess-7f2', principal: 'gianni (asserted)' } },
      gate: { kind: 'security', label: 'HELLO principal seam', status: 'stub-allow-all', note: 'Principal id asserted at HELLO; enforcement is a no-op hook in v1 — the retrofit seam ships now so the model can land later.' },
      note: 'One websocket per session; frames are addressed, the socket is not load-bearing.',
      docRef: `${SUB_V1} §11 · ${SEC} §4`,
      sets: { local1: { 'session gryth1': 'open (principal asserted)' } },
    },
    {
      state: 'A2', phase: 'A', kind: 'message', from: 'local1', to: 'gryth1', frame: 'HELLO-ACK',
      label: 'resume heads', response: true,
      payload: { detail: { resume: 'version vector + per-log chain heads' } },
      note: 'Resume state lives on the session, not the socket.',
      docRef: `${SUB_V1} §6`,
      sets: { gryth1: { session: 'local1 (resumed)' } },
    },
    {
      state: 'A3', phase: 'A', kind: 'message', from: 'gryth1', to: 'local1', frame: 'SUBSCRIBE',
      label: 'subscribe: workspace directory',
      payload: { share: 'home', gladeId: 'dir.workspaces', key: '∅ (unkeyed)', shape: 'log' },
      note: 'The directory is itself a share — the home share. The first resource every UI asks for.',
      docRef: `${WD} §2`,
      sets: { local1: { 'sub home/dir.workspaces': 'gryth1' }, gryth1: { subs: 'home/dir.workspaces' } },
    },
    {
      state: 'A4', phase: 'A', kind: 'internal', from: 'local1', frame: 'FOLD',
      label: 'fold local replica',
      payload: { share: 'home', detail: { fold: 'set-union + LWW', input: 'per-origin logs (valid ops only)' } },
      note: 'fold(merge(logs)) over the local replica — offline-first: nothing has touched the network yet.',
      docRef: `${WD} §3 (ladder 1)`,
      sets: { local1: { 'fold home': '3 WorkspaceEntry' } },
    },
    {
      state: 'A5', phase: 'A', kind: 'message', from: 'local1', to: 'gryth1', frame: 'OPS',
      label: 'workspace entries', response: true,
      payload: { share: 'home', gladeId: 'dir.workspaces', shape: 'log', detail: { ops: 'WorkspaceEntry ×3 (origin-attributed)' } },
      note: 'The UI renders the list from the fold — marked "local replica" (possibly stale).',
      sets: { gryth1: { view: '3 workspaces (local replica)' } },
    },

    // ---- Phase B: join + peer discovery ---------------------------------
    {
      state: 'B1', phase: 'B', kind: 'internal', from: 'local1', frame: 'BIND',
      label: 'bind iroh endpoint',
      payload: { detail: { nodeKey: 'ed25519 — machine identity' } },
      gate: { kind: 'discovery', label: 'machine discovery', status: 'designed', note: 'iroh owns node-id→addr (pkarr/DNS + relays + mDNS). The directory never stores addresses as truth — NodeHint records are cache only.' },
      note: 'Node identity = the iroh keypair, nothing more.',
      docRef: `${WD} §3 · ${SEC} §2`,
      sets: { local1: { iroh: 'endpoint bound' } },
    },
    {
      state: 'B2', phase: 'B', kind: 'message', from: 'local1', to: 'iroh', frame: 'PUBLISH',
      label: 'publish reachability',
      payload: { detail: { record: 'pkarr/DNS under node key', relay: 'home relay' } },
      note: 'Reachability published — availability, not authority.',
      docRef: `${WD} §3`,
      sets: { local1: { iroh: 'published (pkarr + relay)' } },
    },
    {
      state: 'B3', phase: 'B', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'read peer set from home share',
      payload: { share: 'home', detail: { source: 'PrincipalDecl + NodeHint records' } },
      note: 'Which node ids are mine? A fold over the directory — data, not a registry service.',
      docRef: `${WD} §2`,
      sets: { local1: { peers: 'peer1 (from directory)' } },
    },
    {
      state: 'B4', phase: 'B', kind: 'message', from: 'local1', to: 'iroh', frame: 'RESOLVE',
      label: 'resolve peer node id',
      payload: { detail: { nodeId: 'peer1 (ed25519)' } },
      note: 'Only the id→addr question goes to iroh.',
    },
    {
      state: 'B5', phase: 'B', kind: 'message', from: 'iroh', to: 'local1', frame: 'ADDR',
      label: 'NodeAddr', response: true,
      payload: { detail: { addr: 'relay path + direct candidates' } },
      note: 'iroh answers reachability; hole-punch vs relay is its business.',
    },
    {
      state: 'B6', phase: 'B', kind: 'message', from: 'local1', to: 'peer1', frame: 'DIAL',
      label: 'dial + node HELLO',
      payload: { detail: { transport: 'iroh QUIC', session: 'node↔node glade session' } },
      gate: { kind: 'security', label: 'node↔node HELLO seam', status: 'stub-allow-all', note: 'Same principal seam as A1, machine-to-machine — device certs chain to the user root when the security model lands.' },
      note: 'Same glade frames as the websocket carries — the carrier is swappable by design (D9).',
      docRef: `${SUB_V1} §11 · ${WD} §2`,
      sets: { local1: { links: 'peer1 (iroh)' }, peer1: { links: 'local1 (iroh)' } },
    },
    {
      state: 'B7', phase: 'B', kind: 'message', from: 'local1', to: 'peer1', frame: 'HEADS',
      label: 'heads exchange (home share)',
      payload: { share: 'home', detail: { heads: 'version vector + per-log chain heads' } },
      note: 'Anti-entropy: compare heads, ship the gaps both ways (the GQ-9 hybrid encoding).',
      docRef: `${SUB_V1} §2`,
    },
    {
      state: 'B8', phase: 'B', kind: 'message', from: 'peer1', to: 'local1', frame: 'OPS',
      label: 'gap ops', response: true,
      payload: { share: 'home', gladeId: 'dir.workspaces', shape: 'log', detail: { ops: 'WorkspaceEntry(ws-razel) + ServeClaim(peer1, lease 30s)' } },
      note: 'New directory entries and the peer’s live serve-claim arrive as ordinary ops.',
      sets: { local1: { 'fold home': '5 WorkspaceEntry · claim: ws-razel@peer1' } },
    },
    {
      state: 'B9', phase: 'B', kind: 'message', from: 'local1', to: 'gryth1', frame: 'OPS',
      label: 'directory update', response: true,
      payload: { share: 'home', gladeId: 'dir.workspaces', shape: 'log', detail: { ops: '2 new entries' } },
      note: 'The A3 subscription delivers — the list updates live; nothing re-requests.',
      sets: { gryth1: { view: '5 workspaces (live)' } },
    },

    // ---- Phase C: routed resource request --------------------------------
    {
      state: 'C1', phase: 'C', kind: 'message', from: 'gryth1', to: 'local1', frame: 'SUBSCRIBE',
      label: 'subscribe: workspace tree',
      payload: { share: 'ws-razel', gladeId: 'ws.tree', key: '{root:"/src"} (canonical CBOR)', shape: 'value' },
      note: 'Keys are canonical CBOR of the declared param shape — never app-built strings.',
      docRef: `${SUB_V1} §4`,
      sets: { gryth1: { subs: 'home/dir + ws-razel/ws.tree{/src}' } },
    },
    {
      state: 'C2', phase: 'C', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'route to provider',
      payload: { share: 'ws-razel', detail: { question: 'who serves ws-razel?', answer: 'peer1', basis: 'ServeClaim lease valid at projection time' } },
      gate: { kind: 'routing', label: 'ServeClaim lookup', status: 'designed', note: 'The key selects the stream; the ServeClaim selects the node. Routing is a fold over the home share, lease expiry evaluated read-side.' },
      note: 'THE routing step: (share) → provider node; (glade id, key) rides along to select the stream at the provider.',
      docRef: `${WD} §4`,
      sets: { local1: { 'route ws-razel': 'peer1 (claim valid)' } },
    },
    {
      state: 'C3', phase: 'C', kind: 'message', from: 'local1', to: 'peer1', frame: 'SUBSCRIBE',
      label: 'forward interest',
      payload: { share: 'ws-razel', gladeId: 'ws.tree', key: '{root:"/src"}', shape: 'value' },
      gate: { kind: 'capability', label: 'capability check', status: 'stub-allow-all', note: 'Enforcement point exists at SUBSCRIBE (read); allow-all in v1 — the capability-ref slot is already in the envelope.' },
      note: 'Interest registered at the peer; the keyed entry map IS the routing table — no graph scans.',
      docRef: `${SEC} §3.4 · ${SUB_V1} §4`,
      sets: { local1: { 'sub ws-razel/ws.tree': 'gryth1' }, peer1: { 'sub ws-razel/ws.tree': 'local1' } },
    },
    {
      state: 'C4', phase: 'C', kind: 'internal', from: 'peer1', frame: 'PROVIDE',
      label: 'authority serves binding',
      payload: { share: 'ws-razel', gladeId: 'ws.tree', key: '{root:"/src"}', detail: { authority: 'share — grazel provider session', source: 'gwz-core + working copy' } },
      note: 'grazel attaches as an authority provider session; the keyed entry map routes the key to it. The server itself never folds.',
      docRef: `${SUB_V1} §6`,
      sets: { peer1: { serving: 'ws.tree{/src} via grazel' } },
    },
    {
      state: 'C5', phase: 'C', kind: 'message', from: 'peer1', to: 'local1', frame: 'OPS',
      label: 'tree value', response: true,
      payload: { share: 'ws-razel', gladeId: 'ws.tree', key: '{root:"/src"}', shape: 'value', detail: { ops: 'tree snapshot op (origin: peer1)' } },
      note: 'Value shape: whole-value register, replace fold.',
      sets: { local1: { replica: '+ ws-razel/ws.tree{/src}' } },
    },
    {
      state: 'C6', phase: 'C', kind: 'message', from: 'local1', to: 'gryth1', frame: 'OPS',
      label: 'tree to UI', response: true,
      payload: { share: 'ws-razel', gladeId: 'ws.tree', key: '{root:"/src"}', shape: 'value' },
      note: 'The consuming tap updates; the component never learns any of this happened.',
      sets: { gryth1: { view: '5 workspaces + /src tree' } },
    },

    // ---- Phase D: workspace control (gwz) --------------------------------
    {
      state: 'D1', phase: 'D', kind: 'message', from: 'gryth1', to: 'local1', frame: 'EXCHANGE',
      label: 'gwz: workspace status',
      payload: { share: 'ws-razel', gladeId: 'gwz.ops', shape: 'exchange', verb: 'workspace.status', correlationId: 'x-42', detail: { request: 'gwz-core RequestMeta (typed)' } },
      note: 'Control ops are directed exchanges, never folded.',
      docRef: `${SUB_V1} §3 · gwz-core README`,
      sets: { local1: { 'pending x-42': 'gryth1 → ws-razel' } },
    },
    {
      state: 'D2', phase: 'D', kind: 'message', from: 'local1', to: 'peer1', frame: 'EXCHANGE',
      label: 'forward exchange',
      payload: { share: 'ws-razel', gladeId: 'gwz.ops', shape: 'exchange', verb: 'workspace.status', correlationId: 'x-42' },
      note: 'Routed by the same C2 decision; correlation id preserved 1:1.',
      sets: { peer1: { 'pending x-42': 'local1' } },
    },
    {
      state: 'D3', phase: 'D', kind: 'internal', from: 'peer1', frame: 'PROVIDE',
      label: 'gwz-core executes',
      payload: { detail: { engine: 'gwz-core', op: 'per-member git status', fence: 'workspace.lock held' } },
      note: 'Typed request against the working copy: per-member results, attribution, dry-run policy — the gwz-core surface. Creating a new workspace is the same path, different verb.',
      docRef: 'gwz-core README',
      sets: { peer1: { gwz: 'status: 12 clean · 1 dirty' } },
    },
    {
      state: 'D4', phase: 'D', kind: 'message', from: 'peer1', to: 'local1', frame: 'EXCHANGE-RESP',
      label: 'member statuses', response: true,
      payload: { correlationId: 'x-42', detail: { members: '12 clean · 1 dirty' } },
      note: 'Directed response routes back by correlation id.',
      sets: { peer1: { 'pending x-42': null } },
    },
    {
      state: 'D5', phase: 'D', kind: 'message', from: 'local1', to: 'gryth1', frame: 'EXCHANGE-RESP',
      label: 'statuses to UI', response: true,
      payload: { correlationId: 'x-42' },
      note: 'The exchange completes at the requesting session.',
      sets: { local1: { 'pending x-42': null }, gryth1: { view: '… + member statuses' } },
    },

    // ---- Phase E: failure — timeout ---------------------------------------
    {
      state: 'E1', phase: 'E', kind: 'message', from: 'gryth1', to: 'local1', frame: 'SUBSCRIBE',
      label: 'subscribe: sleeping workspace',
      payload: { share: 'ws-attic', gladeId: 'ws.tree', key: '{root:"/"}', shape: 'value' },
      note: 'Same request shape as C1 — failure is a property of the route, not the ask.',
    },
    {
      state: 'E2', phase: 'E', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'route: no live claim',
      payload: { share: 'ws-attic', detail: { basis: 'ServeClaim lease EXPIRED at projection time', lastHost: 'attic-mini (node id known)' } },
      gate: { kind: 'routing', label: 'ServeClaim lookup', status: 'designed', note: 'Expiry is evaluated at read time, never inside the fold — the same op-set folds identically on every peer.' },
      note: 'The directory knows the last eligible host; whether to chase it is a routing decision.',
      docRef: `${WD} §2 · §4`,
      sets: { local1: { 'route ws-attic': 'NO live claim (attic-mini lapsed)' } },
    },
    {
      state: 'E3', phase: 'E', kind: 'message', from: 'local1', to: 'iroh', frame: 'RESOLVE',
      label: 'resolve last host',
      payload: { detail: { nodeId: 'attic-mini' } },
      note: 'Try reachability anyway — maybe only the lease renewal was missed.',
    },
    {
      state: 'E4', phase: 'E', kind: 'message', from: 'iroh', to: 'local1', frame: 'STATUS',
      label: 'unreachable', response: true,
      payload: { detail: { result: 'no addr / dial timeout' } },
      note: 'iroh cannot dial what is not there. This is data, not an exception.',
    },
    {
      state: 'E5', phase: 'E', kind: 'message', from: 'local1', to: 'gryth1', frame: 'STATUS',
      label: 'timeout to UI', response: true,
      payload: { share: 'ws-attic', gladeId: 'ws.tree', detail: { result: 'timeout', reason: 'no live ServeClaim; last host unreachable' } },
      note: 'The UI shows a timeout with the reason — appropriate messages, not spinners.',
      docRef: `${WD} §4`,
      sets: { gryth1: { view: '… ws-attic: timeout (reason shown)' } },
    },
  ],
};
