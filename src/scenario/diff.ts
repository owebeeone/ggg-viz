// glade-diff security arms — the demand-instantiated derived surface, proven as
// folded state. These extend the two core traces (s-diff-service @services.ts,
// s-svc-shared @sync.ts) with the D3/D4/D5 rulings that make the diff a
// non-laundering derived surface: the INV-7 leak guard (Readers(diff) ⊆
// Readers(left) ∩ Readers(right)), generation state (never serve a stale gen as
// current), the D5 sandbox contract, and revoke-between-compute-and-delivery.
// Spec of record: dev-docs/glade/suppliers/glade-diff.md (D1–D5 ratified
// 2026-07-12). All four are stage 2 — security is a stage-1 MUST here (§7), so
// the gates are ENFORCED and the enforcing decisions ride the fold.
import type { Scenario } from './types';
import { pick } from './actors';

const DIFF = 'glade-diff';
const SM = 'GladeSupplierModel';
const WD = 'GladeWorkspaceDirectory';

// The derived-surface opt-in for INV-7: local1 serves svc/ws.diff folded from
// two source workspace closures. Spelled exactly as the invariant keys on it.
const DERIVED = 'sources: [ws-razel, ws-glade]';

// ---------------------------------------------------------------------------
// s-diff-authz — INV-7 (D3, §5): per-principal can_read(left) && can_read(right).
// Four vectors over ONE warm instance: BOTH served; LEFT-ONLY / RIGHT-ONLY /
// NEITHER each denied at their edge. Readers(diff) ⊆ Readers(left) ∩ Readers(right).
// ---------------------------------------------------------------------------
export const S_DIFF_AUTHZ: Scenario = {
  id: 's-diff-authz',
  stage: 2,
  title: 'Diff authz — read both sources, or read nothing',
  summary: 'One warm diff instance, four readers: only the one who can read BOTH sources is served; left-only, right-only, and neither are each denied at their edge (INV-7).',

  actors: pick('gryth1', 'gryth2', 'gryth3', 'guest1', 'local1', 'svc-diff'),

  initial: {
    local1: {
      services: 'diff#1 running',
      'session svc-diff': 'open (service)',
      'session gryth1': 'open', 'session gryth2': 'open', 'session gryth3': 'open', 'session guest1': 'open',
      // The derived-surface declaration — the INV-7 opt-in (source closures).
      'derived svc/ws.diff': DERIVED,
      // gryth1 = BOTH sources → the only reader who may see the diff.
      'grant gryth1 svc': 'read.subscribe',
      'grant gryth1 ws-razel': 'read.subscribe',
      'grant gryth1 ws-glade': 'read.subscribe',
      // gryth2 = LEFT-ONLY (ws-razel, not ws-glade).
      'grant gryth2 svc': 'read.subscribe',
      'grant gryth2 ws-razel': 'read.subscribe',
      // gryth3 = RIGHT-ONLY (ws-glade, not ws-razel).
      'grant gryth3 svc': 'read.subscribe',
      'grant gryth3 ws-glade': 'read.subscribe',
      // guest1 = NEITHER (a valid session, no source grants at all).
    },
    'svc-diff': { alive: 'yes', refs: '1 (gryth1)', fold: 'diff computed (+12 −3)' },
  },

  phases: [
    { id: 'AZ1', label: 'One computed artifact', summary: 'The instance holds a ready generation, keyed structurally — viewer identity excluded (D1). Authority is decided per viewer, not by the instance.' },
    { id: 'AZ2', label: 'Both sources → served', summary: 'The reader who holds read on left AND right is the only one admitted.' },
    { id: 'AZ3', label: 'One side / neither → denied', summary: 'Left-only, right-only, and neither are refused at their edge — the artifact never laundered access to a source.' },
  ],

  steps: [
    {
      state: 'G4', phase: 'AZ1', kind: 'internal', from: 'svc-diff', frame: 'PROVIDE',
      label: 'generation ready (viewer-independent)',
      payload: { share: 'svc', gladeId: 'ws.diff', detail: { generation: 'gen 1 · ready', computeKey: 'def-digest + sandbox v + ordered (ws-razel, ws-glade)', note: 'viewer identity NOT in the compute key (D1)' } },
      note: 'Two-level identity (D1): the shared compute instance produces one generation, keyed structurally with the viewer excluded. Reuse of this warm generation across viewers NEVER reuses authority — each subscribe is admitted independently below.',
      docRef: `${DIFF} §1/§6 (D1)`,
      sets: { 'svc-diff': { 'generation svc/ws.diff': 'gen 1 (ready)' } },
    },

    // ---- BOTH → served -----------------------------------------------------
    {
      state: 'C1', phase: 'AZ2', kind: 'message', from: 'gryth1', to: 'local1', frame: 'SUBSCRIBE',
      label: 'subscribe: reader of both sources',
      payload: { share: 'svc', gladeId: 'ws.diff', key: '{left:(ws-razel, ws.tree), right:(ws-glade, ws.tree)}', shape: 'value' },
      note: 'gryth1 asks for the derived binding. The consumer cannot know its own authority — the leak guard is the node’s call, re-run at every delivery hop.',
      docRef: `${DIFF} §3`,
      sets: { gryth1: { subs: 'svc/ws.diff' }, local1: { 'sub svc/ws.diff': 'gryth1' } },
    },
    {
      state: 'S4', phase: 'AZ2', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'leak guard: can_read(left) && can_read(right) → ALLOW',
      payload: { share: 'svc', detail: { principal: 'gryth1', left: 'ws-razel: read ✓', right: 'ws-glade: read ✓', verdict: 'ALLOW' } },
      gate: { kind: 'capability', label: 'source-closure leak guard', status: 'enforced', note: 'D3, load-bearing + STAGE-1: every subscribe/replay/cache-delivery/forward establishes can_read(left) && can_read(right) for the requesting B3 principal. Reader-set form Readers(diff) ⊆ Readers(left) ∩ Readers(right). This is INV-7 checked mechanically on the fold.' },
      note: 'gryth1 holds read on BOTH source closures, so it may read the diff. The derived surface never grants more than the intersection of its sources.',
      docRef: `${DIFF} §5 (D3, INV-7)`,
    },
    {
      state: 'A5', phase: 'AZ2', kind: 'message', from: 'local1', to: 'gryth1', frame: 'OPS',
      label: 'diff delivered', response: true,
      payload: { share: 'svc', gladeId: 'ws.diff', shape: 'value', detail: { result: '+12 −3 files, 2 renames', generation: 'gen 1 (ready)' } },
      note: 'The only served vector. INV-2 (sub), INV-4 (grant svc), and INV-7 (grants on BOTH ws-razel + ws-glade) all hold at this hop — drop either source grant and INV-7 flags it.',
      docRef: `${DIFF} §5/§6`,
      sets: { gryth1: { view: 'diff: +12 −3 files' } },
    },

    // ---- LEFT-ONLY → denied ------------------------------------------------
    {
      state: 'C1', phase: 'AZ3', kind: 'message', from: 'gryth2', to: 'local1', frame: 'SUBSCRIBE',
      label: 'subscribe: left-only reader',
      payload: { share: 'svc', gladeId: 'ws.diff', key: '{left:(ws-razel, ws.tree), right:(ws-glade, ws.tree)}', shape: 'value' },
      note: 'gryth2 can read ws-razel (left) but NOT ws-glade (right). Byte-identical ask to gryth1 — the difference is authority, not the request.',
      docRef: `${DIFF} §5`,
      sets: { gryth2: { subs: 'svc/ws.diff (requested)' }, local1: { 'pending gryth2': 'svc/ws.diff (awaiting authz)' } },
    },
    {
      state: 'S4', phase: 'AZ3', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'leak guard: right missing → DENY',
      payload: { share: 'svc', detail: { principal: 'gryth2', left: 'ws-razel: read ✓', right: 'ws-glade: read ✗', verdict: 'DENY' } },
      gate: { kind: 'capability', label: 'source-closure leak guard', status: 'enforced', note: 'The RETRACTED backwards relation (read(diff) ⊇ read(left) ∪ read(right), SR56-2-24) would have SERVED gryth2 here — letting a left-only reader infer `right` from the diff. D3 flips it: a source it cannot read denies the whole diff.' },
      note: 'Left-only is denied: the diff would leak the unreadable right source by inference. No OPS is emitted — so INV-7 has nothing to serve, exactly the point.',
      docRef: `${DIFF} §5 (D3 retraction)`,
      sets: { local1: { 'denied gryth2': 'svc/ws.diff — no read on ws-glade', 'pending gryth2': null } },
    },
    {
      state: 'S3', phase: 'AZ3', kind: 'message', from: 'local1', to: 'gryth2', frame: 'STATUS',
      label: 'denied at the edge', response: true,
      payload: { share: 'svc', detail: { result: 'denied', reason: 'cannot read source ws-glade (right)', remedy: 'request a grant on the right workspace' } },
      gate: { kind: 'security', label: 'enforcement cut', status: 'enforced', note: 'Denial is data with a named remedy, not a spinner.' },
      note: 'The refusal happens at gryth2’s delivery edge; the warm generation the both-reader is seeing is untouched (per-principal enforcement, not per-stream).',
      docRef: `${DIFF} §5`,
      sets: { gryth2: { subs: null, view: 'diff: ACCESS DENIED (right source)' } },
    },

    // ---- RIGHT-ONLY → denied -----------------------------------------------
    {
      state: 'C1', phase: 'AZ3', kind: 'message', from: 'gryth3', to: 'local1', frame: 'SUBSCRIBE',
      label: 'subscribe: right-only reader',
      payload: { share: 'svc', gladeId: 'ws.diff', key: '{left:(ws-razel, ws.tree), right:(ws-glade, ws.tree)}', shape: 'value' },
      note: 'gryth3 can read ws-glade (right) but NOT ws-razel (left) — the mirror of gryth2.',
      docRef: `${DIFF} §5`,
      sets: { gryth3: { subs: 'svc/ws.diff (requested)' }, local1: { 'pending gryth3': 'svc/ws.diff (awaiting authz)' } },
    },
    {
      state: 'S4', phase: 'AZ3', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'leak guard: left missing → DENY',
      payload: { share: 'svc', detail: { principal: 'gryth3', left: 'ws-razel: read ✗', right: 'ws-glade: read ✓', verdict: 'DENY' } },
      gate: { kind: 'capability', label: 'source-closure leak guard', status: 'enforced', note: 'Symmetric to the left-only case: reading only the right source would leak the left by inference. The intersection, not the union, is the reader set.' },
      note: 'Right-only is denied for the same reason, the other way around — Readers(diff) is the INTERSECTION of the source reader sets.',
      docRef: `${DIFF} §5 (D3, INV-7)`,
      sets: { local1: { 'denied gryth3': 'svc/ws.diff — no read on ws-razel', 'pending gryth3': null } },
    },
    {
      state: 'S3', phase: 'AZ3', kind: 'message', from: 'local1', to: 'gryth3', frame: 'STATUS',
      label: 'denied at the edge', response: true,
      payload: { share: 'svc', detail: { result: 'denied', reason: 'cannot read source ws-razel (left)', remedy: 'request a grant on the left workspace' } },
      gate: { kind: 'security', label: 'enforcement cut', status: 'enforced', note: 'Same honest refusal, other source named.' },
      note: 'Right-only refused at its edge.',
      docRef: `${DIFF} §5`,
      sets: { gryth3: { subs: null, view: 'diff: ACCESS DENIED (left source)' } },
    },

    // ---- NEITHER → denied --------------------------------------------------
    {
      state: 'C1', phase: 'AZ3', kind: 'message', from: 'guest1', to: 'local1', frame: 'SUBSCRIBE',
      label: 'subscribe: reader of neither source',
      payload: { share: 'svc', gladeId: 'ws.diff', key: '{left:(ws-razel, ws.tree), right:(ws-glade, ws.tree)}', shape: 'value' },
      note: 'guest1 is a perfectly valid session (a different principal) with no grant on either source — authn ≠ authz.',
      docRef: `${DIFF} §5 · ${SM} §1`,
      sets: { guest1: { subs: 'svc/ws.diff (requested)' }, local1: { 'pending guest1': 'svc/ws.diff (awaiting authz)' } },
    },
    {
      state: 'S4', phase: 'AZ3', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'leak guard: neither source → DENY',
      payload: { share: 'svc', detail: { principal: 'guest1', left: 'ws-razel: read ✗', right: 'ws-glade: read ✗', verdict: 'DENY' } },
      gate: { kind: 'capability', label: 'source-closure leak guard', status: 'enforced', note: 'The empty-intersection case: holding a `grant guest1 svc` on the derived surface alone is not enough — the check is on the SOURCE closures, not the derived binding.' },
      note: 'Neither source is readable, so the diff is denied. Only ONE of the four combinations (both) is ever served — the property s-diff-authz exists to prove.',
      docRef: `${DIFF} §5 (INV-7: the four combinations)`,
      sets: { local1: { 'denied guest1': 'svc/ws.diff — reads neither source', 'pending guest1': null } },
    },
    {
      state: 'S3', phase: 'AZ3', kind: 'message', from: 'local1', to: 'guest1', frame: 'STATUS',
      label: 'denied at the edge', response: true,
      payload: { share: 'svc', detail: { result: 'denied', reason: 'reads neither source (ws-razel, ws-glade)', remedy: 'request grants on both source workspaces' } },
      gate: { kind: 'security', label: 'enforcement cut', status: 'enforced', note: 'Fourth and last vector — the deny set is complete.' },
      note: 'One instance, four readers, one served: Readers(diff) ⊆ Readers(left) ∩ Readers(right), demonstrated exhaustively.',
      docRef: `${DIFF} §5`,
      sets: { guest1: { subs: null, view: 'diff: ACCESS DENIED (no source access)' } },
    },
  ],
};

// ---------------------------------------------------------------------------
// s-diff-generation — D4: generation state pending|ready|stale|absent|denied|
// error. A cached `ready` is revalidated before delivery; a source change makes
// the cached generation STALE, never relabelled current.
// ---------------------------------------------------------------------------
export const S_DIFF_GENERATION: Scenario = {
  id: 's-diff-generation',
  stage: 2,
  title: 'Diff generation — revalidate the cache, never serve a stale gen',
  summary: 'A cached ready generation is revalidated (authz + freshness) before delivery; when a source changes, the cached gen is marked STALE and a new gen computed — the stale gen is never relabelled current (D4).',

  actors: pick('gryth1', 'local1', 'peer2', 'svc-diff'),

  initial: {
    local1: {
      services: 'diff#1 running',
      'session svc-diff': 'open (service)',
      'session gryth1': 'open',
      'derived svc/ws.diff': DERIVED,
      'grant gryth1 svc': 'read.subscribe',
      'grant gryth1 ws-razel': 'read.subscribe',
      'grant gryth1 ws-glade': 'read.subscribe',
      links: 'peer2 (iroh)',
    },
    // The right source lives at peer2; the instance already subscribes it (via
    // local1). peer2’s sub names local1 (a node) — node receiver, INV-4 exempt.
    peer2: { serving: 'ws-glade via grazel', 'sub ws-glade/ws.tree': 'local1' },
    'svc-diff': { alive: 'yes', refs: '1 (gryth1)', 'generation svc/ws.diff': 'gen 0 — pending (computing)' },
  },

  phases: [
    { id: 'GN1', label: 'Compute → ready', summary: 'The typed generation lifecycle: pending → ready, carrying the source revisions it was built from.' },
    { id: 'GN2', label: 'Revalidate before delivery', summary: 'A cached ready is NOT served blind — authz and currency are re-checked at the delivery edge.' },
    { id: 'GN3', label: 'Source change → stale', summary: 'A source op makes the cached gen STALE; a fresh gen is computed and the stale one is never served as current.' },
  ],

  steps: [
    {
      state: 'G4', phase: 'GN1', kind: 'internal', from: 'svc-diff', frame: 'PROVIDE',
      label: 'compute: pending → ready (gen 1)',
      payload: { share: 'svc', gladeId: 'ws.diff', detail: { states: 'pending | ready | stale | absent | denied | error (D4)', builtFrom: 'ws-razel@rev41 · ws-glade@rev18', result: '+12 −3 files' } },
      note: 'D4 generation state is a first-class typed outcome. grant-lapse → denied, source-change → stale, lapsed source ServeClaim → absent, worker-loss / deterministic program-failure → error — all DISTINGUISHABLE. The compute finishes: gen 1 is ready.',
      docRef: `${DIFF} §6 (D4)`,
      sets: { 'svc-diff': { 'generation svc/ws.diff': 'gen 1 (ready)' }, local1: { 'generation svc/ws.diff': 'gen 1 — ready (cached)' } },
    },
    {
      state: 'C1', phase: 'GN2', kind: 'message', from: 'gryth1', to: 'local1', frame: 'SUBSCRIBE',
      label: 'viewer subscribes — hits the warm cache',
      payload: { share: 'svc', gladeId: 'ws.diff', key: '{left:(ws-razel, ws.tree), right:(ws-glade, ws.tree)}', shape: 'value' },
      note: 'gryth1’s ask lands on an already-ready generation. The tempting fast path is to ship the cached bytes straight out.',
      docRef: `${DIFF} §6`,
      sets: { gryth1: { subs: 'svc/ws.diff' }, local1: { 'sub svc/ws.diff': 'gryth1' } },
    },
    {
      state: 'S4', phase: 'GN2', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'revalidate cached ready BEFORE delivery',
      payload: { share: 'svc', detail: { authz: 'can_read(left) && can_read(right) → ✓', currency: 'gen 1 still current for the folded source revisions → ✓', verdict: 'SERVE gen 1' } },
      gate: { kind: 'capability', label: 'pre-delivery revalidation', status: 'enforced', note: 'D4: a cached `ready` generation is REVALIDATED before delivery — the leak guard (D3) is re-run for THIS principal, and the generation is confirmed current, not just present. Cache-delivery is a checked hop, exactly like a fresh subscribe.' },
      note: 'The cache is never a bypass. Revalidation covers both authorization (INV-7) and freshness, so a delivered generation is always both permitted and current.',
      docRef: `${DIFF} §5/§6 (D3/D4)`,
    },
    {
      state: 'A5', phase: 'GN2', kind: 'message', from: 'local1', to: 'gryth1', frame: 'OPS',
      label: 'serve gen 1 (revalidated)', response: true,
      payload: { share: 'svc', gladeId: 'ws.diff', shape: 'value', detail: { result: '+12 −3 files', generation: 'gen 1 (ready, revalidated)' } },
      note: 'Delivery of a confirmed-current, authorized generation. INV-2/4/7 hold.',
      sets: { gryth1: { view: 'diff: +12 −3 files (gen 1)' } },
    },
    {
      state: 'C5', phase: 'GN3', kind: 'message', from: 'peer2', to: 'local1', frame: 'OPS',
      label: 'right source changes',
      payload: { share: 'ws-glade', gladeId: 'ws.tree', detail: { ops: 'file edited on peer2 → ws-glade@rev19' } },
      note: 'A live source op arrives. The gen 1 the viewer is holding was built from ws-glade@rev18 — it is now behind the source.',
      docRef: `${DIFF} §6`,
    },
    {
      state: 'G4', phase: 'GN3', kind: 'internal', from: 'svc-diff', frame: 'PROVIDE',
      label: 'gen 1 → STALE; recompute → gen 2',
      payload: { share: 'svc', gladeId: 'ws.diff', detail: { gen1: 'STALE (source-change; ws-glade@rev18 < rev19)', gen2: 'gen 2 · ready · built from ws-razel@rev41 · ws-glade@rev19', invariant: 'a STALE generation MUST NOT be relabelled current (D4)' } },
      note: 'The teardown-stale-replica hole closed: the old generation is marked stale, NOT silently advanced. A replicated `value` op from a torn-down or superseded instance is revalidated and treated as stale — never served as current.',
      docRef: `${DIFF} §6 (D4)`,
      sets: { 'svc-diff': { 'generation svc/ws.diff': 'gen 2 (ready) · gen 1 STALE' }, local1: { 'generation svc/ws.diff': 'gen 2 — ready (cached); gen 1 stale' } },
    },
    {
      state: 'A5', phase: 'GN3', kind: 'message', from: 'local1', to: 'gryth1', frame: 'OPS',
      label: 'serve gen 2 (the new current)', response: true,
      payload: { share: 'svc', gladeId: 'ws.diff', shape: 'value', detail: { result: '+13 −3 files', generation: 'gen 2 (ready)' } },
      note: 'The viewer moves forward to gen 2 — the current generation — while gen 1 stays labelled stale in the fold. Currency is monotonic and honest.',
      sets: { gryth1: { view: 'diff: +13 −3 files (gen 2)' } },
    },
  ],
};

// ---------------------------------------------------------------------------
// s-diff-sandbox-deny — D5: the diff instance runs in the sandbox. An undeclared
// network/filesystem attempt is a TYPED policy error, not ambient access.
// Defining a service vs authorizing its execution are SEPARATE capabilities.
// ---------------------------------------------------------------------------
export const S_DIFF_SANDBOX_DENY: Scenario = {
  id: 's-diff-sandbox-deny',
  stage: 2,
  title: 'Diff sandbox — no ambient authority, and define ≠ execute',
  summary: 'The diff program runs under the D5 sandbox: an undeclared network fetch is a typed policy error (no ambient access reached), surfaced as a generation `error`. A node holding only the DEFINE grant, not EXECUTE, is refused instantiation.',

  actors: pick('gryth1', 'local1', 'local2', 'svc-diff'),

  initial: {
    local1: {
      'session gryth1': 'open',
      'derived svc/ws.diff': DERIVED,
      'grant gryth1 svc': 'read.subscribe',
      'grant gryth1 ws-razel': 'read.subscribe',
      'grant gryth1 ws-glade': 'read.subscribe',
      // local1 holds BOTH capabilities: define the servicedef AND execute it.
      'servicedef diff': 'defined (grant: define)',
      'execute diff': 'granted (grant: execute)',
      'sandbox policy': 'diff-sbx:1 — read-only inputs; no fs/net/clock/rand/env/child-proc; bounded cpu/mem/output/wall',
      'sub home': 'local2 (mesh)',
    },
    // local2 replicates the DEFINE grant (the servicedef is a home-share record),
    // but was NEVER granted execute — the separation D5 draws.
    local2: {
      'servicedef diff': 'defined (replicated) — grant: define ONLY',
      'sandbox policy': 'diff-sbx:1 (replicated)',
    },
  },

  phases: [
    { id: 'SB1', label: 'Spawn under sandbox', summary: 'The instance is instantiated inside the D5 execution contract — read-only declared inputs, no ambient authority.' },
    { id: 'SB2', label: 'Undeclared access → typed error', summary: 'The program reaches for the network; the sandbox host returns a typed policy error and the attempt never touches ambient authority.' },
    { id: 'SB3', label: 'Define ≠ execute', summary: 'A node with only the define grant is refused execution — the two capabilities are distinct (GDL-016 resolved by D5).' },
  ],

  steps: [
    {
      state: 'C1', phase: 'SB1', kind: 'message', from: 'gryth1', to: 'local1', frame: 'SUBSCRIBE',
      label: 'subscribe: cross-source diff',
      payload: { share: 'svc', gladeId: 'ws.diff', key: '{left:(ws-razel, ws.tree), right:(ws-glade, ws.tree)}', shape: 'value' },
      note: 'An authorized viewer asks for the diff — triggering a G1/G2 instantiation of the compute.',
      docRef: `${DIFF} §2`,
      sets: { gryth1: { subs: 'svc/ws.diff' }, local1: { 'sub svc/ws.diff': 'gryth1' } },
    },
    {
      state: 'G2', phase: 'SB1', kind: 'internal', from: 'local1', frame: 'SPAWN',
      label: 'instantiate under sandbox diff-sbx:1',
      payload: { detail: { instance: 'diff#1', sandbox: 'diff-sbx:1', authority: 'define ✓ + execute ✓', contract: 'read-only declared inputs; no ambient fs/net/clock/rand/env/child-proc; bounded resources; typed timeout/resource/policy errors' } },
      gate: { kind: 'capability', label: 'execute authorization', status: 'enforced', note: 'D5: appending the DemandServiceDefinition is one grant; a DISTINCT grant authorizes a node to EXECUTE it. local1 holds both, so the instance may spawn. The sandbox-policy version rides the compute key, so a policy change forks a new instance rather than re-scoping a running one.' },
      note: 'The instance spawns inside the sandbox contract — a NEW versioned record, distinct from the legacy {app,name,glade_id} shape, composition-pinned until changed by signed governance.',
      docRef: `${DIFF} §2 (D5)`,
      sets: { 'svc-diff': { alive: 'yes', refs: '1 (gryth1)', sandbox: 'diff-sbx:1 (declared inputs only)', 'generation svc/ws.diff': 'gen 0 — pending' } },
    },
    {
      state: 'G4', phase: 'SB2', kind: 'internal', from: 'svc-diff', frame: 'PROVIDE',
      label: 'undeclared network fetch → TYPED policy error',
      payload: { share: 'svc', gladeId: 'ws.diff', detail: { attempt: 'connect(api.example.com:443) — NOT a declared input', outcome: 'PolicyError(net.egress-denied) — typed, bounded', ambient: 'NONE reached: the syscall never leaves the sandbox' } },
      gate: { kind: 'security', label: 'sandbox policy enforcement', status: 'enforced', note: 'D5: the program has no ambient filesystem, network, clock, randomness, environment, or child-process. An undeclared network attempt is a TYPED policy error (like an over-limit quota is data), not an exception and not a silent success — ambient authority is never reached.' },
      note: 'The failure is a value, not a breach. The diff program can only fold its two declared source snapshots; anything else is a typed refusal at the sandbox boundary.',
      docRef: `${DIFF} §2 (D5)`,
      sets: { 'svc-diff': { 'generation svc/ws.diff': 'gen — ERROR (sandbox: undeclared net denied)', 'sandbox-deny svc/ws.diff': 'net(api.example.com) — typed PolicyError, no ambient access' } },
    },
    {
      state: 'S3', phase: 'SB2', kind: 'message', from: 'local1', to: 'gryth1', frame: 'STATUS',
      label: 'error surfaced as typed data', response: true,
      payload: { share: 'svc', detail: { result: 'error', kind: 'sandbox-policy: undeclared network', generation: 'error (D4)', ambient: 'no side effect occurred' } },
      gate: { kind: 'security', label: 'enforcement cut', status: 'enforced', note: 'The D4 `error` generation state carries the D5 policy error to the UI as data — distinguishable from denied / stale / absent.' },
      note: 'The viewer sees a typed error, not a hang and not corrupted output. A misbehaving program degrades to an honest error value.',
      docRef: `${DIFF} §6 (D4 error) · §2 (D5)`,
      sets: { gryth1: { view: 'diff: ERROR — sandbox policy (network not declared)' } },
    },
    {
      state: 'G1', phase: 'SB3', kind: 'internal', from: 'local2', frame: 'ROUTE',
      label: 'local2 matches the servicedef (define grant present)',
      payload: { share: 'svc', detail: { match: 'DemandServiceDefinition(diff) — replicated record', has: 'grant: define', lacks: 'grant: execute' } },
      gate: { kind: 'routing', label: 'derived-binding routing', status: 'enforced', note: 'The definition is an ordinary home-share record, so every replica sees it. Matching it is routing; being ALLOWED to run it is a separate check.' },
      note: 'local2 can SEE and match the definition — the servicedef replicated to it — but seeing is not executing.',
      docRef: `${DIFF} §2/§4`,
      sets: { local2: { 'route svc/ws.diff': 'servicedef(diff) matched' } },
    },
    {
      state: 'S4', phase: 'SB3', kind: 'internal', from: 'local2', frame: 'ROUTE',
      label: 'execute check: define ≠ execute → DENY',
      payload: { share: 'svc', detail: { node: 'local2', check: 'holds grant:execute for diff?', verdict: 'DENY — define only', effect: 'no instance spawned' } },
      gate: { kind: 'capability', label: 'execute authorization', status: 'enforced', note: 'D5 resolves GDL-016: DEFINING a service and AUTHORIZING its execution are separate capabilities. local2 holds define (it has the record) but not execute, so it cannot instantiate — no ambient path around the missing grant.' },
      note: 'The negative arm of the D5 separation: a define-only node is refused execution. Who may declare a service and who may run it are distinct grants, checked distinctly.',
      docRef: `${DIFF} §2 (D5, GDL-016)`,
      sets: { local2: { 'denied execute diff': 'define grant only — execute not authorized' } },
    },
  ],
};

// ---------------------------------------------------------------------------
// s-diff-revoke-midstream — D3: a grant revoked BETWEEN compute and delivery
// denies the already-computed artifact. Re-evaluation per hop, no bypass.
// ---------------------------------------------------------------------------
export const S_DIFF_REVOKE_MIDSTREAM: Scenario = {
  id: 's-diff-revoke-midstream',
  stage: 2,
  title: 'Diff revoke mid-stream — the computed artifact is not a bypass',
  summary: 'The diff is computed and ready for gryth1; before it is delivered, gryth1’s read on a source is revoked. Re-evaluation at the delivery hop denies the already-computed artifact — and every replica hop re-checks its own fold.',

  actors: pick('gryth1', 'gryth2', 'local1', 'peer1', 'svc-diff'),

  initial: {
    gryth1: { session: 'local1 (open)', subs: 'svc/ws.diff (pending delivery)' },
    gryth2: { session: 'local1 (open)', role: 'owner of ws-glade' },
    local1: {
      services: 'diff#1 running',
      'session svc-diff': 'open (service)',
      'session gryth1': 'open',
      'session gryth2': 'open (owner)',
      'derived svc/ws.diff': DERIVED,
      'sub svc/ws.diff': 'gryth1',
      // At compute time gryth1 holds read on BOTH sources — the artifact is
      // legitimately computable for it. The revocation lands before delivery.
      'grant gryth1 svc': 'read.subscribe',
      'grant gryth1 ws-razel': 'read.subscribe',
      'grant gryth1 ws-glade': 'read.subscribe',
      'sub home': 'peer1 (mesh)',
      links: 'peer1 (iroh)',
    },
    peer1: {
      serving: 'ws-glade via grazel',
      'sub home': 'local1 (mesh)',
      'grant gryth1 ws-glade': 'read.subscribe (replicated)',
    },
    'svc-diff': { alive: 'yes', refs: '1 (gryth1)' },
  },

  phases: [
    { id: 'RV1', label: 'Computed, awaiting delivery', summary: 'The generation is ready for gryth1 — but not yet delivered.' },
    { id: 'RV2', label: 'Revoke lands first', summary: 'The source owner revokes gryth1’s read; the fold flips before the artifact ships.' },
    { id: 'RV3', label: 'Delivery re-evaluated → denied', summary: 'The already-computed artifact is withheld; every hop re-checks its own fold — no bypass.' },
  ],

  steps: [
    {
      state: 'G4', phase: 'RV1', kind: 'internal', from: 'svc-diff', frame: 'PROVIDE',
      label: 'compute ready for gryth1 (gen 1)',
      payload: { share: 'svc', gladeId: 'ws.diff', detail: { generation: 'gen 1 · ready', authorizedAtCompute: 'gryth1 read ws-razel ✓ + ws-glade ✓', result: '+12 −3 files' } },
      note: 'The instance folds both sources and holds a ready generation. gryth1 WAS authorized when this was computed — which is exactly why a computed artifact must not be trusted as a standing permission.',
      docRef: `${DIFF} §5/§6`,
      sets: { 'svc-diff': { 'generation svc/ws.diff': 'gen 1 (ready, undelivered)' } },
    },
    {
      state: 'J3', phase: 'RV2', kind: 'message', from: 'gryth2', to: 'local1', frame: 'APPEND',
      label: 'owner revokes gryth1’s read on the right source',
      payload: { share: 'home', detail: { op: 'CapabilityRevocation(gryth1 → ws-glade)', signedBy: 'ws-glade owner chain' } },
      note: 'Revocation is an ordinary signed op in the directory share — the same write path as any grant. It arrives after compute but before delivery.',
      docRef: `${WD} §2/§5`,
      sets: { gryth2: { 'origin log': '+CapabilityRevocation(gryth1 → ws-glade)' } },
    },
    {
      state: 'S2', phase: 'RV2', kind: 'internal', from: 'local1', frame: 'APPEND',
      label: 'fold flips: gryth1 loses read on ws-glade',
      payload: { share: 'home', detail: { fold: 'grant(gryth1, ws-glade) → REVOKED', rule: 'revocation-wins (tombstone precedence)' } },
      note: 'The grant key DELETES from local1’s fold. gryth1 can no longer read the right source — so, by INV-7, it can no longer read the diff, computed or not.',
      docRef: `${WD} §2 (fold semantics) · ${DIFF} §5`,
      sets: { local1: { 'grant gryth1 ws-glade': null, 'revoked gryth1': 'ws-glade' } },
    },
    {
      state: 'S4', phase: 'RV3', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 're-evaluate at delivery: right revoked → DENY',
      payload: { share: 'svc', detail: { principal: 'gryth1', left: 'ws-razel: read ✓', right: 'ws-glade: read ✗ (revoked)', artifact: 'gen 1 present + ready', verdict: 'DENY — withhold the computed artifact' } },
      gate: { kind: 'capability', label: 'per-hop re-evaluation', status: 'enforced', note: 'D3: the leak guard is re-run on every grant/membership change, and an ALREADY-COMPUTED artifact MUST NOT bypass a later denial. Enforcement re-evaluates at delivery, not only at subscribe time — the fact that gen 1 exists and is ready is irrelevant once the premise for reading it is gone.' },
      note: 'The load-bearing moment: the bytes are RIGHT THERE and that must not matter. Possession of a computed generation is not permission to deliver it.',
      docRef: `${DIFF} §5 (D3)`,
      sets: { local1: { 'generation svc/ws.diff': 'gen 1 — DENIED at delivery (source grant lapsed; artifact withheld)' } },
    },
    {
      state: 'S3', phase: 'RV3', kind: 'message', from: 'local1', to: 'gryth1', frame: 'STATUS',
      label: 'delivery denied — artifact withheld', response: true,
      payload: { share: 'svc', detail: { result: 'denied', reason: 'read on source ws-glade revoked before delivery', generation: 'gen 1 withheld (never delivered)' } },
      gate: { kind: 'security', label: 'enforcement cut', status: 'enforced', note: 'The subscribe resolves to a denial, not the pending artifact. The generation was ready; the authority was not.' },
      note: 'gryth1 never receives the computed diff. No OPS is ever emitted to it — so there is nothing for the leak guard to have laundered.',
      docRef: `${DIFF} §5`,
      sets: { gryth1: { subs: null, view: 'diff: ACCESS DENIED (right source revoked mid-compute)' } },
    },
    {
      state: 'B9', phase: 'RV3', kind: 'message', from: 'local1', to: 'peer1', frame: 'OPS',
      label: 'revocation replicates to the peer',
      payload: { share: 'home', detail: { ops: 'CapabilityRevocation(gryth1 → ws-glade)' } },
      note: 'The revocation op reaches the source-hosting peer the way all ops do — home-share replication, node-trust.',
      docRef: `${WD} §2`,
    },
    {
      state: 'S2', phase: 'RV3', kind: 'internal', from: 'peer1', frame: 'APPEND',
      label: 'peer re-evaluates from its OWN fold',
      payload: { share: 'home', detail: { fold: 'grant(gryth1, ws-glade) → REVOKED here too', effect: 'a direct gryth1 read of ws-glade at peer1 would now be refused HERE' } },
      note: 'Re-evaluation per hop, no single bouncer to route around: peer1 enforces from its own replicated fold. If the diff instance re-subscribed the right source through peer1 for gryth1, that hop would deny too.',
      docRef: `${DIFF} §5 (D3) · ${WD} §2`,
      sets: { peer1: { 'grant gryth1 ws-glade': null, 'revoked gryth1': 'ws-glade' } },
    },
  ],
};
