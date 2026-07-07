// Lifecycle traces: claim takeover with epoch fencing, offline write +
// reconcile with conflict-as-data, and workspace creation.
import type { Scenario } from './types';
import { pick } from './actors';

const SUB_V1 = 'GladeSubstrateV1';
const WD = 'GladeWorkspaceDirectory';

export const S_TAKEOVER: Scenario = {
  id: 's-takeover',
  stage: 1,
  title: 'Claim takeover — lease lapse + epoch fencing',
  summary: 'peer1 naps mid-serve; peer2 (also eligible) takes the local lock and claims with a higher epoch; routing follows; the stale renewal bounces.',

  actors: pick('gryth1', 'local1', 'peer1', 'peer2'),

  initial: {
    gryth1: { view: 'ws-shared tree (live)', session: 'local1 (open)' },
    local1: {
      'session gryth1': 'open',
      'sub ws-shared/ws.tree': 'gryth1',
      'fold home': 'claim: ws-shared@peer1 epoch 3 (lease 30s)',
      links: 'peer1, peer2 (iroh)',
    },
    peer1: { 'claim ws-shared': 'held — epoch 3', wc: 'checkout + workspace.lock HELD', serving: 'ws-shared via grazel', 'sub home': 'local1 (mesh)' },
    peer2: { wc: 'checkout (eligible, no lock)', 'sub home': 'local1 (mesh)' },
  },

  phases: [
    { id: 'L1', label: 'Healthy lease', summary: 'Renewals flow as ordinary directory ops.' },
    { id: 'L2', label: 'Lapse', summary: 'No renewal arrives; expiry is judged at each reader’s clock.' },
    { id: 'L3', label: 'Takeover', summary: 'The other eligible host takes ITS local lock and claims with epoch+1.' },
    { id: 'L4', label: 'Reroute + fence', summary: 'Routing follows the new claim; the stale holder’s renewal bounces off the epoch.' },
  ],

  steps: [
    {
      state: 'H2', phase: 'L1', kind: 'internal', from: 'peer1', frame: 'LEASE',
      label: 'renew lease',
      payload: { detail: { claim: 'ws-shared epoch 3', ttl: '30s' } },
      note: 'A renewal is a ServeClaim op appended to the home share — data, not a lock-service heartbeat.',
      docRef: `${WD} §4`,
      sets: { peer1: { 'claim ws-shared': 'held — epoch 3 (renewed)' } },
    },
    {
      state: 'B9', phase: 'L1', kind: 'message', from: 'peer1', to: 'local1', frame: 'OPS',
      label: 'renewal propagates',
      payload: { share: 'home', detail: { ops: 'ServeClaim(ws-shared, peer1, epoch 3)' } },
      note: 'Everyone’s directory replica sees the same claim ops.',
      sets: { local1: { 'fold home': 'claim: ws-shared@peer1 epoch 3 (fresh)' } },
    },
    {
      state: 'H3', phase: 'L2', kind: 'internal', from: 'local1', frame: 'LEASE',
      label: 'lease horizon passes',
      payload: { detail: { observed: 'no renewal within TTL', judged: 'at local1’s clock, at read time' } },
      note: 'peer1 went to sleep. Nothing "happens" anywhere — the lapse is an ABSENCE, visible only when a reader projects the fold against its own clock. Time never enters the fold itself.',
      docRef: `${WD} §2 (no-time-in-fold)`,
      sets: { local1: { 'fold home': 'claim: ws-shared@peer1 epoch 3 (STALE at projection)' }, peer1: { 'claim ws-shared': 'held — epoch 3 (asleep, not renewing)' } },
    },
    {
      state: 'H4', phase: 'L3', kind: 'internal', from: 'peer2', frame: 'LEASE',
      label: 'takeover: lock + epoch++',
      payload: { detail: { order: '1) take LOCAL workspace.lock 2) publish ServeClaim epoch 4', fence: 'filesystem lock is the ground truth' } },
      note: 'The claim routes traffic; the LOCK prevents double-mutation. peer2 can only claim because it holds its own checkout’s lock — a machine that lost the lock race cannot claim, whatever the directory says.',
      docRef: `${WD} §4 (fencing)`,
      sets: { peer2: { 'claim ws-shared': 'held — epoch 4', wc: 'checkout + workspace.lock HELD', serving: 'ws-shared via grazel' } },
    },
    {
      state: 'B9', phase: 'L3', kind: 'message', from: 'peer2', to: 'local1', frame: 'OPS',
      label: 'new claim propagates',
      payload: { share: 'home', detail: { ops: 'ServeClaim(ws-shared, peer2, epoch 4)' } },
      note: 'An ordinary directory op — no coordination round, no election protocol. Epoch ordering resolves precedence in the fold.',
      sets: { local1: { 'fold home': 'claim: ws-shared@peer2 epoch 4 (fresh)' } },
    },
    {
      state: 'C2', phase: 'L4', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'routing follows the claim',
      payload: { share: 'ws-shared', detail: { was: 'peer1 (stale)', now: 'peer2 epoch 4' } },
      gate: { kind: 'routing', label: 'ServeClaim lookup', status: 'designed', note: 'Highest live epoch wins at projection time. Readers converge on peer2 as their clocks pass the stale horizon — not atomically, and that is fine: the lock guards the resource.' },
      note: 'Re-route without a coordinator: the fold + clock does it.',
      docRef: `${WD} §4`,
      sets: { local1: { 'route ws-shared': 'peer2 (epoch 4)' } },
    },
    {
      state: 'C3', phase: 'L4', kind: 'message', from: 'local1', to: 'peer2', frame: 'SUBSCRIBE',
      label: 're-subscribe at new holder',
      payload: { share: 'ws-shared', gladeId: 'ws.tree', key: '{root:"/"}', shape: 'value' },
      gate: { kind: 'capability', label: 'capability check', status: 'stub-allow-all', note: 'Same seam at the new provider.' },
      note: 'Interest re-lands; resume state (heads) means only gaps ship.',
      docRef: `${SUB_V1} §6`,
      sets: { peer2: { 'sub ws-shared/ws.tree': 'local1' } },
    },
    {
      state: 'C5', phase: 'L4', kind: 'message', from: 'peer2', to: 'local1', frame: 'OPS',
      label: 'serving resumes', response: true,
      payload: { share: 'ws-shared', gladeId: 'ws.tree' },
      note: 'The consumer’s subscription never broke — the node re-routed under it.',
    },
    {
      state: 'B9', phase: 'L4', kind: 'message', from: 'local1', to: 'gryth1', frame: 'OPS',
      label: 'UI keeps flowing', response: true,
      payload: { share: 'ws-shared', gladeId: 'ws.tree' },
      note: 'From the UI’s seat, the takeover is at most a brief stall.',
      sets: { gryth1: { view: 'ws-shared tree (live via peer2)' } },
    },
    {
      state: 'H2', phase: 'L4', kind: 'internal', from: 'peer1', frame: 'LEASE', variant: 'a',
      variantNote: 'Stale renewal after wake: epoch 3 renewal is superseded by the live epoch 4 claim — fenced in the fold, not by any arbiter.',
      label: 'wake + stale renew (fenced)',
      payload: { detail: { attempt: 'renew epoch 3', outcome: 'superseded by epoch 4 — peer1 releases its lock and demotes to eligible' } },
      note: 'The wake-up race is safe TWICE over: the fold prefers the higher epoch (routing), and peer1’s own gwz refuses mutations because the claim it holds is provably stale (fencing token). No STONITH, no drama.',
      docRef: `${WD} §4`,
      sets: { peer1: { 'claim ws-shared': null, wc: 'checkout (eligible, lock released)', serving: null } },
    },
  ],
};

export const S_OFFLINE: Scenario = {
  id: 's-offline',
  stage: 1,
  title: 'Offline write — reconcile + conflict as data',
  summary: 'The link drops; both sides keep writing; heads reconcile on reconnect; the concurrent edit surfaces as MV data the UI renders.',

  actors: pick('gryth1', 'local1', 'iroh', 'peer1'),

  initial: {
    gryth1: { session: 'local1 (open)', view: 'notes (live)' },
    local1: { 'session gryth1': 'open', 'sub ws-razel/notes': 'gryth1 · peer1 (authority sync)', replica: 'ws-razel/notes', links: 'peer1 (iroh)' },
    peer1: { serving: 'ws-razel via grazel', 'sub ws-razel/notes': 'local1' },
  },

  phases: [
    { id: 'O1', label: 'Partition + local writes', summary: 'Appending never blocks on the network.' },
    { id: 'O2', label: 'Reconcile', summary: 'Heads compare; gaps ship both ways.' },
    { id: 'O3', label: 'Conflict as data', summary: 'The MV register surfaces both values; the user picks; the pick propagates.' },
  ],

  steps: [
    {
      state: 'E4', phase: 'O1', kind: 'message', from: 'iroh', to: 'local1', frame: 'STATUS',
      label: 'peer1 unreachable',
      payload: { detail: { link: 'peer1 — relay lost, dial fails' } },
      note: 'The partition is detected, not declared. Nothing pauses.',
      sets: { local1: { links: 'peer1 (DOWN)' } },
    },
    {
      state: 'J1', phase: 'O1', kind: 'internal', from: 'gryth1', frame: 'APPEND',
      label: 'edit while offline',
      payload: { share: 'ws-razel', gladeId: 'notes', detail: { op: 'set title = "Glade plan v2"' } },
      note: 'The write path is LOCAL: append to own origin log + local destination. The network was never on it.',
      docRef: `${SUB_V1} §2/§5`,
      sets: { gryth1: { 'origin log': '+1 op (title)' } },
    },
    {
      state: 'J3', phase: 'O1', kind: 'message', from: 'gryth1', to: 'local1', frame: 'APPEND',
      label: 'op reaches the node',
      payload: { share: 'ws-razel', gladeId: 'notes', detail: { op: 'title op (origin: gryth1, seq 18)' } },
      note: 'gryth1↔local1 is the same machine; only the peer link is down. The op parks in the replica, fan-out pending.',
      sets: { local1: { replica: 'ws-razel/notes (+1 op, peer1 pending)' } },
    },
    {
      state: 'J1', phase: 'O1', kind: 'internal', from: 'peer1', frame: 'APPEND',
      label: 'concurrent edit on the other side',
      payload: { share: 'ws-razel', gladeId: 'notes', detail: { op: 'set title = "Glade plan FINAL"' } },
      note: 'Another device edits the same field. Neither side knows yet — per-origin logs cannot conflict at append time, only at fold time.',
      sets: { peer1: { 'origin log': '+1 op (title, concurrent)' } },
    },
    {
      state: 'B5', phase: 'O2', kind: 'message', from: 'iroh', to: 'local1', frame: 'ADDR',
      label: 'peer1 reachable again', response: true,
      payload: { detail: { addr: 'relay path restored' } },
      note: 'iroh notices before anyone else cares.',
      sets: { local1: { links: 'peer1 (restored)' } },
    },
    {
      state: 'B7', phase: 'O2', kind: 'message', from: 'local1', to: 'peer1', frame: 'HEADS',
      label: 'heads reveal divergence',
      payload: { share: 'ws-razel', detail: { compare: 'vectors differ on both origins' } },
      note: 'The version vector says exactly what each side is missing — no diffing, no guessing.',
      docRef: `${SUB_V1} §2 (GQ-9)`,
    },
    {
      state: 'B8', phase: 'O2', kind: 'message', from: 'peer1', to: 'local1', frame: 'OPS',
      label: 'their gap ships', response: true,
      payload: { share: 'ws-razel', detail: { ops: 'title op (origin: peer1)' } },
      note: 'Gap one of two.',
      sets: { local1: { replica: 'ws-razel/notes (both title ops)' } },
    },
    {
      state: 'B8', phase: 'O2', kind: 'message', from: 'local1', to: 'peer1', frame: 'OPS',
      label: 'our gap ships',
      payload: { share: 'ws-razel', detail: { ops: 'title op (origin: gryth1)' } },
      note: 'Gap two of two. Both replicas now hold the SAME op-set.',
      sets: { peer1: { 'origin log': 'merged (both title ops)' } },
    },
    {
      state: 'A4', phase: 'O3', kind: 'internal', from: 'local1', frame: 'FOLD',
      label: 'fold finds the concurrency',
      payload: { share: 'ws-razel', detail: { field: 'title', values: '"…v2" ∥ "…FINAL" (causally concurrent)' } },
      note: 'Same op-set ⇒ same fold everywhere: BOTH sides converge on the SAME conflict. An MV register holds both values; nothing is silently dropped.',
      docRef: `${SUB_V1} §3 (MV) · GQ-1`,
      sets: { local1: { 'fold ws-razel/notes': 'title: MV{v2, FINAL}' } },
    },
    {
      state: 'J2', phase: 'O3', kind: 'message', from: 'local1', to: 'gryth1', frame: 'OPS',
      label: 'conflict surfaced to UI', response: true,
      payload: { share: 'ws-razel', gladeId: 'notes', detail: { title: 'MV{"Glade plan v2", "Glade plan FINAL"}' } },
      note: 'GQ-1’s lean, visualized: conflicts are DATA, and grip makes rendering them cheap — a chip with two values, not a modal of doom.',
      sets: { gryth1: { view: 'notes — title CONFLICT (2 values)' } },
    },
    {
      state: 'J3', phase: 'O3', kind: 'message', from: 'gryth1', to: 'local1', frame: 'APPEND',
      label: 'user resolves',
      payload: { share: 'ws-razel', gladeId: 'notes', detail: { op: 'set title = "Glade plan FINAL v2" (supersedes both)' } },
      note: 'The resolution is just another op, causally after both branches — the MV collapses in every fold that sees it.',
      sets: { local1: { 'fold ws-razel/notes': 'title: "Glade plan FINAL v2"' }, gryth1: { view: 'notes (resolved)' } },
    },
    {
      state: 'B9', phase: 'O3', kind: 'message', from: 'local1', to: 'peer1', frame: 'OPS',
      label: 'resolution propagates',
      payload: { share: 'ws-razel', detail: { ops: 'resolution op' } },
      note: 'peer1’s fold collapses the same way. Convergence from data, never from coordination.',
      sets: { peer1: { 'origin log': 'merged + resolution' } },
    },
  ],
};

export const S_CREATE: Scenario = {
  id: 's-create',
  stage: 1,
  title: 'Create a workspace — gwz + directory + first claim',
  summary: 'gwz-core materializes a new multi-repo workspace on a chosen node; the directory entry and first ServeClaim make it discoverable everywhere.',

  actors: pick('gryth1', 'local1', 'peer3'),

  initial: {
    gryth1: { session: 'local1 (open)', view: '5 workspaces' },
    local1: { 'session gryth1': 'open', 'sub home/dir.workspaces': 'gryth1', links: 'peer3 (iroh)' },
    peer3: { gwz: 'idle', wc: '—', 'sub home': 'local1 (mesh)' },
  },

  phases: [
    { id: 'N1', label: 'Create ask', summary: 'Creation is a typed gwz exchange with an explicit target node.' },
    { id: 'N2', label: 'Materialize', summary: 'gwz-core builds the multi-repo workspace under the lock.' },
    { id: 'N3', label: 'Directory + claim', summary: 'The entry + first claim replicate; every device’s list grows.' },
  ],

  steps: [
    {
      state: 'D1', phase: 'N1', kind: 'message', from: 'gryth1', to: 'local1', frame: 'EXCHANGE',
      label: 'gwz: create workspace',
      payload: { share: 'home', gladeId: 'gwz.ops', shape: 'exchange', verb: 'workspace.create', correlationId: 'x-88', detail: { name: 'ws-new', members: '3 repos (manifest)', target: 'peer3 (cloud-vm)' } },
      note: 'The target node is EXPLICIT in the request — placement of a new working copy is a user/policy choice, not a scheduler’s.',
      docRef: 'gwz-core README (CreateRepoRequest shape)',
      sets: { local1: { 'pending x-88': 'gryth1 → create@peer3' } },
    },
    {
      state: 'C2', phase: 'N1', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'route to the chosen node',
      payload: { detail: { target: 'peer3 — named in the request', check: 'peer3 is a certified device of this user' } },
      gate: { kind: 'routing', label: 'create-target routing', status: 'designed', note: 'No claim exists yet — creation routes by TARGET, and stage 2 will ask: which principals may create workspaces on which nodes (GDL-016)?' },
      note: 'Creation is the one routed operation that cannot consult a ServeClaim — it MAKES the thing claims will be about.',
      docRef: 'GDL-016',
      sets: { local1: { 'route create': 'peer3 (explicit target)' } },
    },
    {
      state: 'D2', phase: 'N1', kind: 'message', from: 'local1', to: 'peer3', frame: 'EXCHANGE',
      label: 'forward create',
      payload: { correlationId: 'x-88', verb: 'workspace.create' },
      note: 'Same directed path as any gwz op.',
      sets: { peer3: { 'pending x-88': 'local1' } },
    },
    {
      state: 'D3', phase: 'N2', kind: 'internal', from: 'peer3', frame: 'PROVIDE',
      label: 'gwz-core materializes',
      payload: { detail: { engine: 'gwz-core', ops: 'create manifest + clone 3 members', fence: 'workspace.lock created + held' } },
      note: 'Typed requests, per-member results, dry-run policy — the gwz-core surface doing its actual job. The lock exists from the first byte.',
      docRef: 'gwz-core README',
      sets: { peer3: { gwz: 'created ws-new (3 members cloned)', wc: 'ws-new checkout + lock HELD' } },
    },
    {
      state: 'K1', phase: 'N3', kind: 'internal', from: 'peer3', frame: 'APPEND',
      label: 'directory entry appended',
      payload: { share: 'home', detail: { op: 'WorkspaceEntry(ws-new, eligible: [peer3])' } },
      note: 'The creator writes the directory under its device chain — stage 2 asks whether THIS device may (K1 is a capability enforcement point in waiting).',
      docRef: `${WD} §2`,
      sets: { peer3: { 'origin log': '+WorkspaceEntry(ws-new)' } },
    },
    {
      state: 'H1', phase: 'N3', kind: 'internal', from: 'peer3', frame: 'LEASE',
      label: 'first serve-claim',
      payload: { detail: { claim: 'ServeClaim(ws-new, peer3, epoch 1)', basis: 'lock already held' } },
      note: 'Claim follows lock, never precedes it. ws-new is now routable.',
      docRef: `${WD} §4`,
      sets: { peer3: { 'claim ws-new': 'held — epoch 1', serving: 'ws-new via grazel' } },
    },
    {
      state: 'D4', phase: 'N3', kind: 'message', from: 'peer3', to: 'local1', frame: 'EXCHANGE-RESP',
      label: 'create response', response: true,
      payload: { correlationId: 'x-88', detail: { members: '3/3 cloned clean' } },
      note: 'Per-member statuses ride back.',
      sets: { peer3: { 'pending x-88': null } },
    },
    {
      state: 'D5', phase: 'N3', kind: 'message', from: 'local1', to: 'gryth1', frame: 'EXCHANGE-RESP',
      label: 'response to UI', response: true,
      payload: { correlationId: 'x-88' },
      note: 'The exchange is done — but the LIST update arrives separately, as replication.',
      sets: { local1: { 'pending x-88': null } },
    },
    {
      state: 'B9', phase: 'N3', kind: 'message', from: 'peer3', to: 'local1', frame: 'OPS',
      label: 'directory ops replicate',
      payload: { share: 'home', detail: { ops: 'WorkspaceEntry(ws-new) + ServeClaim(epoch 1)' } },
      note: 'The same ops reach every replica — phones, laptops, the lot.',
      sets: { local1: { 'fold home': '6 WorkspaceEntry · claim: ws-new@peer3' } },
    },
    {
      state: 'B9', phase: 'N3', kind: 'message', from: 'local1', to: 'gryth1', frame: 'OPS',
      label: 'the list grows', response: true,
      payload: { share: 'home', gladeId: 'dir.workspaces', detail: { ops: 'ws-new appears' } },
      note: 'Discoverability = an op in the directory share. Nothing was registered anywhere else.',
      sets: { gryth1: { view: '6 workspaces (ws-new appeared)' } },
    },
  ],
};
