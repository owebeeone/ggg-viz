// Topology traces: three UI sessions across two local nodes — where does the
// second NODE get its data, and why exchanges behave differently.
import type { Scenario } from './types';
import { pick } from './actors';

const SUB_V1 = 'GladeSubstrateV1';
const WD = 'GladeWorkspaceDirectory';

export const S_3UI2N: Scenario = {
  id: 's-3ui-2node',
  stage: 1,
  title: 'Three sessions, two nodes — replica-of-replica',
  summary: 'gryth3 on local2 wants what local1 already replicates: may a replica serve a replica, or only the claim-holder? Exchanges still go to the authority.',

  actors: pick('gryth3', 'local2', 'local1', 'iroh', 'peer1'),

  initial: {
    local1: {
      replica: 'ws-razel/ws.tree{/src} (live)',
      'upstream ws-razel/ws.tree': 'peer1',
      links: 'peer1 (iroh)',
    },
    local2: { 'fold home': 'claims: ws-razel@peer1 · nodes: local1, peer1' },
    peer1: { serving: 'ws-razel via grazel', 'sub ws-razel/ws.tree': 'local1' },
  },

  phases: [
    { id: 'T1', label: 'Third session, second node', summary: 'A fresh node with a fresh session — but the mesh already carries the stream.' },
    { id: 'T2', label: 'Replica-of-replica', summary: 'local2 syncs from local1, not from the claim-holder — allowed for self-verifying streams?' },
    { id: 'T3', label: 'Exchange asymmetry', summary: 'The same node still sends exchanges to the authority only.' },
  ],

  steps: [
    {
      state: 'A1', phase: 'T1', kind: 'message', from: 'gryth3', to: 'local2', frame: 'HELLO',
      label: 'session on second machine',
      payload: { detail: { session: 'sess-2a4', principal: 'gianni (asserted)' } },
      gate: { kind: 'security', label: 'HELLO principal seam', status: 'stub-allow-all', note: 'Same seam, different machine — the device cert story (WD §3 ceremonies) will bind this at stage 2.' },
      note: 'Three sessions now exist across the user’s mesh; each node serves its own.',
      docRef: `${SUB_V1} §11`,
      sets: { local2: { 'session gryth3': 'open' } },
    },
    {
      state: 'C1', phase: 'T1', kind: 'message', from: 'gryth3', to: 'local2', frame: 'SUBSCRIBE',
      label: 'subscribe: workspace tree',
      payload: { share: 'ws-razel', gladeId: 'ws.tree', key: '{root:"/src"}', shape: 'value' },
      note: 'Identical ask to the golden path — the consumer never knows the topology.',
      sets: { gryth3: { subs: 'ws-razel/ws.tree{/src}' } },
    },
    {
      state: 'C2', phase: 'T2', kind: 'internal', from: 'local2', frame: 'ROUTE', variant: 'a',
      variantNote: 'Route to the NEAREST REPLICA (local1) instead of the claim-holder (peer1) — permissible only because op streams are self-verifying.',
      label: 'route: nearest replica, not claim-holder',
      payload: { share: 'ws-razel', detail: { claim: 'peer1', chosen: 'local1', why: 'already replicates the stream; same-user node; fewer hops' } },
      gate: { kind: 'routing', label: 'replica-source choice', status: 'open-question', note: 'CONTENTIOUS: any replica CAN serve logs/values — per-origin hash chains (GQ-9) + signatures make ops self-verifying, so a replica cannot forge. But SHOULD it? Freshness lag, load shifting, and stage-2 capability checks at a non-authority all follow from this choice.' },
      note: 'The claim answers "who is the authority", not "who may I sync from". Splitting those is the whole question.',
      docRef: `${SUB_V1} §2 (GQ-9) · ${WD} §4`,
      sets: { local2: { 'route ws-razel': 'local1 (replica) — claim is peer1' } },
    },
    {
      state: 'B4', phase: 'T2', kind: 'message', from: 'local2', to: 'iroh', frame: 'RESOLVE',
      label: 'resolve local1',
      payload: { detail: { nodeId: 'local1 (ed25519)' } },
      note: 'Node-to-node reachability, as ever, is iroh’s.',
    },
    {
      state: 'B6', phase: 'T2', kind: 'message', from: 'local2', to: 'local1', frame: 'DIAL',
      label: 'dial sibling node',
      payload: { detail: { transport: 'iroh QUIC', session: 'node↔node' } },
      gate: { kind: 'security', label: 'node↔node HELLO seam', status: 'stub-allow-all', note: 'Same-user devices; device certs make this cheap at stage 2.' },
      note: 'The user’s own nodes form a mesh; no peer1 involvement so far.',
      docRef: `${WD} §3`,
      sets: { local2: { links: 'local1 (iroh)' }, local1: { links: 'peer1, local2 (iroh)' } },
    },
    {
      state: 'B7', phase: 'T2', kind: 'message', from: 'local2', to: 'local1', frame: 'HEADS',
      label: 'heads exchange (ws-razel)',
      payload: { share: 'ws-razel', detail: { heads: 'empty vector — local2 has nothing' } },
      note: 'Anti-entropy is source-agnostic: heads compare the same way against any replica.',
      docRef: `${SUB_V1} §2`,
      sets: { local1: { 'sub ws-razel/ws.tree': 'local2 (node interest)' } },
    },
    {
      state: 'B8', phase: 'T2', kind: 'message', from: 'local1', to: 'local2', frame: 'OPS',
      label: 'replica serves replica', response: true,
      payload: { share: 'ws-razel', gladeId: 'ws.tree', detail: { ops: 'full gap — chain-verified per origin' } },
      note: 'local2 verifies each origin’s hash chain; it does not need to trust local1, only the chains. THAT is what makes replica-of-replica safe for streams.',
      docRef: `${SUB_V1} §2 (GQ-9)`,
      sets: { local2: { replica: 'ws-razel/ws.tree{/src}', 'sub ws-razel/ws.tree': 'gryth3' } },
    },
    {
      state: 'A5', phase: 'T2', kind: 'message', from: 'local2', to: 'gryth3', frame: 'OPS',
      label: 'tree to third session', response: true,
      payload: { share: 'ws-razel', gladeId: 'ws.tree', key: '{root:"/src"}' },
      note: 'gryth3 is live without peer1 ever seeing a new subscriber.',
      sets: { gryth3: { view: '/src tree (live)' } },
    },
    {
      state: 'C5', phase: 'T2', kind: 'message', from: 'peer1', to: 'local1', frame: 'OPS',
      label: 'provider emits change',
      payload: { share: 'ws-razel', gladeId: 'ws.tree', detail: { ops: 'file added' } },
      note: 'The origin is still peer1; changes enter the mesh once.',
    },
    {
      state: 'B9', phase: 'T2', kind: 'message', from: 'local1', to: 'local2', frame: 'OPS',
      label: 'relay to sibling', response: true,
      payload: { share: 'ws-razel', gladeId: 'ws.tree' },
      note: 'CONTENTIOUS (freshness): local2’s staleness is now bounded by local1’s liveness. A replica-served consumer inherits a chain of lags.',
      sets: { local2: { replica: 'ws-razel/ws.tree{/src} (updated)' } },
    },
    {
      state: 'B9', phase: 'T2', kind: 'message', from: 'local2', to: 'gryth3', frame: 'OPS',
      label: 'fan to session', response: true,
      payload: { share: 'ws-razel', gladeId: 'ws.tree' },
      note: 'Three hops origin→consumer — each one the same protocol.',
      sets: { gryth3: { view: '/src tree (updated)' } },
    },
    {
      state: 'D1', phase: 'T3', kind: 'message', from: 'gryth3', to: 'local2', frame: 'EXCHANGE',
      label: 'gwz: workspace status',
      payload: { share: 'ws-razel', gladeId: 'gwz.ops', shape: 'exchange', verb: 'workspace.status', correlationId: 'x-91' },
      note: 'Now ask the same node to DO something.',
      sets: { local2: { 'pending x-91': 'gryth3' } },
    },
    {
      state: 'C2', phase: 'T3', kind: 'internal', from: 'local2', frame: 'ROUTE',
      label: 'route exchange: authority only',
      payload: { share: 'ws-razel', detail: { chosen: 'peer1 (claim-holder)', not: 'local1 — a replica cannot execute' } },
      gate: { kind: 'routing', label: 'ServeClaim lookup', status: 'designed', note: 'The T2 shortcut is unavailable: exchanges reach the claim-holder or fail. The asymmetry is the design.' },
      note: 'Reads scale out through replicas; effects converge on the single authority. Same node, two different routes, one step apart.',
      docRef: `${WD} §4`,
      sets: { local2: { 'route gwz ws-razel': 'peer1 (authority)' } },
    },
    {
      state: 'B4', phase: 'T3', kind: 'message', from: 'local2', to: 'iroh', frame: 'RESOLVE',
      label: 'resolve peer1',
      payload: { detail: { nodeId: 'peer1 (ed25519)' } },
      note: 'First direct contact between local2 and the claim-holder.',
    },
    {
      state: 'B6', phase: 'T3', kind: 'message', from: 'local2', to: 'peer1', frame: 'DIAL',
      label: 'dial claim-holder',
      payload: { detail: { transport: 'iroh QUIC' } },
      gate: { kind: 'security', label: 'node↔node HELLO seam', status: 'stub-allow-all', note: 'Same seam.' },
      note: 'The mesh grows on demand.',
      docRef: `${WD} §3`,
      sets: { local2: { links: 'local1, peer1 (iroh)' }, peer1: { links: 'local1, local2 (iroh)' } },
    },
    {
      state: 'D2', phase: 'T3', kind: 'message', from: 'local2', to: 'peer1', frame: 'EXCHANGE',
      label: 'forward to authority',
      payload: { correlationId: 'x-91', verb: 'workspace.status' },
      note: '1:1 to the lock-holder.',
      sets: { peer1: { 'pending x-91': 'local2' } },
    },
    {
      state: 'D4', phase: 'T3', kind: 'message', from: 'peer1', to: 'local2', frame: 'EXCHANGE-RESP',
      label: 'response', response: true,
      payload: { correlationId: 'x-91' },
      note: 'Straight back — no replica in the loop.',
      sets: { peer1: { 'pending x-91': null } },
    },
    {
      state: 'D5', phase: 'T3', kind: 'message', from: 'local2', to: 'gryth3', frame: 'EXCHANGE-RESP',
      label: 'response to session', response: true,
      payload: { correlationId: 'x-91' },
      note: 'Reads rode the replica chain; the effect rode the authority path. Both are correct; the split is the lesson.',
      sets: { local2: { 'pending x-91': null } },
    },
  ],
};
