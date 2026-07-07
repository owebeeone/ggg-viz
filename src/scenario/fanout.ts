// Fan-out traces: what happens when a SECOND session wants what a node
// already replicates — and the asymmetry for exchanges.
import type { Scenario } from './types';
import { pick } from './actors';

const SUB_V1 = 'GladeSubstrateV1';

export const S_FANOUT: Scenario = {
  id: 's-fanout',
  stage: 1,
  title: 'Fan-out — second session, same node',
  summary: 'gryth2 asks local1 for a stream gryth1 already gets: served from the replica, no second upstream; interest is refcounted.',

  actors: pick('gryth1', 'gryth2', 'local1', 'peer1'),

  initial: {
    local1: {
      'session gryth1': 'open',
      'sub ws-razel/ws.tree': 'gryth1',
      replica: 'home + ws-razel/ws.tree{/src}',
      'upstream ws-razel/ws.tree': 'peer1 (interest ×1)',
    },
    peer1: { 'sub ws-razel/ws.tree': 'local1', serving: 'ws.tree via grazel' },
    gryth1: { view: '/src tree (live)' },
  },

  phases: [
    { id: 'F1', label: 'Second session joins', summary: 'Same stream, same node: attach to the replica — the C-path never runs.' },
    { id: 'F2', label: 'Live fan-out', summary: 'One upstream delivery, N downstream copies.' },
    { id: 'F3', label: 'Interest lifecycle', summary: 'Refcounts drop; retention decides what the replica keeps.' },
  ],

  steps: [
    {
      state: 'A1', phase: 'F1', kind: 'message', from: 'gryth2', to: 'local1', frame: 'HELLO',
      label: 'second session open',
      payload: { detail: { session: 'sess-9c1', principal: 'gianni (asserted)' } },
      gate: { kind: 'security', label: 'HELLO principal seam', status: 'stub-allow-all', note: 'Same seam as the first session — sessions are per-consumer even on one machine.' },
      note: 'Sessions are the unit a consumer holds: own origin log, own resume state. Two browser tabs = two sessions.',
      docRef: `${SUB_V1} §5`,
      sets: { local1: { 'session gryth2': 'open' } },
    },
    {
      state: 'A2', phase: 'F1', kind: 'message', from: 'local1', to: 'gryth2', frame: 'HELLO-ACK',
      label: 'resume heads', response: true,
      payload: { detail: { resume: 'fresh session — empty vector' } },
      note: 'Resume state is per-session even when the underlying replica is shared.',
      sets: { gryth2: { session: 'local1 (fresh)' } },
    },
    {
      state: 'C1', phase: 'F1', kind: 'message', from: 'gryth2', to: 'local1', frame: 'SUBSCRIBE',
      label: 'subscribe: same stream',
      payload: { share: 'ws-razel', gladeId: 'ws.tree', key: '{root:"/src"}', shape: 'value' },
      note: 'Byte-identical ask to gryth1’s — the consumer cannot and should not know the node already has it.',
      sets: { gryth2: { subs: 'ws-razel/ws.tree{/src}' } },
    },
    {
      state: 'F1', phase: 'F1', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'attach to replicated stream',
      payload: { share: 'ws-razel', detail: { found: 'replica present, upstream live', action: 'add session to subscription table' } },
      gate: { kind: 'routing', label: 'replica-attach', status: 'designed', note: 'The node is a replica + router: streams replicate once per node, sessions fan out locally. No dial, no C2/C3.' },
      note: 'THE fan-out decision: local1 already replicates (ws-razel, ws.tree, {/src}) for gryth1 — gryth2 attaches to it. Contrast s-discovery C2/C3.',
      docRef: `${SUB_V1} §6`,
      sets: { local1: { 'sub ws-razel/ws.tree': 'gryth1, gryth2' } },
    },
    {
      state: 'A4', phase: 'F1', kind: 'internal', from: 'local1', frame: 'FOLD',
      label: 'fold replica for late joiner',
      payload: { share: 'ws-razel', detail: { serve: 'cached fold + tail' } },
      note: 'Late-joiner hydration: cached fold + tail from the local replica (GQ-7 path).',
      docRef: `${SUB_V1} §5`,
    },
    {
      state: 'A5', phase: 'F1', kind: 'message', from: 'local1', to: 'gryth2', frame: 'OPS',
      label: 'tree served from replica', response: true,
      payload: { share: 'ws-razel', gladeId: 'ws.tree', key: '{root:"/src"}', shape: 'value' },
      note: 'gryth2 is current without any network hop — the peer never learned a second consumer exists.',
      sets: { gryth2: { view: '/src tree (live)' } },
    },
    {
      state: 'F2', phase: 'F1', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'upstream interest unchanged',
      payload: { detail: { upstream: 'peer1 — interest is the UNION of downstream interests' } },
      note: 'Interest aggregation (GDL-002): the upstream subscription is keyed by the stream, not by the consumer. Count changes; the connection does not.',
      sets: { local1: { 'upstream ws-razel/ws.tree': 'peer1 (interest ×1, subscribers 2)' } },
    },
    {
      state: 'C5', phase: 'F2', kind: 'message', from: 'peer1', to: 'local1', frame: 'OPS',
      label: 'live change from provider',
      payload: { share: 'ws-razel', gladeId: 'ws.tree', key: '{root:"/src"}', detail: { ops: 'tree changed (file added)' } },
      note: 'One delivery from the provider — regardless of how many local subscribers exist.',
      sets: { local1: { replica: 'home + ws-razel/ws.tree{/src} (updated)' } },
    },
    {
      state: 'B9', phase: 'F2', kind: 'message', from: 'local1', to: 'gryth1', frame: 'OPS',
      label: 'fan-out 1 of 2', response: true,
      payload: { share: 'ws-razel', gladeId: 'ws.tree', key: '{root:"/src"}' },
      note: 'Downstream copy one.',
      sets: { gryth1: { view: '/src tree (updated)' } },
    },
    {
      state: 'B9', phase: 'F2', kind: 'message', from: 'local1', to: 'gryth2', frame: 'OPS',
      label: 'fan-out 2 of 2', response: true,
      payload: { share: 'ws-razel', gladeId: 'ws.tree', key: '{root:"/src"}' },
      note: 'Downstream copy two. Cost model: upstream bandwidth ×1, local fan-out ×N.',
      sets: { gryth2: { view: '/src tree (updated)' } },
    },
    {
      state: 'F4', phase: 'F3', kind: 'message', from: 'gryth1', to: 'local1', frame: 'UNSUBSCRIBE',
      label: 'first session leaves',
      payload: { share: 'ws-razel', gladeId: 'ws.tree', key: '{root:"/src"}' },
      note: 'gryth1 closes its tree view.',
      sets: { gryth1: { view: null }, local1: { 'sub ws-razel/ws.tree': 'gryth2' } },
    },
    {
      state: 'F2', phase: 'F3', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'refcount drops, upstream survives',
      payload: { detail: { subscribers: '1 (gryth2)', upstream: 'still needed' } },
      note: 'The union of interests is still non-empty — upstream untouched.',
      sets: { local1: { 'upstream ws-razel/ws.tree': 'peer1 (interest ×1, subscribers 1)' } },
    },
    {
      state: 'F4', phase: 'F3', kind: 'message', from: 'gryth2', to: 'local1', frame: 'UNSUBSCRIBE',
      label: 'last session leaves',
      payload: { share: 'ws-razel', gladeId: 'ws.tree', key: '{root:"/src"}' },
      note: 'Interest hits zero.',
      sets: { gryth2: { view: null, subs: null }, local1: { 'sub ws-razel/ws.tree': null } },
    },
    {
      state: 'F3', phase: 'F3', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'retention decides',
      payload: { detail: { replica: 'RETAINED per declared retention', upstream: 'interest withdrawn from peer1' } },
      note: 'CONTENTIOUS: does the node keep replicating with zero subscribers (warm cache, offline value) or drop upstream immediately? Retention is per-binding declaration; the default is open.',
      docRef: `${SUB_V1} §3 · GladeWorkspaceDirectory §2`,
      sets: { local1: { 'upstream ws-razel/ws.tree': 'withdrawn (replica retained)' } },
    },
  ],
};

export const S_FANOUT_X: Scenario = {
  id: 's-fanout-exchange',
  stage: 1,
  title: 'Fan-out asymmetry — exchanges never fan out',
  summary: 'The replica can serve reads it holds; it can never answer an exchange. Directed frames always route to the authority.',

  actors: pick('gryth2', 'local1', 'peer1'),

  initial: {
    local1: { replica: 'ws-razel/ws.tree (cached)', 'session gryth2': 'open' },
    peer1: { serving: 'ws-razel via grazel' },
  },

  phases: [
    { id: 'X1', label: 'Exchange despite cache', summary: 'Cached data is irrelevant to a directed request.' },
  ],

  steps: [
    {
      state: 'D1', phase: 'X1', kind: 'message', from: 'gryth2', to: 'local1', frame: 'EXCHANGE',
      label: 'gwz: workspace status',
      payload: { share: 'ws-razel', gladeId: 'gwz.ops', shape: 'exchange', verb: 'workspace.status', correlationId: 'x-77' },
      note: 'local1 holds a fresh replica of the tree — and it does not matter.',
      sets: { local1: { 'pending x-77': 'gryth2 → ws-razel' } },
    },
    {
      state: 'C2', phase: 'X1', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'route to authority, not cache',
      payload: { share: 'ws-razel', detail: { answer: 'peer1', why: 'exchanges are directed — only the authority can answer' } },
      gate: { kind: 'routing', label: 'ServeClaim lookup', status: 'designed', note: 'The fan-out asymmetry: OPS can be served by any replica of the stream; EXCHANGE must reach the claim-holder. This is why claims exist at all.' },
      note: 'The replica answers "what is"; only the authority answers "do".',
      docRef: `${SUB_V1} §3 (authority) · GladeWorkspaceDirectory §4`,
    },
    {
      state: 'D2', phase: 'X1', kind: 'message', from: 'local1', to: 'peer1', frame: 'EXCHANGE',
      label: 'forward to claim-holder',
      payload: { correlationId: 'x-77', verb: 'workspace.status' },
      note: '1:1 by correlation id — never folded, never cached.',
      sets: { peer1: { 'pending x-77': 'local1' } },
    },
    {
      state: 'D3', phase: 'X1', kind: 'internal', from: 'peer1', frame: 'PROVIDE',
      label: 'gwz-core executes',
      payload: { detail: { engine: 'gwz-core', fence: 'workspace.lock held' } },
      note: 'The working copy is the single-writer resource; the lock is the ground truth.',
      sets: { peer1: { gwz: 'status executed' } },
    },
    {
      state: 'D4', phase: 'X1', kind: 'message', from: 'peer1', to: 'local1', frame: 'EXCHANGE-RESP',
      label: 'response', response: true,
      payload: { correlationId: 'x-77' },
      note: 'Back along the correlation path.',
      sets: { peer1: { 'pending x-77': null } },
    },
    {
      state: 'D5', phase: 'X1', kind: 'message', from: 'local1', to: 'gryth2', frame: 'EXCHANGE-RESP',
      label: 'response to requester', response: true,
      payload: { correlationId: 'x-77' },
      note: 'The exchange completes; nothing about it entered any replica.',
      sets: { local1: { 'pending x-77': null } },
    },
  ],
};
