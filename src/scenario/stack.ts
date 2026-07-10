// Stage 3 — the stack page: grip · glial · glade composition (GDL-035).
// Actors are LAYERS, steps are the client lifecycle: declare → bind → write →
// persist → hydrate → (mount lights connectivity) → assemble → rich event →
// incremental apply. Persistence first; glade optional; assembly inside glial.
import type { Scenario } from './types';
import { pick } from './actors';

const GCR = 'GlialClientRuntime';
const GDS = 'GladeDeclSurface';
const SUB_V1 = 'GladeSubstrateV1';

export const S_STACK_LOCAL: Scenario = {
  id: 's-stack-local',
  stage: 3,
  title: 'Stack: local-only — persistence without glade',
  summary: 'A tap declares, glial binds a store destination, writes persist, a reload hydrates — and no glade exists anywhere. The OLD glial identity, kept and promoted.',

  actors: pick('ui-comp', 'tap1', 'glial-rt'),

  phases: [
    { id: 'SL1', label: 'Declare + bind', summary: 'glade-decl types; glial attaches the local store — the only destination.' },
    { id: 'SL2', label: 'Write + persist', summary: 'Thin tap, glial-owned store.' },
    { id: 'SL3', label: 'Reload + hydrate', summary: 'The browser is a first-class replica of itself.' },
  ],

  steps: [
    {
      state: 'L1', phase: 'SL1', kind: 'message', from: 'tap1', to: 'glial-rt', frame: 'DECLARE',
      label: 'binding declared',
      payload: { gladeId: 'notes.body', shape: 'log', detail: { decl: 'BindingDecl{notes.body, log, authority: share, retention: from-cursor}', types: 'glade-decl — the shared leaf module' } },
      note: 'The tap declares and is DONE — no assembly, no persistence, no sharing code in tap-land, ever.',
      docRef: `${GDS} · GDL-035`,
      sets: { 'glial-rt': { 'binding notes.body': 'declared' } },
    },
    {
      state: 'L2', phase: 'SL1', kind: 'internal', from: 'glial-rt', frame: 'BIND',
      label: 'glial binds: store only',
      payload: { detail: { destinations: 'local store (IndexedDB) — ALWAYS', glade: 'NOT CONFIGURED — and nothing anywhere needs it' } },
      note: 'Persistence first, connectivity configured: a grip app persists with zero glade. This is the rule that keeps the rapid-dev constraint honest.',
      docRef: `${GCR} (rule 1) · RapidDevEnvironment`,
      sets: { 'glial-rt': { 'binding notes.body': 'bound: store-only' } },
    },
    {
      state: 'L3', phase: 'SL2', kind: 'message', from: 'ui-comp', to: 'tap1', frame: 'APPEND',
      label: 'user types',
      payload: { gladeId: 'notes.body', detail: { edit: 'append line: "- lock the admin story"' } },
      note: 'The component writes through the tap, knowing nothing else.',
      sets: { 'ui-comp': { cursor: 'line 4, col 24' } },
    },
    {
      state: 'J3', phase: 'SL2', kind: 'message', from: 'tap1', to: 'glial-rt', frame: 'APPEND',
      label: 'conduit forwards',
      payload: { gladeId: 'notes.body', detail: { op: 'patch op (origin: this session)' } },
      note: 'Thin means thin: attributed change out, nothing retained.',
      sets: { 'glial-rt': { 'origin log': '+1 op (notes.body)' } },
    },
    {
      state: 'L4', phase: 'SL2', kind: 'internal', from: 'glial-rt', frame: 'PERSIST',
      label: 'persisted locally',
      payload: { detail: { store: 'IndexedDB: origin log + cached fold', durability: 'survives tab death, reboot, and the absence of any server on earth' } },
      note: 'Glial owns the client store — the OLD glial, kept.',
      docRef: `${GCR} · ${SUB_V1} §5 (persistence = degenerate share)`,
      sets: { 'glial-rt': { store: 'notes.body: 41 ops + fold (persisted)' } },
    },
    {
      state: 'L5', phase: 'SL3', kind: 'internal', from: 'glial-rt', frame: 'HYDRATE',
      label: '…later: browser restarts — hydrate',
      payload: { detail: { load: 'cached fold + tail from the local destination', cost: 'no network — none was ever configured' } },
      note: 'Hydration is the same operation a remote replica performs; the browser is simply a replica of itself.',
      docRef: `${SUB_V1} §5`,
      sets: { 'glial-rt': { 'binding notes.body': 'hydrated (fold @ seq 41)' } },
    },
    {
      state: 'L6', phase: 'SL3', kind: 'message', from: 'glial-rt', to: 'tap1', frame: 'EVENT',
      label: 'refresh event',
      payload: { gladeId: 'notes.body', detail: { kind: 'refresh', value: 'whole assembled body', baseSeq: '41' } },
      note: 'On hydrate there is no live UI state to preserve — whole-value refresh is the right choice, and the envelope carries it.',
      docRef: `${GCR} (event envelope)`,
    },
    {
      state: 'L6', phase: 'SL3', kind: 'message', from: 'tap1', to: 'ui-comp', frame: 'EVENT',
      label: 'event reaches the component',
      payload: { gladeId: 'notes.body', detail: { kind: 'refresh' } },
      note: 'The tap fans the envelope; consumers decide.',
    },
    {
      state: 'L7', phase: 'SL3', kind: 'internal', from: 'ui-comp', frame: 'EVENT',
      label: 'render from refresh',
      payload: { detail: { choice: 'refresh (no cursor active — field not focused)' } },
      note: 'The consumer chose whole-field against its live UI state. Next trace: the other choice.',
      docRef: `${GCR} (rule 3)`,
      sets: { 'ui-comp': { view: 'notes.body rendered (41 ops, zero network)' } },
    },
  ],
};

export const S_STACK_CONNECT: Scenario = {
  id: 's-stack-connect',
  stage: 3,
  title: 'Stack: mount lights connectivity — rich events, cursor intact',
  summary: 'A workspace mount adds a glade destination to the SAME binding; remote ops assemble inside glial and reach the editor as a delta the consumer applies without losing its cursor.',

  actors: pick('ui-comp', 'tap1', 'glial-rt', 'gsession', 'local1'),

  initial: {
    'ui-comp': { cursor: 'EDITING line 2 (field focused)' },
    'glial-rt': { 'binding notes.body': 'bound: store-only', store: 'notes.body: 41 ops + fold' },
    gsession: { 'sub app/notes.body': 'glial-rt (event fan)' },
    local1: { 'replica app': 'notes.body ops from other devices' },
  },

  phases: [
    { id: 'SC1', label: 'Mount lights connectivity', summary: 'Config-as-data adds a destination; the consumer is untouched — the glial composition seam.' },
    { id: 'SC2', label: 'Remote in — rich event', summary: 'Assembly inside glial; the editor gets a delta and keeps its cursor.' },
    { id: 'SC3', label: 'Local out — both destinations', summary: 'One write persists locally AND ships to the mesh.' },
  ],

  steps: [
    {
      state: 'L2', phase: 'SC1', kind: 'internal', from: 'glial-rt', frame: 'BIND', variant: 'a',
      variantNote: 'The bind GAINS a glade destination: a workspace mount (glial orchestration, config-as-data) configured connectivity for this binding — no tap or component changed.',
      label: 'mount adds the glade destination',
      payload: { detail: { config: 'workspace mount → session for share "app"', destinations: 'store (always) + glade session (now)' } },
      note: 'THE composition story: environments/mounts are glial’s orchestration half; a mount is exactly the config that turns connectivity on.',
      docRef: `${GCR} · GlialOrchestration · GDL-035`,
      sets: { 'glial-rt': { 'binding notes.body': 'bound: store + glade(session)' } },
    },
    {
      state: 'A1', phase: 'SC1', kind: 'message', from: 'gsession', to: 'local1', frame: 'HELLO',
      label: 'glial-managed session opens',
      payload: { detail: { session: 'sess-app1', managed: 'by glial’s session manager' } },
      gate: { kind: 'security', label: 'HELLO principal seam', status: 'stub-allow-all', note: 'Stage-3 traces run the substrate posture; the stage-2 gates apply unchanged when enforced.' },
      note: 'Sessions belong to glial’s connectivity half — taps never see them.',
      docRef: `${SUB_V1} §11`,
      sets: { local1: { 'session gsession': 'open' } },
    },
    {
      state: 'C1', phase: 'SC1', kind: 'message', from: 'gsession', to: 'local1', frame: 'SUBSCRIBE',
      label: 'subscribe the binding',
      payload: { share: 'app', gladeId: 'notes.body', key: '∅', shape: 'log' },
      note: 'The BindingDecl’s glade id is the wire’s glade id — glade-decl is the shared vocabulary end to end.',
      docRef: `${GDS}`,
      sets: { local1: { 'sub app/notes.body': 'gsession' } },
    },
    {
      state: 'A5', phase: 'SC2', kind: 'message', from: 'local1', to: 'gsession', frame: 'OPS',
      label: 'remote history arrives', response: true,
      payload: { share: 'app', gladeId: 'notes.body', shape: 'log', detail: { ops: '2 patch ops (origin: another device)' } },
      note: 'Someone edited these notes elsewhere while this browser was store-only.',
    },
    {
      state: 'B9', phase: 'SC2', kind: 'message', from: 'gsession', to: 'glial-rt', frame: 'OPS',
      label: 'session delivers to glial',
      payload: { share: 'app', gladeId: 'notes.body', detail: { ops: '2 patch ops' } },
      note: 'The session is a destination adapter; glial is where the ops become meaning.',
      sets: { 'glial-rt': { 'origin log': '41 local + 2 remote ops' } },
    },
    {
      state: 'A4', phase: 'SC2', kind: 'internal', from: 'glial-rt', frame: 'FOLD',
      label: 'ASSEMBLY INSIDE GLIAL',
      payload: { detail: { engine: 'taut-shape log engine + reassembler', output: 'assembled body + delta vs baseSeq 41' } },
      note: 'Rule 2: shape engines run once per binding, in glial — not in taps, not in components. The reassembler (§7) lives here.',
      docRef: `${GCR} (rule 2) · ${SUB_V1} §7`,
      sets: { 'glial-rt': { 'fold notes.body': 'seq 43 (delta ready)' } },
    },
    {
      state: 'L6', phase: 'SC2', kind: 'message', from: 'glial-rt', to: 'tap1', frame: 'EVENT',
      label: 'rich event: DELTA',
      payload: { gladeId: 'notes.body', detail: { kind: 'delta', baseSeq: '41', delta: '2 patches (lines 7–9)', value: 'available on demand' } },
      note: 'The envelope carries BOTH affordances — the receiver chooses against live UI state.',
      docRef: `${GCR} (event envelope)`,
    },
    {
      state: 'L6', phase: 'SC2', kind: 'message', from: 'tap1', to: 'ui-comp', frame: 'EVENT',
      label: 'fan to the editor',
      payload: { gladeId: 'notes.body', detail: { kind: 'delta' } },
      note: 'Thin conduit, unchanged since the local-only trace.',
    },
    {
      state: 'L7', phase: 'SC2', kind: 'internal', from: 'ui-comp', frame: 'EVENT',
      label: 'delta applied — CURSOR INTACT',
      payload: { detail: { choice: 'DELTA (field is focused, cursor live at line 2)', apply: 'patches land at lines 7–9; no field rewrite', future: 'text-crdt shape: cursor anchors to element identity, not offsets' } },
      note: 'The multi-line answer: the field is never rewritten, so the cursor never moves. Position identity (shape_text_crdt, consolidation P4) makes this exact even under concurrent edits at the cursor line.',
      docRef: `${GCR} · TautShapeGladeConsolidation P4`,
      sets: { 'ui-comp': { view: 'notes.body @43 (remote lines visible)', cursor: 'EDITING line 2 — unmoved' } },
    },
    {
      state: 'L3', phase: 'SC3', kind: 'message', from: 'ui-comp', to: 'tap1', frame: 'APPEND',
      label: 'local edit continues',
      payload: { gladeId: 'notes.body', detail: { edit: 'finish line 2' } },
      note: 'Same write path as store-only — the consumer cannot tell connectivity exists.',
    },
    {
      state: 'J3', phase: 'SC3', kind: 'message', from: 'tap1', to: 'glial-rt', frame: 'APPEND',
      label: 'conduit forwards',
      payload: { gladeId: 'notes.body', detail: { op: 'patch op seq 44' } },
      note: 'Thin, still.',
    },
    {
      state: 'L4', phase: 'SC3', kind: 'internal', from: 'glial-rt', frame: 'PERSIST',
      label: 'persist AND enqueue',
      payload: { detail: { store: 'IndexedDB (always, first)', queue: 'glade session (because configured)' } },
      note: 'Both destinations, one write — offline-first falls out because the store never waited for the network.',
      docRef: `${GCR} (rule 1) · ${SUB_V1} §5`,
      sets: { 'glial-rt': { store: 'notes.body: 44 ops + fold (persisted)' } },
    },
    {
      state: 'J3', phase: 'SC3', kind: 'message', from: 'glial-rt', to: 'gsession', frame: 'APPEND',
      label: 'ship to the session',
      payload: { gladeId: 'notes.body', detail: { op: 'seq 44' } },
      note: 'Glial hands the session an attributed op; the session owns the wire from here.',
    },
    {
      state: 'J3', phase: 'SC3', kind: 'message', from: 'gsession', to: 'local1', frame: 'APPEND',
      label: 'onto the mesh',
      payload: { share: 'app', gladeId: 'notes.body', detail: { op: 'seq 44 (origin: this session)' } },
      note: 'From here it is every earlier trace: fan-out, replication, grants, placement — the whole atlas applies to this one keystroke.',
      sets: { local1: { 'replica app': 'notes.body +1 op (fanning out)' } },
    },
  ],
};

// Stage 3 — declarations vs instances (GlialClientRuntime §Boundaries, clarified
// 2026-07-10). ONE app-static BindingDecl, several live instances: each mount is
// (decl, domain fill) with its OWN fold + refcounted lifecycle. Two columns on
// two documents run side by side; a third consumer of one fill attaches to the
// LIVE instance (refcount++, no new fold); unmounting one column tears down only
// its instance — the sibling is untouched. The seam is mount/unmount, idiom-
// agnostic: how grip selects/parameterizes an instance never crosses into glial.
export const S_STACK_MULTI: Scenario = {
  id: 's-stack-multi',
  stage: 3,
  title: 'Stack: one decl, many instances — refcounted, isolated',
  summary: 'A single BindingDecl, two live instances on two documents (each its own fold), a third consumer attaching to an existing instance (refcount, no new fold), and an unmount that tears down only its own instance.',

  actors: pick('ui-comp', 'ui-comp2', 'ui-comp3', 'tap1', 'glial-rt'),

  phases: [
    { id: 'MU1', label: 'One decl, two instances', summary: 'The decl is app-static; each mount is an instance with its own fold — two documents, side by side.' },
    { id: 'MU2', label: 'Attach — refcount, no new fold', summary: 'A third consumer of the same fill attaches to the live instance; the assembled fold is fanned, never rebuilt.' },
    { id: 'MU3', label: 'Unmount — isolated teardown', summary: 'Refcount to zero tears down one instance; its sibling is unaffected.' },
  ],

  steps: [
    {
      state: 'L1', phase: 'MU1', kind: 'message', from: 'tap1', to: 'glial-rt', frame: 'DECLARE',
      label: 'the ONE binding declared',
      payload: { gladeId: 'notes.column', shape: 'log', detail: { decl: 'BindingDecl{notes.column, log, domain: document}', scope: 'app-static — declared once, mounted many times' } },
      note: 'The decl is a template, not an instance. It carries the domain ANCHOR (document); the concrete document is supplied per mount.',
      docRef: `${GDS} (BindingDecl row) · GlialClientRuntime §Boundaries`,
      sets: { 'glial-rt': { 'decl notes.column': 'declared (app-static)' } },
    },
    {
      state: 'L8', phase: 'MU1', kind: 'internal', from: 'glial-rt', frame: 'BIND',
      label: 'mount instance A — fill doc-1',
      payload: { detail: { instance: '(notes.column, document=doc-1)', refcount: '1 (ui-comp)', destinations: 'own local store + own fold' } },
      note: 'The mount fills the decl with doc-1 and creates a binding INSTANCE: refcount 1, its own store destination and fold state. Nothing about how grip picked doc-1 crosses this seam.',
      docRef: `${GCR} §Boundaries (declarations vs instances)`,
      sets: { 'glial-rt': { 'inst notes.column@doc-1': 'mounted · refcount 1 (ui-comp)', 'fold @doc-1': 'own state (empty)' } },
    },
    {
      state: 'L3', phase: 'MU1', kind: 'message', from: 'ui-comp', to: 'tap1', frame: 'APPEND',
      label: 'user types in column A (doc-1)',
      payload: { gladeId: 'notes.column', detail: { fill: 'doc-1', edit: 'append: "- ship the multi trace"' } },
      note: 'The component writes through the tap for its own fill; it never names an instance or a fold.',
    },
    {
      state: 'J3', phase: 'MU1', kind: 'message', from: 'tap1', to: 'glial-rt', frame: 'APPEND',
      label: 'conduit forwards (fill doc-1)',
      payload: { gladeId: 'notes.column', detail: { fill: 'doc-1', op: 'patch op (origin: this session)' } },
      note: 'The thin tap routes the write to instance A by its fill — the only thing that crosses is the decl + the fill.',
      sets: { 'glial-rt': { 'origin log @doc-1': '+1 op' } },
    },
    {
      state: 'L4', phase: 'MU1', kind: 'internal', from: 'glial-rt', frame: 'PERSIST',
      label: 'persist + fold instance A',
      payload: { detail: { store: 'doc-1 store: 1 op', fold: 'assembled @seq 1' } },
      note: 'Assembly runs once per instance, inside glial. Instance A now has a live fold.',
      docRef: `${GCR} (rule 2)`,
      sets: { 'glial-rt': { 'fold @doc-1': 'assembled @seq 1' } },
    },
    {
      state: 'L8', phase: 'MU1', kind: 'internal', from: 'glial-rt', frame: 'BIND',
      label: 'mount instance B — fill doc-2',
      payload: { detail: { instance: '(notes.column, document=doc-2)', refcount: '1 (ui-comp2)', destinations: 'a SEPARATE store + fold' } },
      note: 'Same decl, same grips, different fill — a second, fully independent instance. Two instances of one declaration are live at once.',
      docRef: `${GCR} §Boundaries (declarations vs instances)`,
      sets: { 'glial-rt': { 'inst notes.column@doc-2': 'mounted · refcount 1 (ui-comp2)', 'fold @doc-2': 'own state (empty)' } },
    },
    {
      state: 'L3', phase: 'MU1', kind: 'message', from: 'ui-comp2', to: 'tap1', frame: 'APPEND',
      label: 'user types in column B (doc-2)',
      payload: { gladeId: 'notes.column', detail: { fill: 'doc-2', edit: 'append: "- doc-2 is its own world"' } },
      note: 'A different document, a different instance — the same component code.',
    },
    {
      state: 'J3', phase: 'MU1', kind: 'message', from: 'tap1', to: 'glial-rt', frame: 'APPEND',
      label: 'conduit forwards (fill doc-2)',
      payload: { gladeId: 'notes.column', detail: { fill: 'doc-2', op: 'patch op (origin: this session)' } },
      note: 'Routed to instance B by its fill; instance A never sees this op.',
      sets: { 'glial-rt': { 'origin log @doc-2': '+1 op' } },
    },
    {
      state: 'L4', phase: 'MU1', kind: 'internal', from: 'glial-rt', frame: 'PERSIST',
      label: 'persist + fold instance B — independent',
      payload: { detail: { store: 'doc-2 store: 1 op', fold: 'assembled @seq 1 (disjoint from doc-1)' } },
      note: 'Instance B folds its OWN ops. The two folds share nothing but the decl — separate assembly state is the whole point.',
      docRef: `${GCR} (rule 2)`,
      sets: { 'glial-rt': { 'fold @doc-2': 'assembled @seq 1 (independent of doc-1)' } },
    },
    {
      state: 'L9', phase: 'MU2', kind: 'internal', from: 'glial-rt', frame: 'BIND',
      label: 'column A2 (doc-1 again) attaches to the live instance',
      payload: { detail: { instance: '(notes.column, document=doc-1)', refcount: '1 → 2 (ui-comp, ui-comp3)', fold: 'REUSED — no new fold, no new store' } },
      note: 'A third consumer mounts the SAME fill (doc-1). Glial finds the live instance and bumps its refcount — client-side interest counting (s-fanout). It does NOT build a second fold.',
      docRef: `${GCR} §Boundaries · s-fanout (interest counting)`,
      sets: { 'glial-rt': { 'inst notes.column@doc-1': 'mounted · refcount 2 (ui-comp, ui-comp3)' } },
    },
    {
      state: 'L6', phase: 'MU2', kind: 'message', from: 'glial-rt', to: 'ui-comp3', frame: 'EVENT',
      label: 'refresh from the EXISTING fold',
      payload: { gladeId: 'notes.column', detail: { kind: 'refresh', value: 'instance A’s assembled body', baseSeq: '1', recompute: 'none — the live fold was fanned' } },
      note: 'The newly attached consumer gets a refresh off instance A’s current assembly. The fold was fanned, not rebuilt — attaching is free of assembly cost.',
      docRef: `${GCR} (event envelope · rule 3)`,
    },
    {
      state: 'L10', phase: 'MU3', kind: 'internal', from: 'glial-rt', frame: 'TEARDOWN',
      label: 'column A2 unmounts — instance A retained',
      payload: { detail: { instance: '(notes.column, document=doc-1)', refcount: '2 → 1 (ui-comp)', retained: 'fold + store stay — a consumer remains' } },
      note: 'Unmount drops one attachment and decrements the refcount. Instance A is still live because column A holds it.',
      docRef: `${GCR} §Boundaries (refcounted lifecycle)`,
      sets: { 'glial-rt': { 'inst notes.column@doc-1': 'mounted · refcount 1 (ui-comp)' } },
    },
    {
      state: 'L10', phase: 'MU3', kind: 'internal', from: 'glial-rt', frame: 'TEARDOWN',
      label: 'column B unmounts doc-2 — refcount to zero',
      payload: { detail: { instance: '(notes.column, document=doc-2)', refcount: '1 → 0', next: 'no consumer remains — teardown' } },
      note: 'The last consumer of instance B unmounts. Its refcount hits zero, which triggers teardown of THAT instance only.',
      docRef: `${GCR} §Boundaries (refcounted lifecycle)`,
      sets: { 'glial-rt': { 'inst notes.column@doc-2': 'refcount 0 — draining' } },
    },
    {
      state: 'L11', phase: 'MU3', kind: 'internal', from: 'glial-rt', frame: 'TEARDOWN',
      label: 'instance B torn down — A unaffected',
      payload: { detail: { released: 'doc-2 fold + store destination', unaffected: 'instance A (doc-1) still mounted @ refcount 1' } },
      note: 'Teardown is per-instance: instance B’s fold and store are released; instance A — a different fill of the same decl — keeps running. Declarations are shared; instances are isolated.',
      docRef: `${GCR} §Boundaries (declarations vs instances)`,
      sets: { 'glial-rt': { 'inst notes.column@doc-2': null, 'fold @doc-2': null, 'origin log @doc-2': null } },
    },
  ],
};
