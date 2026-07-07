// Replica transmission & verification, service sharing, and replica-set
// migration — the batch unblocked by the 2026-07-05 rulings (AZ-12 checkpoint
// anchoring, dedup default per-node, home-node-owned repair).
import type { Scenario } from './types';
import { pick } from './actors';

const AZ = 'GladeAuthzModel';
const SUB_V1 = 'GladeSubstrateV1';
const WD = 'GladeWorkspaceDirectory';

export const S_SYNC: Scenario = {
  id: 's-sync',
  stage: 2,
  title: 'Replica sync — verify everything, trust no carrier',
  summary: 'A new replica bootstraps from a signed checkpoint, verifies the stream per-op, survives a tampering carrier by re-fetching elsewhere, and turns an origin fork into proof.',

  actors: pick('local2', 'local1', 'peer1'),

  initial: {
    local1: {
      operator: 'gianni',
      'replica ws-razel': 'full (origin: peer1)',
      'hold ws-razel': 'granted: gianni',
      links: 'peer1 (iroh)',
      'sub home': 'peer1 (mesh)',
    },
    local2: {
      operator: 'gianni',
      'hold ws-razel': 'granted: gianni',
      'fold home': 'claims + checkpoint anchors (AZ-12)',
    },
    peer1: {
      operator: 'gianni',
      'claim ws-razel': 'held — epoch 2',
      serving: 'ws-razel via grazel',
      'replica ws-razel': 'origin',
      'hold ws-razel': 'granted: gianni',
    },
  },

  phases: [
    { id: 'SY1', label: 'Heads + checkpoint', summary: 'Gaps computed exactly; compacted history bootstraps from a signed, share-anchored checkpoint.' },
    { id: 'SY2', label: 'Verified stream', summary: 'Chunked bulk transfer; every op verified as it lands.' },
    { id: 'SY3', label: 'Tamper → re-fetch', summary: 'A bad carrier is an inconvenience, never a compromise.' },
    { id: 'SY4', label: 'Equivocation is proof', summary: 'Two signed ops in one slot convict the origin, not the messenger.' },
  ],

  steps: [
    {
      state: 'B6', phase: 'SY1', kind: 'message', from: 'local2', to: 'local1', frame: 'DIAL',
      label: 'new replica dials a source',
      payload: { detail: { transport: 'iroh QUIC', why: 'any replica can serve sync — carriers are interchangeable' } },
      gate: { kind: 'security', label: 'node↔node HELLO seam', status: 'enforced', note: 'Operator chains verify; but note what follows does NOT rely on this — sync integrity never trusts the carrier.' },
      note: 'local2 was granted replica.hold for ws-razel; it can bootstrap from ANY replica, not just the origin.',
      docRef: `${AZ} §7a/§7b`,
      sets: { local2: { links: 'local1 (iroh)' }, local1: { links: 'peer1, local2 (iroh)' } },
    },
    {
      state: 'B7', phase: 'SY1', kind: 'message', from: 'local2', to: 'local1', frame: 'HEADS',
      label: 'heads: empty vs full',
      payload: { share: 'ws-razel', detail: { mine: 'empty vector', theirs: 'per-origin (seq, chain-head)', bonus: 'same seq + DIFFERENT head here would already be fork evidence' } },
      note: 'Version vectors compute the exact gap both ways — and double as the first tamper tripwire.',
      docRef: `${SUB_V1} §2 (GQ-9)`,
    },
    {
      state: 'Y1', phase: 'SY1', kind: 'internal', from: 'local2', frame: 'FOLD',
      label: 'checkpoint accepted (anchored)',
      payload: { share: 'ws-razel', detail: { checkpoint: 'origin peer1, seq 12,000, signed by origin', anchor: 'checkpoint head ALSO in the home-share fold — rewrite would diverge the folds' } },
      note: 'The AZ-12 ruling drawn: origin-signed checkpoint + share anchoring = countersigning-by-replication, no new protocol.',
      docRef: 'AZ-12 ruling · GladeAuthzModel §9',
      sets: { local2: { 'replica ws-razel': 'base @ checkpoint 12,000', 'hold ws-razel': 'granted: gianni' } },
    },
    {
      state: 'B8', phase: 'SY2', kind: 'message', from: 'local1', to: 'local2', frame: 'OPS',
      label: 'gap stream, chunk 1', response: true,
      payload: { share: 'ws-razel', detail: { range: '(peer1, 12,001..14,102)', priority: 'BULK — size-capped chunks; never blocks interactive traffic' } },
      note: 'The window trace’s scheduler guarantee extends to sync: bulk backfill yields to everything.',
      docRef: `${SUB_V1} §6 (priority)`,
    },
    {
      state: 'Y2', phase: 'SY2', kind: 'internal', from: 'local2', frame: 'FOLD',
      label: 'verify-as-ingest',
      payload: { detail: { perOp: 'prev-hash continuity + origin signature + seq monotonic', cost: 'O(1) per op — no whole-share view needed' } },
      gate: { kind: 'security', label: 'chain verification', status: 'designed', note: 'A 10GB share verifies as it streams. The carrier could be an enemy; the chains don’t care.' },
      note: 'Integrity is end-to-end from the origin’s signatures — node trust governs placement, never truth.',
      docRef: `${SUB_V1} §2 (GQ-9) · ${AZ} §7a`,
      sets: { local2: { 'replica ws-razel': 'verified to seq 14,102' } },
    },
    {
      state: 'B8', phase: 'SY2', kind: 'message', from: 'local1', to: 'local2', frame: 'OPS',
      label: 'gap stream, final chunk', response: true,
      payload: { share: 'ws-razel', detail: { range: '(peer1, 14,103..14,480)' } },
      note: 'Resumable by construction: vectors make partial ingestion just… progress.',
    },
    {
      state: 'Y2', phase: 'SY2', kind: 'internal', from: 'local2', frame: 'FOLD',
      label: 'sync complete, all verified',
      payload: { detail: { state: 'byte-for-byte the same op-set as every other replica' } },
      gate: { kind: 'security', label: 'chain verification', status: 'designed', note: 'Same fold everywhere follows from same op-set everywhere.' },
      note: 'local2 is now a full replica and (M3) could advertise it.',
      docRef: `${SUB_V1} §2`,
      sets: { local2: { 'replica ws-razel': 'full (verified)' } },
    },
    {
      state: 'B8', phase: 'SY3', kind: 'message', from: 'local1', to: 'local2', frame: 'OPS', variant: 'a',
      variantNote: 'The carrier tampers: one op in this chunk has flipped bytes (corruption or malice — indistinguishable, and it does not matter which).',
      label: 'tampered chunk arrives', response: true,
      payload: { share: 'ws-razel', detail: { range: '(peer1, 14,481..14,499)', problem: 'op 14,490 modified in transit' } },
      note: 'The interesting case: the SOURCE we authenticated is now feeding us garbage.',
    },
    {
      state: 'Y3', phase: 'SY3', kind: 'internal', from: 'local2', frame: 'FOLD',
      label: 'chain check FAILS — reject + re-route',
      payload: { detail: { failure: 'prev-hash mismatch at (peer1, 14,490)', action: 'reject op + suffix FROM THIS PEER for this origin; re-fetch elsewhere' } },
      gate: { kind: 'security', label: 'chain verification', status: 'enforced', note: 'Tampering degrades to a retry, never a compromise — the property that makes untrusted carriers (blind relays, strangers’ nodes) safe to sync through.' },
      note: 'local1 is marked suspect for this origin; nothing it sent after the break is kept.',
      docRef: `${SUB_V1} §2 · ${AZ} §7a`,
      sets: { local2: { 'suspect local1': 'ws-razel/peer1 suffix rejected @14,490' } },
    },
    {
      state: 'B8', phase: 'SY3', kind: 'message', from: 'peer1', to: 'local2', frame: 'OPS',
      label: 're-fetch from another replica', response: true,
      payload: { share: 'ws-razel', detail: { range: '(peer1, 14,481..14,499) — resume is exact', via: 'iroh dial compressed' } },
      note: 'Interchangeable carriers, exact resume: the retry costs one range, not one share.',
    },
    {
      state: 'Y2', phase: 'SY3', kind: 'internal', from: 'local2', frame: 'FOLD',
      label: 'clean copy verifies',
      payload: { detail: { state: 'full replica restored' } },
      gate: { kind: 'security', label: 'chain verification', status: 'designed', note: 'Same check, honest bytes.' },
      note: 'The suspect mark can decay or persist as reputation — a policy choice, not a protocol one.',
      docRef: `${SUB_V1} §2`,
      sets: { local2: { 'replica ws-razel': 'full (verified)', 'suspect local1': null } },
    },
    {
      state: 'B8', phase: 'SY4', kind: 'message', from: 'local1', to: 'local2', frame: 'OPS',
      label: 'op A for slot (peer1, 14,500)', response: true,
      payload: { share: 'ws-razel', detail: { op: '(peer1, 14,500) = A — SIGNED by peer1' } },
      note: 'A validly signed op relayed by local1.',
    },
    {
      state: 'B8', phase: 'SY4', kind: 'message', from: 'peer1', to: 'local2', frame: 'OPS',
      label: 'op B for the SAME slot', response: true,
      payload: { share: 'ws-razel', detail: { op: '(peer1, 14,500) = B — also SIGNED by peer1' } },
      note: 'Both signatures verify. Both cannot be honest: the ORIGIN signed two histories.',
    },
    {
      state: 'Y4', phase: 'SY4', kind: 'internal', from: 'local2', frame: 'APPEND',
      label: 'equivocation PROOF recorded',
      payload: { detail: { evidence: 'two signed ops, one (origin, seq) slot — a self-contained fork proof', action: 'origin flagged; share surfaced to UI; proof replicates like any record' } },
      note: 'Contrast SY3: tampering convicts nobody (carriers are untrusted anyway); equivocation convicts the ORIGIN, cryptographically, forever. Failure is data with a signature on it.',
      docRef: `${SUB_V1} §2 (GQ-9 equivocation) · ${WD} §2`,
      sets: { local2: { evidence: 'peer1 FORKED at ws-razel/14,500 (proof held)' } },
    },
  ],
};

export const S_SVC_SHARED: Scenario = {
  id: 's-svc-shared',
  stage: 2,
  title: 'Shared service — discover the instance, don’t spawn it',
  summary: 'ui1@local1 and ui2@local2 want the same diff: the running instance’s leased claim is discovered before definition matching; the per-node variant shows why duplication would still be CORRECT.',

  actors: pick('gryth1', 'gryth3', 'local1', 'local2', 'svc-diff'),

  initial: {
    gryth1: { view: 'diff: +13 −3 (live)' },
    gryth3: { session: 'local2 (open)' },
    'svc-diff': { alive: 'yes', refs: '1 (gryth1 via local1)', fold: 'diff computed (+13 −3)' },
    local1: {
      operator: 'gianni',
      'session gryth1': 'open',
      'session svc-diff': 'open (service)',
      services: 'diff#1 running',
      'sub svc/ws.diff': 'gryth1',
      'hold svc': 'granted: gianni',
      'grant gryth1 svc': 'read.subscribe',
      'fold home': 'ServiceInstanceClaim(diff#1@local1, lease 30s)',
      'sub home': 'local2 (mesh)',
    },
    local2: {
      operator: 'gianni',
      'session gryth3': 'open',
      'hold svc': 'granted: gianni',
      'grant gryth3 svc': 'read.subscribe',
      'fold home': 'ServiceInstanceClaim(diff#1@local1) — replicated',
    },
  },

  phases: [
    { id: 'SS1', label: 'Second consumer, other node', summary: 'Same canonical key, different machine.' },
    { id: 'SS2', label: 'Discover, don’t spawn', summary: 'The leased instance claim wins the G1 lookup; the derived stream replicates.' },
    { id: 'SS3', label: 'dedup: per-node (variant)', summary: 'Policy says recompute — and determinism makes that merely warm, never wrong.' },
  ],

  steps: [
    {
      state: 'C1', phase: 'SS1', kind: 'message', from: 'gryth3', to: 'local2', frame: 'SUBSCRIBE',
      label: 'ui2 asks for THE SAME diff',
      payload: { share: 'svc', gladeId: 'ws.diff', key: '{left:(ws-razel, ws.tree), right:(ws-glade, ws.tree)}', shape: 'value' },
      note: 'The canonical key is the dedup key — byte-identical to ui1’s ask on the other node.',
      sets: { gryth3: { subs: 'svc/ws.diff' }, local2: { 'sub svc/ws.diff': 'gryth3' } },
    },
    {
      state: 'G6', phase: 'SS2', kind: 'internal', from: 'local2', frame: 'ROUTE',
      label: 'instance DISCOVERED via claim',
      payload: { share: 'svc', detail: { lookup: '1) live ServiceInstanceClaim for this key? YES — diff#1@local1, lease valid', skipped: '2) ServiceDefinition matching (would have spawned)' } },
      gate: { kind: 'routing', label: 'instance-claim lookup', status: 'designed', note: 'Service advertisement = leased claim records in the share; discovery is a fold, exactly like workspaces (WD-8 ruling). No registry service exists.' },
      note: 'The answer to “does the diff service get shared”: yes — because its existence is DATA in the directory.',
      docRef: 'WD-8 ruling · GladeWorkspaceDirectory §8',
      sets: { local2: { 'route svc/ws.diff': 'diff#1@local1 (instance claim)' } },
    },
    {
      state: 'B6', phase: 'SS2', kind: 'message', from: 'local2', to: 'local1', frame: 'DIAL',
      label: 'dial the hosting node',
      payload: { detail: { transport: 'iroh QUIC' } },
      gate: { kind: 'security', label: 'node↔node HELLO seam', status: 'enforced', note: 'Same-user mesh; chains verify.' },
      note: 'Reaching the instance is ordinary node discovery.',
      docRef: `${AZ} §7b`,
      sets: { local2: { links: 'local1 (iroh)' }, local1: { links: 'local2 (iroh)' } },
    },
    {
      state: 'C3', phase: 'SS2', kind: 'message', from: 'local2', to: 'local1', frame: 'SUBSCRIBE',
      label: 'forward interest to the instance',
      payload: { share: 'svc', gladeId: 'ws.diff', key: '{left, right}', shape: 'value' },
      gate: { kind: 'capability', label: 'capability check', status: 'enforced', note: 'gryth3’s chain rides the interest; the hosting node checks its own fold.' },
      note: 'The derived binding forwards like any binding.',
      docRef: `${AZ} §6`,
      sets: { local1: { 'sub svc/ws.diff': 'gryth1, local2' } },
    },
    {
      state: 'F2', phase: 'SS2', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'instance lifetime = union of interest',
      payload: { detail: { refs: 'gryth1 (local) + gryth3 (via local2)', lease: 'renewed while ANY interest lives' } },
      note: 'Cross-node refcounting falls out of interest aggregation — the instance outlives its first asker.',
      sets: { 'svc-diff': { refs: '2 (gryth1 · gryth3 via local2)' } },
    },
    {
      state: 'C5', phase: 'SS2', kind: 'message', from: 'local1', to: 'local2', frame: 'OPS',
      label: 'derived stream replicates', response: true,
      payload: { share: 'svc', gladeId: 'ws.diff', shape: 'value' },
      note: 'Replica-of-replica of a DERIVED stream — the C2.a mechanics, unchanged.',
      sets: { local2: { 'replica svc': 'ws.diff (warm)' } },
    },
    {
      state: 'A5', phase: 'SS2', kind: 'message', from: 'local2', to: 'gryth3', frame: 'OPS',
      label: 'ui2 served', response: true,
      payload: { share: 'svc', gladeId: 'ws.diff', shape: 'value' },
      note: 'One computation, two nodes, two consumers. INV-2/INV-4/INV-5 all hold at this hop.',
      sets: { gryth3: { view: 'diff: +13 −3 (live, shared instance)' } },
    },
    {
      state: 'G6', phase: 'SS3', kind: 'internal', from: 'local2', frame: 'ROUTE', variant: 'a',
      variantNote: 'The ServiceDefinition declares dedup: per-node (the default, per ruling) — discovery is SKIPPED by policy and the node computes locally.',
      label: 'policy says: recompute locally',
      payload: { share: 'svc', detail: { policy: 'dedup: per-node (default)', why: 'diff is cheap; locality beats sharing' } },
      gate: { kind: 'routing', label: 'instance-claim lookup', status: 'designed', note: 'Dedup is an ECONOMICS policy per service — expensive services (builds) opt into global; cheap ones recompute.' },
      note: 'Same ask, different policy, different route — both correct.',
      docRef: 'WD-8 ruling (dedup default)',
    },
    {
      state: 'G2', phase: 'SS3', kind: 'internal', from: 'local2', frame: 'SPAWN',
      label: 'diff#2 spawns locally',
      payload: { detail: { instance: 'diff#2@local2', inputs: 'same two sources, same canonical key' } },
      note: 'The temp node drawn in the graph is diff#1; diff#2 exists only in local2’s state here.',
      sets: { local2: { services: 'diff#2 (per-node)' } },
    },
    {
      state: 'A5', phase: 'SS3', kind: 'message', from: 'local2', to: 'gryth3', frame: 'OPS',
      label: 'byte-identical result', response: true,
      payload: { share: 'svc', gladeId: 'ws.diff', detail: { result: '+13 −3 — indistinguishable from diff#1’s output' } },
      note: 'Determinism makes duplication CORRECT, merely warm: same sources, same fold, same bytes. That is why dedup gets to be an economics choice at all.',
      docRef: 'GladeSubstrateV1 §2 (convergence)',
      sets: { gryth3: { view: 'diff: +13 −3 (live, local instance)' } },
    },
  ],
};

export const S_MIGRATE: Scenario = {
  id: 's-migrate',
  stage: 2,
  title: 'Replica migration — lapse, repair, and the non-event',
  summary: 'A replica’s hint lease lapses below min-replica; the home-node role repairs by pushing a verified sync to another hold-granted node. Origins, meanwhile, never migrate at all.',

  actors: pick('local1', 'peer2', 'peer3'),

  initial: {
    local1: {
      operator: 'gianni',
      role: 'home-node (durable replica + repair owner)',
      'replica ws-shared': 'full',
      'hold ws-shared': 'granted: gianni',
      'fold home': 'min-replica(ws-shared)=2 · hints: local1, peer2',
      links: 'peer2, peer3 (iroh)',
      'sub home': 'peer2, peer3 (mesh)',
    },
    peer2: {
      operator: 'gianni',
      'replica ws-shared': 'full',
      'hold ws-shared': 'granted: gianni',
      'ReplicaHint ws-shared': 'lease fresh',
      status: 'about to sleep',
    },
    peer3: {
      operator: 'gianni',
      'hold ws-shared': 'granted: gianni',
      'sub home': 'local1 (mesh)',
    },
  },

  phases: [
    { id: 'MG1', label: 'Lapse is visible', summary: 'No failure detector — an absence, judged at the reader’s clock.' },
    { id: 'MG2', label: 'Repair (home-node role)', summary: 'Placement-checked target, verified push, idempotent by design.' },
    { id: 'MG3', label: 'Restored — and the non-event', summary: 'Hints back to 2/2; the sleeping device’s HISTORY never needed rescue.' },
  ],

  steps: [
    {
      state: 'M1', phase: 'MG1', kind: 'internal', from: 'local1', frame: 'LEASE',
      label: 'peer2’s hint lapses',
      payload: { share: 'ws-shared', detail: { observed: 'ReplicaHint(peer2) past horizon at local1’s clock', fold: 'replica count 1 < min 2' } },
      note: 'Same projection-time discipline as claims: nothing "happened" — a renewal is absent. Note the non-event hiding here: peer2’s AUTHORED OPS are already in every replica; devices sleep, logs don’t.',
      docRef: `${WD} §2 (no-time-in-fold) · §8`,
      sets: { local1: { 'fold home': 'min-replica 2 · hints: local1 ONLY (peer2 lapsed)' }, peer2: { status: 'asleep (not renewing)', 'ReplicaHint ws-shared': 'stale at readers' } },
    },
    {
      state: 'M2', phase: 'MG2', kind: 'internal', from: 'local1', frame: 'LEASE',
      label: 'repair loop engages',
      payload: { share: 'ws-shared', detail: { owner: 'home-node role (WD-8 ruling)', fallback: 'any replica MAY run this — repair is convergent, double-repair is harmless' } },
      gate: { kind: 'routing', label: 'under-replication repair', status: 'designed', note: 'Durability is policy: min-replica is a declared record; the repair loop is its controller, collapsed to user scale.' },
      note: 'Fault tolerance = the same rule pointed at durability. No pager, no ceremony.',
      docRef: 'WD-8 ruling · GladeDistributedControlPlane (collapsed)',
      sets: { local1: { repair: 'ws-shared → seeking target' } },
    },
    {
      state: 'S8', phase: 'MG2', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'placement check: peer3 qualifies',
      payload: { share: 'ws-shared', detail: { candidate: 'peer3', check: 'operator gianni ∈ hold(ws-shared)', verdict: 'ALLOW' } },
      gate: { kind: 'capability', label: 'placement (replica.hold)', status: 'enforced', note: 'Repair cannot park plaintext on unaccepted hardware either — INV-5 watches repair too.' },
      note: 'The repair target must pass the same placement rule as any replica.',
      docRef: `${AZ} §7a`,
    },
    {
      state: 'B7', phase: 'MG2', kind: 'message', from: 'local1', to: 'peer3', frame: 'HEADS',
      label: 'heads to the target',
      payload: { share: 'ws-shared', detail: { theirs: 'empty', push: 'full gap computed' } },
      note: 'Repair is just sync, initiated from the durable side.',
      docRef: `${SUB_V1} §2`,
    },
    {
      state: 'B8', phase: 'MG2', kind: 'message', from: 'local1', to: 'peer3', frame: 'OPS',
      label: 'verified push', response: true,
      payload: { share: 'ws-shared', detail: { priority: 'bulk', chunked: 'size-capped' } },
      note: 'Same chunked, resumable stream as s-sync.',
      sets: { peer3: { 'replica ws-shared': 'streaming (verifying)' } },
    },
    {
      state: 'Y2', phase: 'MG2', kind: 'internal', from: 'peer3', frame: 'FOLD',
      label: 'target verifies as it ingests',
      payload: { detail: { perOp: 'chains + signatures — the s-sync machinery, reused' } },
      gate: { kind: 'security', label: 'chain verification', status: 'designed', note: 'Repair inherits sync’s trust model for free: the pusher could be malicious and the replica would still be sound.' },
      note: 'One verification story for bootstrap, roaming, and repair.',
      docRef: `${SUB_V1} §2 (GQ-9)`,
      sets: { peer3: { 'replica ws-shared': 'full (verified)' } },
    },
    {
      state: 'M3', phase: 'MG3', kind: 'internal', from: 'peer3', frame: 'LEASE',
      label: 'new hint published',
      payload: { share: 'ws-shared', detail: { record: 'ReplicaHint(peer3, lease 30s)' } },
      note: 'The replica advertises itself — feeding nearest-replica routing and future repairs.',
      docRef: `${WD} §8`,
      sets: { peer3: { 'ReplicaHint ws-shared': 'lease fresh' } },
    },
    {
      state: 'B9', phase: 'MG3', kind: 'message', from: 'peer3', to: 'local1', frame: 'OPS',
      label: 'hint replicates — 2/2 restored',
      payload: { share: 'home', detail: { ops: 'ReplicaHint(peer3)' } },
      note: 'The fold that noticed the lapse now shows health. When peer2 wakes, it re-syncs and re-advertises — 3/2 is fine; min is a floor, not a target.',
      sets: { local1: { 'fold home': 'min-replica 2 · hints: local1, peer3 (peer2 will rejoin)', repair: null } },
    },
  ],
};
