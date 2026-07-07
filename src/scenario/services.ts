// Service instantiation: a derived binding (diff across two workspaces on
// different peers) that no ServeClaim serves — the node must instantiate an
// ephemeral service. Discovery gets clouded here on purpose; the notes carry
// the open design (GDL-014/016 at user scale).
import type { Scenario } from './types';
import { pick } from './actors';

const WD = 'GladeWorkspaceDirectory';
const SUB_V1 = 'GladeSubstrateV1';

export const S_DIFF: Scenario = {
  id: 's-diff-service',
  stage: 1,
  title: 'Diff across two peers — service instantiation',
  summary: 'A derived binding with no provider: local1 instantiates a diff service (temporary node) that subscribes to both peers and serves the result.',

  actors: pick('gryth1', 'local1', 'iroh', 'peer1', 'peer2', 'svc-diff'),

  initial: {
    gryth1: { session: 'local1 (open)' },
    local1: {
      'session gryth1': 'open',
      'fold home': 'claims: ws-razel@peer1 · ws-glade@peer2',
      links: 'peer1 (iroh)',
    },
    peer1: { serving: 'ws-razel via grazel' },
    peer2: { serving: 'ws-glade via grazel' },
  },

  phases: [
    { id: 'G1', label: 'Derived ask', summary: 'The subscription names a binding no claim serves — it is computed, not stored.' },
    { id: 'G2', label: 'Instantiate', summary: 'A service instance spawns as an ephemeral authority (the temporary node).' },
    { id: 'G3', label: 'Feed + emit', summary: 'The instance subscribes to both sources through the ordinary routed path and emits the derived value.' },
    { id: 'G4', label: 'Live + teardown', summary: 'Source changes recompute; interest gone tears the instance down.' },
  ],

  steps: [
    {
      state: 'C1', phase: 'G1', kind: 'message', from: 'gryth1', to: 'local1', frame: 'SUBSCRIBE',
      label: 'subscribe: cross-peer diff',
      payload: { share: 'svc', gladeId: 'ws.diff', key: '{left:(ws-razel, ws.tree), right:(ws-glade, ws.tree)}', shape: 'value' },
      note: 'CONTENTIOUS — identity of a derived binding: which share does ws.diff live in? A synthetic service space ("svc") is assumed here; registering derived bindings in the directory vs deriving them structurally from the key is open design.',
      docRef: `${WD} §2 (open) · GDL-026`,
      sets: { gryth1: { subs: 'svc/ws.diff{left,right}' }, local1: { 'sub svc/ws.diff': 'gryth1' } },
    },
    {
      state: 'G1', phase: 'G1', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'no provider — service definition matches',
      payload: { share: 'svc', detail: { claims: 'none for ws.diff', match: 'ServiceDefinition(diff) accepts (ws.tree, ws.tree)' } },
      gate: { kind: 'routing', label: 'derived-binding routing', status: 'open-question', note: 'Who owns the ServiceDefinition registry — the home share (declared, replicated) or node-local config? Which principals may declare services (GDL-016)?' },
      note: 'The routing fold finds no ServeClaim. Instead of failing (contrast s-discovery E2), a service definition matches the binding shape.',
      docRef: 'GladeDistributedControlPlane (ServiceDefinition, collapsed to user scale)',
      sets: { local1: { 'route svc/ws.diff': 'no claim → ServiceDefinition(diff)' } },
    },
    {
      state: 'G2', phase: 'G2', kind: 'internal', from: 'local1', frame: 'SPAWN',
      label: 'instantiate diff service',
      payload: { detail: { instance: 'diff#1', placement: 'local1 (consumer-side)', lifetime: 'interest-refcounted' } },
      gate: { kind: 'routing', label: 'placement', status: 'open-question', note: 'Consumer-side placement chosen here (data is small after diff); data-side placement (ship the computation to a peer) is the alternative when sources are big. GDL-014.' },
      note: 'The temporary node appears: an ephemeral authority whose whole existence is demand-driven. Two UIs asking the same diff MUST dedup to one instance (canonical key = dedup key).',
      docRef: `${WD} §4 · GDL-014`,
      sets: { 'svc-diff': { alive: 'yes', refs: '1 (gryth1)' }, local1: { services: 'diff#1 running', 'session svc-diff': 'open (service)' } },
    },
    {
      state: 'G3', phase: 'G3', kind: 'message', from: 'svc-diff', to: 'local1', frame: 'SUBSCRIBE',
      label: 'service subscribes: left source',
      payload: { share: 'ws-razel', gladeId: 'ws.tree', key: '{root:"/"}', shape: 'value' },
      note: 'The instance is an ORDINARY session — it subscribes like any consumer. Everything below reuses the routed path from s-discovery.',
      docRef: `${SUB_V1} §5`,
      sets: { 'svc-diff': { left: 'subscribed' } },
    },
    {
      state: 'C2', phase: 'G3', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'route left → peer1',
      payload: { share: 'ws-razel', detail: { answer: 'peer1 (claim valid)' } },
      gate: { kind: 'routing', label: 'ServeClaim lookup', status: 'designed', note: 'Same C2 as the golden path — the service’s asks are not special.' },
      note: 'Left source routes over the existing peer1 link.',
      docRef: `${WD} §4`,
      sets: { local1: { 'sub ws-razel/ws.tree': 'svc-diff' } },
    },
    {
      state: 'C3', phase: 'G3', kind: 'message', from: 'local1', to: 'peer1', frame: 'SUBSCRIBE',
      label: 'forward left interest',
      payload: { share: 'ws-razel', gladeId: 'ws.tree', key: '{root:"/"}', shape: 'value' },
      gate: { kind: 'capability', label: 'capability check', status: 'stub-allow-all', note: 'CONTENTIOUS for stage 2: the service acts — with whose capability? Its sponsor’s (gryth1), attenuated? The agent-on-behalf-of problem again.' },
      note: 'Whose authority does a service borrow? The security prompt’s attenuation question applies to services exactly as to agents.',
      docRef: 'SecurityModelAnalysisPrompt §3.1',
      sets: { peer1: { 'sub ws-razel/ws.tree': 'local1' } },
    },
    {
      state: 'C5', phase: 'G3', kind: 'message', from: 'peer1', to: 'local1', frame: 'OPS',
      label: 'left tree arrives', response: true,
      payload: { share: 'ws-razel', gladeId: 'ws.tree', detail: { ops: 'tree snapshot (origin: peer1)' } },
      note: 'Left source replicated.',
      sets: { local1: { replica: 'ws-razel/ws.tree' } },
    },
    {
      state: 'G3', phase: 'G3', kind: 'message', from: 'svc-diff', to: 'local1', frame: 'SUBSCRIBE',
      label: 'service subscribes: right source',
      payload: { share: 'ws-glade', gladeId: 'ws.tree', key: '{root:"/"}', shape: 'value' },
      note: 'Second source, second peer — this is where discovery "clouds": the service’s demand pulls in a peer the consumer never named.',
      sets: { 'svc-diff': { right: 'subscribed' } },
    },
    {
      state: 'C2', phase: 'G3', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'route right → peer2 (no link yet)',
      payload: { share: 'ws-glade', detail: { answer: 'peer2 (claim valid)', link: 'NONE — dial required' } },
      gate: { kind: 'routing', label: 'ServeClaim lookup', status: 'designed', note: 'The claim names peer2; reaching it is iroh’s job (the layer split holds under recursion).' },
      note: 'Routing a derived binding recursively drives discovery of new peers.',
      docRef: `${WD} §3/§4`,
      sets: { local1: { 'route ws-glade': 'peer2 (dial needed)' } },
    },
    {
      state: 'B4', phase: 'G3', kind: 'message', from: 'local1', to: 'iroh', frame: 'RESOLVE',
      label: 'resolve peer2',
      payload: { detail: { nodeId: 'peer2 (ed25519)' } },
      note: 'Same B4 as the golden path — recursion, not new machinery.',
    },
    {
      state: 'B6', phase: 'G3', kind: 'message', from: 'local1', to: 'peer2', frame: 'DIAL',
      label: 'dial + node HELLO',
      payload: { detail: { transport: 'iroh QUIC' } },
      gate: { kind: 'security', label: 'node↔node HELLO seam', status: 'stub-allow-all', note: 'Every new link passes the same seam.' },
      note: 'peer2 joins the mesh because a service needed it.',
      docRef: `${WD} §3`,
      sets: { local1: { links: 'peer1, peer2 (iroh)' }, peer2: { links: 'local1 (iroh)' } },
    },
    {
      state: 'C3', phase: 'G3', kind: 'message', from: 'local1', to: 'peer2', frame: 'SUBSCRIBE',
      label: 'forward right interest',
      payload: { share: 'ws-glade', gladeId: 'ws.tree', key: '{root:"/"}', shape: 'value' },
      gate: { kind: 'capability', label: 'capability check', status: 'stub-allow-all', note: 'Same question as the left leg.' },
      note: 'Right source interest lands.',
      docRef: 'SecurityModelAnalysisPrompt §3.4',
      sets: { peer2: { 'sub ws-glade/ws.tree': 'local1' } },
    },
    {
      state: 'C5', phase: 'G3', kind: 'message', from: 'peer2', to: 'local1', frame: 'OPS',
      label: 'right tree arrives', response: true,
      payload: { share: 'ws-glade', gladeId: 'ws.tree', detail: { ops: 'tree snapshot (origin: peer2)' } },
      note: 'Both sources present at local1; the service’s inputs are satisfied.',
      sets: { local1: { replica: 'ws-razel/ws.tree · ws-glade/ws.tree' } },
    },
    {
      state: 'G4', phase: 'G3', kind: 'internal', from: 'svc-diff', frame: 'PROVIDE',
      label: 'compute + emit diff',
      payload: { share: 'svc', gladeId: 'ws.diff', detail: { result: '+12 −3 files, 2 renames' } },
      note: 'The instance folds its two inputs and emits the derived value as the authority for svc/ws.diff.',
      docRef: `${SUB_V1} §3 (authority: share)`,
      sets: { 'svc-diff': { fold: 'diff computed (+12 −3)' } },
    },
    {
      state: 'A5', phase: 'G3', kind: 'message', from: 'local1', to: 'gryth1', frame: 'OPS',
      label: 'diff to UI', response: true,
      payload: { share: 'svc', gladeId: 'ws.diff', shape: 'value' },
      note: 'The consumer sees a value like any other; the instantiation dance was invisible.',
      sets: { gryth1: { view: 'diff: +12 −3 files' } },
    },
    {
      state: 'C5', phase: 'G4', kind: 'message', from: 'peer2', to: 'local1', frame: 'OPS',
      label: 'right source changes',
      payload: { share: 'ws-glade', gladeId: 'ws.tree', detail: { ops: 'file edited on peer2' } },
      note: 'Live input: the diff must react.',
    },
    {
      state: 'G4', phase: 'G4', kind: 'internal', from: 'svc-diff', frame: 'PROVIDE',
      label: 'recompute on source ops',
      payload: { detail: { result: '+13 −3 files' } },
      note: 'CONTENTIOUS: recompute granularity (every op? debounced? demanded?) is a service-definition policy, not substrate.',
      sets: { 'svc-diff': { fold: 'diff recomputed (+13 −3)' } },
    },
    {
      state: 'A5', phase: 'G4', kind: 'message', from: 'local1', to: 'gryth1', frame: 'OPS',
      label: 'updated diff', response: true,
      payload: { share: 'svc', gladeId: 'ws.diff' },
      note: 'The UI tap just updates.',
      sets: { gryth1: { view: 'diff: +13 −3 files' } },
    },
    {
      state: 'F4', phase: 'G4', kind: 'message', from: 'gryth1', to: 'local1', frame: 'UNSUBSCRIBE',
      label: 'viewer closes',
      payload: { share: 'svc', gladeId: 'ws.diff' },
      note: 'Interest hits zero.',
      sets: { gryth1: { subs: null, view: null }, local1: { 'sub svc/ws.diff': null } },
    },
    {
      state: 'G5', phase: 'G4', kind: 'internal', from: 'local1', frame: 'TEARDOWN',
      label: 'service teardown',
      payload: { detail: { instance: 'diff#1', refs: '0' } },
      note: 'CONTENTIOUS: teardown policy — immediate, grace period (a second viewer arriving in 5s re-uses it), or retained like a replica? Mirrors F3’s retention question, for compute.',
      docRef: 'GDL-014 (lifetime)',
      sets: { 'svc-diff': { alive: null, refs: null, left: null, right: null, fold: null }, local1: { services: null, 'session svc-diff': null } },
    },
  ],
};
