// glade-editing — collaborative editing over glade (H-P4 text CRDT), stage 1.
//
// The ruled core (glade-editing §1, RulingWorksheet §V H-P4): `doc.body` is a
// first-class `text-crdt` Shape. There is NO single-writer fence and NO
// EditClaim/lease (§5 drops it entirely) — membership says who MAY edit; the
// CRDT says how concurrent writes converge, and ALL members write at once.
// The protocol names first-class identities + operations, never a diff blob:
//   · element IDs are {actor_id, counter} (Lamport-style) carrying causal deps;
//   · insert names an anchor + the new element id; delete names element ids and
//     creates TOMBSTONES (elements never leave — a concurrent reference stays
//     valid); duplicate op replay is IDEMPOTENT (dedup by element id);
//   · concurrent siblings at one anchor take a DETERMINISTIC order (tie-break on
//     {actor_id, counter}), so every replica converges regardless of order.
// Cursors (§2) are `{element_id, affinity}` anchors in a private `self:` zone
// (B4, derived from the authenticated principal) — a remote insert/delete NEVER
// moves your caret because the identity the merge uses is the identity the cursor
// rides. The delta path (§3) is the SHARED glial primitive: identity-based,
// applied by set-diff against what the consumer already holds (glial's A1 logDelta
// fix) — duplicate/reordered arrivals converge, no dup/drop. Save (§4) is D12
// compare-and-replace delegated to files.write against the recorded base revision;
// conflict is explicit (D13 at-rest truth). Compaction (§1.3) drops only what
// every actor provably acknowledged past the compacted frontier.
//
// Stage note (§7): "stage-1 = allow-all" is retired — attribution is real from
// day one (B1–B5), so the HELLO/self seams here are `designed`, not stub-allow-all.
//
// Modeling notes (contract-forced, reported in vocabDeviations):
//  · The TS `Shape` enum has no `text-crdt` member (the ruling promotes it, but
//    types.ts is out of scope here) — the CRDT op set rides `shape:'log'` (it IS
//    an append-only op log that folds to text); text-crdt semantics live in detail.
//  · No editing/doc supplier actor exists in the POOL (out of scope to add) — like
//    s-chat, `doc.body` is a keyed COMMONS the client appends into and the node
//    folds + replicates (§6 "the supplier is thin"); `doc.save` routes to the
//    workspace-host provider (peer1/grazel) for the D12 files.write/replace.
import type { Scenario } from './types';
import { pick } from './actors';

const GE = 'glade-editing';
const SM = 'GladeSupplierModel';
const GC = 'GlialClientRuntime';
const GZ = 'GladeZones';

// ---------------------------------------------------------------------------
// s-edit-crdt — two editors insert concurrently at one anchor + a tombstone
// delete converge (deterministic sibling order); a duplicate op replay is a
// no-op (the idempotence deny arm). Proves the element-id/anchor/tombstone
// model (H-P4 §1.2), forces the P4.S1 taut-shape contract.
// ---------------------------------------------------------------------------
export const S_EDIT_CRDT: Scenario = {
  id: 's-edit-crdt',
  stage: 1,
  title: 'CRDT body — concurrent edits converge, deterministically',
  summary:
    'dana and evan type into ONE doc.body simultaneously from two machines: both insert at the same anchor (element ids {gryth1,1} and {gryth3,1}), the merge orders the concurrent siblings deterministically by {actor_id,counter} so both replicas fold to identical text, a delete leaves a TOMBSTONE (the element never leaves), and a duplicate op replay is a no-op (dedup by element id) — no lost writes.',

  actors: pick('gryth1', 'gryth3', 'local1', 'local2'),

  initial: {
    local1: {
      'crdt doc.body/e0': 'live · "" (document head anchor)',
      links: 'local2 (iroh mesh)',
    },
    local2: {
      'crdt doc.body/e0': 'live · "" (document head anchor)',
      links: 'local1 (iroh mesh)',
    },
  },

  phases: [
    { id: 'EA', label: 'Two editors, one commons body', summary: 'Two principals open sessions on two nodes and subscribe the same doc.body keyed commons — membership is the only entry gate (no lease, §5).' },
    { id: 'EI', label: 'Concurrent inserts at one anchor', summary: 'Both insert after the SAME head anchor e0, each allocating an element id {actor_id,counter} — neither saw the other.' },
    { id: 'EM', label: 'Merge — deterministic sibling order', summary: 'Ops cross via anti-entropy; both folds order the concurrent siblings by {actor_id,counter} and converge to identical text.' },
    { id: 'ED', label: 'Tombstone delete', summary: 'A delete names an element id and marks it dead — the element is retained so a concurrent reference stays valid; no lost writes.' },
    { id: 'EX', label: 'Duplicate replay is a no-op', summary: 'Re-delivering an op the fold already holds dedups by element id — idempotent, no double, no resurrection.' },
  ],

  steps: [
    // ---- Phase EA: sessions + interest -----------------------------------
    {
      state: 'A1', phase: 'EA', kind: 'message', from: 'gryth1', to: 'local1', frame: 'HELLO',
      label: 'dana’s editing session opens',
      payload: { detail: { session: 'sess-dana', principal: 'dana — fp:9c2e', selfDerivation: 'the node derives self:dana from the authenticated principal (B4) — the caller never spells it' } },
      gate: { kind: 'security', label: 'HELLO principal seam (B1–B5)', status: 'designed', note: 'Stage-1 editing is NOT allow-all (§7): the session authenticates and its principal is bound at HELLO, so attribution on every element op is real from day one. self: keys are DERIVED from this principal (B4), never caller-spelled.' },
      note: 'The principal IS the key; its fingerprint stamps every element op dana authors. The self-zone selection key self:dana is derived here (B4), not asserted by the client.',
      docRef: `${GE} §1.2 · §2 (B4) · §7`,
      sets: { local1: { 'session gryth1': 'open (dana)', 'selfkey self:dana': 'gryth1 bound — fp:9c2e' } },
    },
    {
      state: 'C1', phase: 'EA', kind: 'message', from: 'gryth1', to: 'local1', frame: 'SUBSCRIBE',
      label: 'dana subscribes doc.body',
      payload: { share: 'ws-razel', gladeId: 'doc.body', key: '{path:plan.md} (commons)', shape: 'log' },
      note: 'doc.body is a keyed COMMONS (one world for all members, §6). Subscribing is the whole opt-in — no write-lease, no owner, no pen (§5: the lease machinery is dropped).',
      docRef: `${GE} §5 · §6 · ${GZ} · keyed commons`,
      sets: { gryth1: { subs: 'ws-razel/doc.body{plan.md}' }, local1: { 'sub ws-razel/doc.body{plan.md}': 'gryth1' } },
    },
    {
      state: 'A1', phase: 'EA', kind: 'message', from: 'gryth3', to: 'local2', frame: 'HELLO',
      label: 'evan’s editing session opens (another machine)',
      payload: { detail: { session: 'sess-evan', principal: 'evan — fp:7b31', posture: 'a DIFFERENT principal on a second node' } },
      gate: { kind: 'security', label: 'HELLO principal seam (B1–B5)', status: 'designed', note: 'A second, distinct principal (fp:7b31 ≠ fp:9c2e). Membership grants entry; concurrency is the CRDT’s job, not a fence (§5).' },
      note: 'evan is a distinct principal. Both are members of the doc’s commons — that is the whole authorization to edit (§5: who-may-edit = share membership, full stop).',
      docRef: `${GE} §1.2 · §5`,
      sets: { local2: { 'session gryth3': 'open (evan)', 'selfkey self:evan': 'gryth3 bound — fp:7b31' } },
    },
    {
      state: 'C1', phase: 'EA', kind: 'message', from: 'gryth3', to: 'local2', frame: 'SUBSCRIBE',
      label: 'evan subscribes doc.body (same key)',
      payload: { share: 'ws-razel', gladeId: 'doc.body', key: '{path:plan.md} (commons)', shape: 'log' },
      note: 'Same surface, same key: dana and evan converge on the one shared body. A commons key is shared by every member.',
      docRef: `${GZ} · keyed commons`,
      sets: { gryth3: { subs: 'ws-razel/doc.body{plan.md}' }, local2: { 'sub ws-razel/doc.body{plan.md}': 'gryth3' } },
    },

    // ---- Phase EI: concurrent inserts at one anchor -----------------------
    {
      state: 'J1', phase: 'EI', kind: 'internal', from: 'gryth1', frame: 'APPEND',
      label: 'dana inserts "H" after the head',
      payload: { share: 'ws-razel', gladeId: 'doc.body', detail: { op: 'insert(element {gryth1,1}, anchor: e0, content: "H")', id: 'element id {actor_id,counter} = {gryth1,1}', deps: 'causal deps = {e0}', mechanism: 'not a diff blob — a named insert op (§1.2)' } },
      note: 'The insert names an ANCHOR (e0) plus a new element id {gryth1,1} carrying its causal dependencies. The write path is local + unconditional; the network is never on it.',
      docRef: `${GE} §1.2`,
      sets: { gryth1: { 'origin log': '+insert {gryth1,1} @e0 "H"' } },
    },
    {
      state: 'J3', phase: 'EI', kind: 'message', from: 'gryth1', to: 'local1', frame: 'APPEND',
      label: 'dana’s insert reaches the node',
      payload: { share: 'ws-razel', gladeId: 'doc.body', detail: { op: 'insert {gryth1,1} @e0 "H" (origin: dana)' } },
      note: 'gryth1↔local1 is the same machine; the element op parks in the local replica and will fan out. The node folds + replicates — the supplier is out of the body hot path (§6).',
      docRef: `${SM} §2 (op-append)`,
      sets: { local1: { 'crdt doc.body/gryth1:1': 'live · "H"' } },
    },
    {
      state: 'J1', phase: 'EI', kind: 'internal', from: 'gryth3', frame: 'APPEND',
      label: 'evan CONCURRENTLY inserts "W" at the same anchor',
      payload: { share: 'ws-razel', gladeId: 'doc.body', detail: { op: 'insert(element {gryth3,1}, anchor: e0, content: "W")', concurrency: 'evan has NOT seen {gryth1,1} — both name the SAME anchor e0 (a concurrent sibling pair)', deps: 'causal deps = {e0}' } },
      note: 'Simultaneous keystroke: evan inserts after the SAME head anchor e0, allocating {gryth3,1}. Two concurrent siblings now hang off one anchor — exactly the case a write-fence cannot handle and a CRDT does (H-P4).',
      docRef: `${GE} §1 · §1.2`,
      sets: { gryth3: { 'origin log': '+insert {gryth3,1} @e0 "W"' } },
    },
    {
      state: 'J3', phase: 'EI', kind: 'message', from: 'gryth3', to: 'local2', frame: 'APPEND',
      label: 'evan’s insert reaches its node',
      payload: { share: 'ws-razel', gladeId: 'doc.body', detail: { op: 'insert {gryth3,1} @e0 "W" (origin: evan)' } },
      note: 'evan’s op parks in local2’s replica. Neither node has the other’s op yet — divergence is transient and resolves by fold, never by coordination.',
      docRef: `${SM} §2`,
      sets: { local2: { 'crdt doc.body/gryth3:1': 'live · "W"' } },
    },

    // ---- Phase EM: merge — deterministic sibling order --------------------
    {
      state: 'B7', phase: 'EM', kind: 'message', from: 'local1', to: 'local2', frame: 'HEADS',
      label: 'heads reveal each side’s missing op',
      payload: { share: 'ws-razel', detail: { compare: 'local1 has {gryth1,1}; local2 has {gryth3,1}; version vectors differ on both origins' } },
      note: 'Anti-entropy starts from the version vector — it says exactly which element ops each side lacks, no diffing.',
      docRef: `${GE} §3 · SubstrateV1 §2 (GQ-9)`,
    },
    {
      state: 'B8', phase: 'EM', kind: 'message', from: 'local2', to: 'local1', frame: 'OPS',
      label: 'evan’s insert ships to local1', response: true,
      payload: { share: 'ws-razel', gladeId: 'doc.body', detail: { ops: 'insert {gryth3,1} @e0 "W"', note: 'heads-driven sync (B8), not a subscriber serve — replicas converge by folding the same op-set' } },
      note: 'The gap ships as anti-entropy. Applying it is set-union into the local element set — an identity-based delta (§3).',
      docRef: `${GE} §3`,
      sets: { local1: { 'crdt doc.body/gryth3:1': 'live · "W"' } },
    },
    {
      state: 'B8', phase: 'EM', kind: 'message', from: 'local1', to: 'local2', frame: 'OPS',
      label: 'dana’s insert ships to local2',
      payload: { share: 'ws-razel', gladeId: 'doc.body', detail: { ops: 'insert {gryth1,1} @e0 "H"' } },
      note: 'The reverse gap. Both replicas now hold the SAME element set {e0, {gryth1,1}, {gryth3,1}}.',
      docRef: `${GE} §3`,
      sets: { local2: { 'crdt doc.body/gryth1:1': 'live · "H"' } },
    },
    {
      state: 'A4', phase: 'EM', kind: 'internal', from: 'local1', frame: 'FOLD',
      label: 'fold orders the siblings deterministically',
      payload: { share: 'ws-razel', gladeId: 'doc.body', detail: { siblings: 'two elements at anchor e0: {gryth1,1} and {gryth3,1}', tieBreak: 'deterministic order on {actor_id,counter} → {gryth1,1} < {gryth3,1}', text: '"HW"', family: 'RGA/Yjs — resonant with glade’s set-union / lamport folds' } },
      note: 'The concurrent siblings take a DETERMINISTIC order (tie-break on {actor_id,counter}); every replica converges to the same text regardless of arrival order. No lost writes — both inserts are present.',
      docRef: `${GE} §1.2`,
      sets: { local1: { 'fold doc.body{plan.md}': '"HW" (siblings {gryth1,1} < {gryth3,1})' } },
    },
    {
      state: 'A4', phase: 'EM', kind: 'internal', from: 'local2', frame: 'FOLD',
      label: 'the other replica folds identically',
      payload: { share: 'ws-razel', gladeId: 'doc.body', detail: { arrivalOrder: 'local2 saw {gryth3,1} first, then {gryth1,1} — OPPOSITE order', result: '"HW" — identical', why: 'convergence is a property of the fold, not the order' } },
      note: 'Different arrival order, identical fold: the sibling tie-break is a total order on element ids, so both nodes render "HW". Sequence-independent convergence.',
      docRef: `${GE} §1.2`,
      sets: { local2: { 'fold doc.body{plan.md}': '"HW" (identical, opposite arrival order)' } },
    },
    {
      state: 'B9', phase: 'EM', kind: 'message', from: 'local1', to: 'gryth1', frame: 'OPS',
      label: 'merged text to dana', response: true,
      payload: { share: 'ws-razel', gladeId: 'doc.body', shape: 'log', detail: { text: '"HW"' } },
      note: 'dana’s UI folds the converged body. INV-2 holds: local1’s subscription table names gryth1 for doc.body{plan.md}.',
      sets: { gryth1: { view: 'plan.md = "HW"' } },
    },
    {
      state: 'B9', phase: 'EM', kind: 'message', from: 'local2', to: 'gryth3', frame: 'OPS',
      label: 'merged text to evan', response: true,
      payload: { share: 'ws-razel', gladeId: 'doc.body', shape: 'log', detail: { text: '"HW"' } },
      note: 'evan sees the same "HW". Two editors, one converged world — the whole point of the CRDT (§5).',
      sets: { gryth3: { view: 'plan.md = "HW"' } },
    },

    // ---- Phase ED: tombstone delete --------------------------------------
    {
      state: 'J1', phase: 'ED', kind: 'internal', from: 'gryth1', frame: 'APPEND',
      label: 'dana deletes element {gryth3,1}',
      payload: { share: 'ws-razel', gladeId: 'doc.body', detail: { op: 'delete(element {gryth3,1})', effect: 'creates a TOMBSTONE — the element is marked dead, never removed', why: 'a concurrent op still referencing {gryth3,1} (as anchor) stays valid (§1.2)' } },
      note: 'Delete names element ids and creates tombstones; elements never leave. This is what keeps a still-in-flight reference safe.',
      docRef: `${GE} §1.2`,
      sets: { gryth1: { 'origin log': '+delete {gryth3,1}' } },
    },
    {
      state: 'J3', phase: 'ED', kind: 'message', from: 'gryth1', to: 'local1', frame: 'APPEND',
      label: 'the delete reaches the node',
      payload: { share: 'ws-razel', gladeId: 'doc.body', detail: { op: 'delete {gryth3,1} (origin: dana)' } },
      note: 'The tombstone op parks and fans out like any op.',
      sets: { local1: { 'crdt doc.body/gryth3:1': 'tombstoned · "W"' } },
    },
    {
      state: 'B8', phase: 'ED', kind: 'message', from: 'local1', to: 'local2', frame: 'OPS',
      label: 'the tombstone ships to local2',
      payload: { share: 'ws-razel', gladeId: 'doc.body', detail: { ops: 'delete {gryth3,1}' } },
      note: 'Anti-entropy carries the tombstone. Set-union of ops — the delete is one more element-state op.',
      sets: { local2: { 'crdt doc.body/gryth3:1': 'tombstoned · "W"' } },
    },
    {
      state: 'A4', phase: 'ED', kind: 'internal', from: 'local2', frame: 'FOLD',
      label: 'fold honors the tombstone → "H"',
      payload: { share: 'ws-razel', gladeId: 'doc.body', detail: { text: '"H"', retained: '{gryth3,1} is retained as a tombstone (not dropped) so any concurrent reference resolves', lostWrites: 'none — the tombstone records the delete, the insert is not "lost", it is dead' } },
      note: 'The converged text is "H"; {gryth3,1} lives on as a tombstone. Deleting is a state change on an element, never removal — no lost writes, no dangling anchors.',
      docRef: `${GE} §1.2`,
      sets: { local2: { 'fold doc.body{plan.md}': '"H" ({gryth3,1} tombstoned, retained)' } },
    },

    // ---- Phase EX: duplicate replay is a no-op (idempotence deny arm) -----
    {
      state: 'J3', phase: 'EX', kind: 'message', from: 'gryth3', to: 'local2', frame: 'APPEND',
      label: 'evan’s insert op is re-delivered (duplicate)',
      payload: { share: 'ws-razel', gladeId: 'doc.body', detail: { op: 'insert {gryth3,1} @e0 "W" — REPLAY of an op already folded (a retry / out-of-order re-send)', hazard: 'a naive apply would re-insert "W" or resurrect the tombstone' } },
      note: 'The wire re-delivers an op the fold already holds — the ordinary duplicate-arrival case the identity-based delta must absorb (§3).',
      docRef: `${GE} §3`,
    },
    {
      state: 'A4', phase: 'EX', kind: 'internal', from: 'local2', frame: 'FOLD', variant: 'a',
      variantNote: 'The idempotence branch of the fold: an op whose element id is already present is a no-op — the deny arm of "duplicate ops are idempotent".',
      label: 'dedup by element id — a no-op',
      payload: { share: 'ws-razel', gladeId: 'doc.body', detail: { verdict: 'NO-OP', reason: 'element id {gryth3,1} already in the fold (tombstoned) — dedup by element id', text: '"H" (unchanged)', notResurrected: 'the tombstone is NOT cleared; a re-inserted duplicate does not un-delete' } },
      note: 'Replaying an op the fold already holds is a no-op (§1.2). The duplicate neither doubles "W" nor resurrects the tombstone — the text stays "H". Idempotent dedup is what makes out-of-order delivery safe.',
      docRef: `${GE} §1.2 · §3`,
      sets: { local2: { 'fold doc.body{plan.md}': '"H" (duplicate {gryth3,1} deduped — no-op)' } },
    },
  ],
};

// ---------------------------------------------------------------------------
// s-edit-cursor — an {element_id, affinity} caret stays stable across a remote
// insert/delete AND across OUT-OF-ORDER / duplicated delta arrival (the shared
// identity-delta primitive + the A1 fix); an idle viewer takes a whole refresh;
// rapid ops coalesce (GC-2). Proves H-P4 cursor anchoring + GAP-8’s deferred
// tail (P4.S2). The negative arm: the pre-A1 positional slice would dup/drop.
// ---------------------------------------------------------------------------
export const S_EDIT_CURSOR: Scenario = {
  id: 's-edit-cursor',
  stage: 1,
  title: 'Cursor — element-anchored, out-of-order-tolerant',
  summary:
    'dana’s caret is anchored to an element id {e2, affinity:after}, not an offset. A remote insert BEFORE it (evan) shifts offsets but never the element — the caret stays put. When two more deltas arrive OUT OF ORDER and one duplicated, the IDENTITY-BASED apply (set-diff against what the consumer holds — glial’s A1 logDelta fix) lands them with no dup/drop and the caret still holds; an idle second viewer takes a whole REFRESH instead of the delta; rapid ops coalesce (GC-2).',

  actors: pick('gryth1', 'gryth2', 'gryth3', 'local1', 'local2'),

  initial: {
    local1: {
      'crdt doc.body/e0..e4': 'live · "hello" (e0=h e1=e e2=l e3=l e4=o)',
      links: 'local2 (iroh mesh)',
    },
    local2: {
      'crdt doc.body/e0..e4': 'live · "hello"',
      links: 'local1 (iroh mesh)',
    },
  },

  phases: [
    { id: 'CS', label: 'Caret anchored by element id', summary: 'The active editor mounts with a live cursor and anchors it to an element id + affinity — a private self: value (B4), never an offset, never on the doc stream (AZ-16).' },
    { id: 'CR', label: 'Remote insert — caret does not move', summary: 'A remote insert before the caret shifts offsets; because the anchor is an element id, the caret rides the same character.' },
    { id: 'CO', label: 'Out-of-order / duplicate delta — no dup/drop', summary: 'Two more remote ops arrive reordered + duplicated; the identity-based delta absorbs both (the A1 fix), the caret stays.' },
    { id: 'CV', label: 'Idle viewer takes a whole refresh', summary: 'A second, idle viewer of the SAME surface takes the whole fold, not the incremental delta (GlialClientRuntime rule 3).' },
    { id: 'CC', label: 'Rapid ops coalesce (GC-2)', summary: 'Rapid selection moves coalesce and body deltas batch — the editor is the first consumer that needs conflation.' },
  ],

  steps: [
    // ---- Phase CS: caret anchored by element id --------------------------
    {
      state: 'A1', phase: 'CS', kind: 'message', from: 'gryth1', to: 'local1', frame: 'HELLO',
      label: 'dana’s active-cursor session opens',
      payload: { detail: { session: 'sess-dana', principal: 'dana — fp:9c2e', mount: 'an active-cursor mount → consumer-chooses-delta (rule 3)' } },
      gate: { kind: 'security', label: 'HELLO principal seam (B1–B5)', status: 'designed', note: 'self:dana is derived from this principal (B4); a caller that spells a mismatched literal self is rejected. Not allow-all (§7).' },
      note: 'The active editor is the motivating consumer of the consumer-chooses-delta tail (rule 3): it will apply deltas incrementally and rebase its caret, not take whole refreshes.',
      docRef: `${GE} §2 (B4) · ${GC} rule 3`,
      sets: { local1: { 'session gryth1': 'open (dana)', 'selfkey self:dana': 'gryth1 bound — fp:9c2e' } },
    },
    {
      state: 'C1', phase: 'CS', kind: 'message', from: 'gryth1', to: 'local1', frame: 'SUBSCRIBE',
      label: 'dana subscribes doc.body',
      payload: { share: 'ws-razel', gladeId: 'doc.body', key: '{path:plan.md} (commons)', shape: 'log' },
      note: 'The body is commons; the caret is private (two keys, never smeared — AZ-16). This subscribe is the body leg.',
      docRef: `${GE} §2 · ${GZ}`,
      sets: { gryth1: { subs: 'ws-razel/doc.body{plan.md}' }, local1: { 'sub ws-razel/doc.body{plan.md}': 'gryth1' } },
    },
    {
      state: 'J3', phase: 'CS', kind: 'message', from: 'gryth1', to: 'local1', frame: 'APPEND',
      label: 'dana sets her caret (element-anchored, private)',
      payload: { share: 'ws-razel', gladeId: 'doc.selection', key: 'self:dana (private zone, B4-derived)', shape: 'value', detail: { caret: '{element_id: e2, affinity: after}', notAnOffset: 'anchored to the element id the merge already uses — an offset would jump on every remote edit', private: 'doc.selection is keyed self:dana; a peer NEVER receives it even inside the shared commons body (§2)' } },
      note: 'A caret is {element_id, affinity} (affinity = which side it sticks to at a boundary). This is the SAME anchoring the CRDT merge already needs — the identity the merge uses is the identity the cursor rides.',
      docRef: `${GE} §2`,
      sets: { local1: { 'caret doc.body': '{e2, after} — dana (private self:)' }, gryth1: { view: 'plan.md "hel|lo" (caret after e2)' } },
    },

    // ---- Phase CR: remote insert — caret does not move -------------------
    {
      state: 'A1', phase: 'CR', kind: 'message', from: 'gryth3', to: 'local2', frame: 'HELLO',
      label: 'evan’s session opens (remote editor)',
      payload: { detail: { session: 'sess-evan', principal: 'evan — fp:7b31' } },
      gate: { kind: 'security', label: 'HELLO principal seam (B1–B5)', status: 'designed', note: 'A distinct principal on a second node — his edits will reach dana as deltas.' },
      note: 'evan is the remote editor whose inserts/deletes must NOT disturb dana’s caret.',
      docRef: `${GE} §2`,
      sets: { local2: { 'session gryth3': 'open (evan)', 'selfkey self:evan': 'gryth3 bound — fp:7b31' } },
    },
    {
      state: 'C1', phase: 'CR', kind: 'message', from: 'gryth3', to: 'local2', frame: 'SUBSCRIBE',
      label: 'evan subscribes doc.body',
      payload: { share: 'ws-razel', gladeId: 'doc.body', key: '{path:plan.md} (commons)', shape: 'log' },
      note: 'Same body key. evan writes into the same commons dana is reading.',
      sets: { gryth3: { subs: 'ws-razel/doc.body{plan.md}' }, local2: { 'sub ws-razel/doc.body{plan.md}': 'gryth3' } },
    },
    {
      state: 'J1', phase: 'CR', kind: 'internal', from: 'gryth3', frame: 'APPEND',
      label: 'evan inserts "X" at the document start',
      payload: { share: 'ws-razel', gladeId: 'doc.body', detail: { op: 'insert(element {gryth3,1}, anchor: ⊥ (doc head, before e0), content: "X")', effect: 'shifts the OFFSET of every following char (e2 moves from index 2 → 3)', invariantAnchor: 'e2’s element id is UNCHANGED' } },
      note: 'A remote insert BEFORE dana’s caret anchor. In an offset model her caret would jump +1; the element-id anchor is immune.',
      docRef: `${GE} §2`,
      sets: { gryth3: { 'origin log': '+insert {gryth3,1} @⊥ "X"' } },
    },
    {
      state: 'J3', phase: 'CR', kind: 'message', from: 'gryth3', to: 'local2', frame: 'APPEND',
      label: 'evan’s insert reaches its node',
      payload: { share: 'ws-razel', gladeId: 'doc.body', detail: { op: 'insert {gryth3,1} @⊥ "X" (origin: evan)' } },
      note: 'Parks in local2, ready to replicate to dana’s node.',
      sets: { local2: { 'crdt doc.body/gryth3:1': 'live · "X"' } },
    },
    {
      state: 'B8', phase: 'CR', kind: 'message', from: 'local2', to: 'local1', frame: 'OPS',
      label: 'the insert replicates to dana’s node',
      payload: { share: 'ws-razel', gladeId: 'doc.body', detail: { ops: 'insert {gryth3,1} @⊥ "X"', note: 'heads-driven sync (B8), not a serve' } },
      note: 'Anti-entropy carries the element op to local1.',
      sets: { local1: { 'crdt doc.body/gryth3:1': 'live · "X"' } },
    },
    {
      state: 'A4', phase: 'CR', kind: 'internal', from: 'local1', frame: 'FOLD',
      label: 'fold merges the remote insert → "Xhello"',
      payload: { share: 'ws-razel', gladeId: 'doc.body', detail: { text: '"Xhello"', caretAnchor: 'e2 unchanged — still the first "l"', offsetWouldBe: 'index 2 → 3 (why an offset caret would break)' } },
      note: 'The body grows; e2 still identifies the same character. The merge and the caret share one identity space.',
      docRef: `${GE} §2`,
      sets: { local1: { 'fold doc.body{plan.md}': '"Xhello"' } },
    },
    {
      state: 'B9', phase: 'CR', kind: 'message', from: 'local1', to: 'gryth1', frame: 'OPS',
      label: 'the delta serves to dana', response: true,
      payload: { share: 'ws-razel', gladeId: 'doc.body', shape: 'log', detail: { delta: 'insert {gryth3,1} @⊥ "X" (identity-based delta, §3)' } },
      note: 'The active editor gets a delta, not a whole refresh (rule 3). INV-2: local1’s table names gryth1.',
      docRef: `${GE} §3 · ${GC} rule 3`,
    },
    {
      state: 'L7', phase: 'CR', kind: 'internal', from: 'gryth1', frame: 'EVENT',
      label: 'incremental apply — caret survives',
      payload: { detail: { apply: 'delta applied incrementally against the local fold', caret: '{e2, after} — UNCHANGED', gift: 'cursors survive via stable position identity (the text-crdt gift)' } },
      note: 'The consumer applies the delta and rebases its element-anchored caret: it does not move. This is GAP-8’s deferred tail landed (P4.S2) — the active-cursor editor applies deltas, an idle viewer would refresh.',
      docRef: `${GE} §3 · ${GC} rule 3 (GAP-8 / P4.S2)`,
      sets: { gryth1: { view: 'plan.md "Xhel|lo" (caret still after e2)' } },
    },

    // ---- Phase CO: out-of-order / duplicate delta — no dup/drop ----------
    {
      state: 'J1', phase: 'CO', kind: 'internal', from: 'gryth3', frame: 'APPEND',
      label: 'evan makes two more ops',
      payload: { share: 'ws-razel', gladeId: 'doc.body', detail: { op1: 'insert(element {gryth3,2}, anchor: e4, content: "Y")', op2: 'delete(element e4)', note: 'two ops that will be delivered to dana out of order' } },
      note: 'Two more remote ops — the raw material for the out-of-order / duplicate stress the delta primitive must survive (§3).',
      docRef: `${GE} §3`,
      sets: { gryth3: { 'origin log': '+insert {gryth3,2} @e4 "Y" +delete e4' } },
    },
    {
      state: 'J3', phase: 'CO', kind: 'message', from: 'gryth3', to: 'local2', frame: 'APPEND',
      label: 'both ops reach evan’s node',
      payload: { share: 'ws-razel', gladeId: 'doc.body', detail: { ops: 'insert {gryth3,2} "Y" + delete e4 (origin: evan)' } },
      note: 'Both park in local2, then replicate.',
      sets: { local2: { 'crdt doc.body/gryth3:2': 'live · "Y"', 'crdt doc.body/e4': 'tombstoned · "o"' } },
    },
    {
      state: 'B8', phase: 'CO', kind: 'message', from: 'local2', to: 'local1', frame: 'OPS',
      label: 'the two ops arrive OUT OF ORDER + one duplicated',
      payload: { share: 'ws-razel', gladeId: 'doc.body', detail: { delivery: 'delete(e4) arrives BEFORE insert {gryth3,2}; insert {gryth3,2} arrives TWICE', hazard: 'a positional apply (slice(emittedLen)) would drop or double on this re-sorted stream — exactly the A1 bug' } },
      note: 'The wire reorders and duplicates. This is the precise failure the pre-A1 positional slice mis-handled (dup/drop over a re-sorted list); the identity-based delta must absorb it.',
      docRef: `${GE} §3 (A1 logDelta fix)`,
      sets: { local1: { 'crdt doc.body/gryth3:2': 'live · "Y"', 'crdt doc.body/e4': 'tombstoned · "o"' } },
    },
    {
      state: 'L7', phase: 'CO', kind: 'internal', from: 'gryth1', frame: 'EVENT', variant: 'a',
      variantNote: 'The identity-diff branch: apply by set-diff against what the consumer already holds, so reorder + duplicate both converge — the A1 out-of-order contract, and the deny arm of the positional slice.',
      label: 'identity-based apply — no dup, no drop',
      payload: { detail: { apply: 'set-diff by element identity against the local fold', duplicate: '{gryth3,2} deduped — applied exactly once (no double "Y")', reordered: 'delete(e4) lands correctly by element id though it arrived first', caret: '{e2, after} — STILL unchanged', shared: 'this is the SHARED glial primitive (§3), not editing-local — the D8 window reassembler imports the same contract' } },
      note: 'The delta names elements by IDENTITY and applies by set-diff, so duplicate and reordered arrivals converge — no dup, no drop. The caret, anchored on e2 (untouched by these ops), holds. Convergence + a stable cursor under adversarial delivery is the done-criterion.',
      docRef: `${GE} §3 · glial A1 + GC-1`,
      sets: { gryth1: { view: 'plan.md "Xhel|lY" (caret after e2; "o" tombstoned, "Y" renders after the tombstone — applied once, not dropped)' } },
    },

    // ---- Phase CV: idle viewer takes a whole refresh ---------------------
    {
      state: 'A1', phase: 'CV', kind: 'message', from: 'gryth2', to: 'local1', frame: 'HELLO',
      label: 'dana’s second, idle viewer opens',
      payload: { detail: { session: 'sess-dana2', principal: 'dana — fp:9c2e (same user, second browser)', mount: 'no active cursor — an idle / unmounted viewer' } },
      gate: { kind: 'security', label: 'HELLO principal seam (B1–B5)', status: 'designed', note: 'Same principal fp:9c2e — self:dana is consistent across her devices.' },
      note: 'A second view of the SAME surface that is NOT actively editing — the case rule 3 sends a whole refresh, not a delta.',
      docRef: `${GC} rule 3`,
      sets: { local1: { 'session gryth2': 'open (dana, idle)', 'selfkey self:dana': 'gryth1, gryth2 bound — fp:9c2e' } },
    },
    {
      state: 'C1', phase: 'CV', kind: 'message', from: 'gryth2', to: 'local1', frame: 'SUBSCRIBE',
      label: 'the idle viewer subscribes doc.body',
      payload: { share: 'ws-razel', gladeId: 'doc.body', key: '{path:plan.md} (commons)', shape: 'log' },
      note: 'Same key as dana’s editor and evan.',
      sets: { gryth2: { subs: 'ws-razel/doc.body{plan.md}' }, local1: { 'sub ws-razel/doc.body{plan.md}': 'gryth1, gryth2' } },
    },
    {
      state: 'A5', phase: 'CV', kind: 'message', from: 'local1', to: 'gryth2', frame: 'OPS', response: true,
      label: 'whole refresh to the idle viewer',
      payload: { share: 'ws-razel', gladeId: 'doc.body', shape: 'log', detail: { refresh: 'the full fold "XhellY" — NOT an incremental delta ("o" tombstoned, "Y" survives after it)', why: 'an idle / unmounted viewer has no live cursor to rebase, so it takes the whole field (rule 3)' } },
      note: 'The consumer chooses: active cursor → delta (the editor), idle → refresh (this viewer). Same surface, two delivery modes — the consumer-chooses seam (rule 3). INV-2: the table names gryth2.',
      docRef: `${GC} rule 3`,
      sets: { gryth2: { view: 'plan.md = "XhellY" (whole refresh)' } },
    },

    // ---- Phase CC: rapid ops coalesce (GC-2) -----------------------------
    {
      state: 'L7', phase: 'CC', kind: 'internal', from: 'gryth1', frame: 'EVENT',
      label: 'GC-2 conflation — coalesce + batch',
      payload: { detail: { selectionMoves: 'rapid caret moves coalesced into one selection update', bodyOps: 'body deltas batched', why: 'the editor is the first consumer that needs GC-2 conflation / backpressure' } },
      note: 'GC-2 conflation lands here: coalesce selection moves and batch body ops so a fast typist does not flood the tap. The caret is unaffected — conflation is a delivery optimization, not a semantic change.',
      docRef: `${GE} §3 (GC-2)`,
      sets: { gryth1: { view: 'plan.md (caret steady; updates conflated)' } },
    },
  ],
};

// ---------------------------------------------------------------------------
// s-edit-offline-merge — an editor edits while partitioned; on reconnect its op
// set and the peer’s merge/heal into one converged document with no lost or
// duplicated elements, regardless of delivery order. Proves causal-dependency
// replay + idempotent dedup end to end (§8). The deny arm: a re-delivered op
// dedups by element id — no duplicate element.
// ---------------------------------------------------------------------------
export const S_EDIT_OFFLINE_MERGE: Scenario = {
  id: 's-edit-offline-merge',
  stage: 1,
  title: 'Offline merge — the CRDT heals on reconnect',
  summary:
    'The link drops; dana keeps inserting while partitioned and evan concurrently deletes + inserts on the other side. On reconnect heads reveal the gap, both op sets ship, and the fold heals to ONE converged document — every offline op present (an insert, a delete-as-tombstone, a concurrent insert), none lost or duplicated. A straggler re-delivery of an already-folded op dedups by element id (idempotent), end to end.',

  actors: pick('gryth1', 'gryth3', 'local1', 'local2', 'iroh'),

  initial: {
    gryth1: { session: 'local1 (open, dana)', view: 'plan.md = "abc"' },
    gryth3: { session: 'local2 (open, evan)', view: 'plan.md = "abc"' },
    local1: {
      'session gryth1': 'open (dana)',
      'sub ws-razel/doc.body{plan.md}': 'gryth1',
      'crdt doc.body/e0..e2': 'live · "abc" (e0=a e1=b e2=c)',
      links: 'local2 (iroh mesh)',
    },
    local2: {
      'session gryth3': 'open (evan)',
      'sub ws-razel/doc.body{plan.md}': 'gryth3',
      'crdt doc.body/e0..e2': 'live · "abc"',
      links: 'local1 (iroh mesh)',
    },
  },

  phases: [
    { id: 'OP', label: 'Partition + offline edits', summary: 'The peer link drops; both sides keep writing element ops locally — the network was never on the write path.' },
    { id: 'OR', label: 'Reconnect + reconcile', summary: 'iroh restores reachability; heads reveal each side’s missing ops; both op sets ship as anti-entropy.' },
    { id: 'OH', label: 'Heal — converge, no lost ops', summary: 'The fold applies both offline op sets by causal-dependency replay; both replicas converge to one document.' },
    { id: 'OX', label: 'Idempotent dedup', summary: 'A straggler re-delivers an already-folded op; dedup by element id makes it a no-op — no duplicate element.' },
  ],

  steps: [
    // ---- Phase OP: partition + offline edits -----------------------------
    {
      state: 'E4', phase: 'OP', kind: 'message', from: 'iroh', to: 'local1', frame: 'STATUS',
      label: 'local2 unreachable',
      payload: { detail: { link: 'local2 — relay lost, dial fails' } },
      note: 'The partition is detected, not declared. Nothing pauses; editing continues offline.',
      sets: { local1: { links: 'local2 (DOWN)' } },
    },
    {
      state: 'J1', phase: 'OP', kind: 'internal', from: 'gryth1', frame: 'APPEND',
      label: 'dana inserts "!" offline',
      payload: { share: 'ws-razel', gladeId: 'doc.body', detail: { op: 'insert(element {gryth1,4}, anchor: e2, content: "!")', deps: 'causal deps = {e0,e1,e2} — what dana had seen', path: 'local + unconditional; the network is not on it' } },
      note: 'The offline write appends to dana’s origin log with its causal dependencies recorded — those deps are what let the peer replay it correctly later.',
      docRef: `${GE} §1.2 · SubstrateV1 §2/§5`,
      sets: { gryth1: { 'origin log': '+insert {gryth1,4} @e2 "!"' }, local1: { 'crdt doc.body/gryth1:4': 'live · "!" (peer pending)' } },
    },
    {
      state: 'J1', phase: 'OP', kind: 'internal', from: 'gryth3', frame: 'APPEND',
      label: 'evan concurrently deletes + inserts offline',
      payload: { share: 'ws-razel', gladeId: 'doc.body', detail: { op1: 'delete(element e1) → tombstone', op2: 'insert(element {gryth3,4}, anchor: e2, content: "Z")', concurrency: 'neither side has seen the other — both inserts name anchor e2' } },
      note: 'On the far side of the partition evan deletes "b" (tombstone) and inserts "Z" after e2 — a concurrent sibling of dana’s {gryth1,4}. Per-origin logs cannot conflict at append time, only at fold time.',
      docRef: `${GE} §1.2`,
      sets: { gryth3: { 'origin log': '+delete e1 +insert {gryth3,4} @e2 "Z"' }, local2: { 'crdt doc.body/e1': 'tombstoned · "b"', 'crdt doc.body/gryth3:4': 'live · "Z" (peer pending)' } },
    },

    // ---- Phase OR: reconnect + reconcile ---------------------------------
    {
      state: 'B5', phase: 'OR', kind: 'message', from: 'iroh', to: 'local1', frame: 'ADDR',
      label: 'local2 reachable again', response: true,
      payload: { detail: { addr: 'relay path restored' } },
      note: 'iroh notices before anyone else cares; the CRDT heal begins.',
      sets: { local1: { links: 'local2 (restored)' } },
    },
    {
      state: 'B7', phase: 'OR', kind: 'message', from: 'local1', to: 'local2', frame: 'HEADS',
      label: 'heads reveal each side’s missing ops',
      payload: { share: 'ws-razel', detail: { compare: 'version vectors differ on both origins — local1 lacks evan’s two ops, local2 lacks dana’s insert' } },
      note: 'The version vector says exactly what each side is missing — no diffing, no guessing.',
      docRef: `${GE} §3 · SubstrateV1 §2 (GQ-9)`,
    },
    {
      state: 'B8', phase: 'OR', kind: 'message', from: 'local2', to: 'local1', frame: 'OPS',
      label: 'evan’s gap ships', response: true,
      payload: { share: 'ws-razel', gladeId: 'doc.body', detail: { ops: 'delete e1 + insert {gryth3,4} "Z"', replay: 'applied by CAUSAL-DEPENDENCY replay — deps already satisfied on local1' } },
      note: 'Gap one of two. Causal-dependency replay: each op’s deps are present before it applies, so the element set stays consistent.',
      docRef: `${GE} §1.2 · §3`,
      sets: { local1: { 'crdt doc.body/e1': 'tombstoned · "b"', 'crdt doc.body/gryth3:4': 'live · "Z"' } },
    },
    {
      state: 'B8', phase: 'OR', kind: 'message', from: 'local1', to: 'local2', frame: 'OPS',
      label: 'dana’s gap ships',
      payload: { share: 'ws-razel', gladeId: 'doc.body', detail: { ops: 'insert {gryth1,4} "!"' } },
      note: 'Gap two of two. Both replicas now hold the SAME element set.',
      sets: { local2: { 'crdt doc.body/gryth1:4': 'live · "!"' } },
    },

    // ---- Phase OH: heal — converge, no lost ops --------------------------
    {
      state: 'A4', phase: 'OH', kind: 'internal', from: 'local1', frame: 'FOLD',
      label: 'fold heals → "ac!Z"',
      payload: { share: 'ws-razel', gladeId: 'doc.body', detail: { base: '"abc"', evan: 'delete e1 → "ac"', siblings: 'two inserts at anchor e2 — {gryth1,4} "!" and {gryth3,4} "Z"', tieBreak: '{gryth1,4} < {gryth3,4} → "!" before "Z"', text: '"ac!Z"', lostOps: 'none — insert, delete (tombstone), concurrent insert all present' } },
      note: 'Every offline op survives the heal: dana’s insert, evan’s tombstone-delete, evan’s concurrent insert — ordered deterministically. No op is lost or dropped by the merge.',
      docRef: `${GE} §1.2`,
      sets: { local1: { 'fold doc.body{plan.md}': '"ac!Z"' } },
    },
    {
      state: 'A4', phase: 'OH', kind: 'internal', from: 'local2', frame: 'FOLD',
      label: 'the other side folds identically',
      payload: { share: 'ws-razel', gladeId: 'doc.body', detail: { text: '"ac!Z"', order: 'folded in a different arrival order — identical result' } },
      note: 'Same op-set ⇒ same fold: both sides converge on "ac!Z". The heal is a property of the fold, not of coordination.',
      docRef: `${GE} §1.2`,
      sets: { local2: { 'fold doc.body{plan.md}': '"ac!Z"' } },
    },
    {
      state: 'B9', phase: 'OH', kind: 'message', from: 'local1', to: 'gryth1', frame: 'OPS',
      label: 'the healed doc serves to dana', response: true,
      payload: { share: 'ws-razel', gladeId: 'doc.body', shape: 'log', detail: { text: '"ac!Z"' } },
      note: 'dana sees the merged document. INV-2: local1’s table names gryth1.',
      sets: { gryth1: { view: 'plan.md = "ac!Z" (merged)' } },
    },
    {
      state: 'B9', phase: 'OH', kind: 'message', from: 'local2', to: 'gryth3', frame: 'OPS',
      label: 'and to evan', response: true,
      payload: { share: 'ws-razel', gladeId: 'doc.body', shape: 'log', detail: { text: '"ac!Z"' } },
      note: 'evan sees the same. Neither side lost their offline work — the whole point.',
      sets: { gryth3: { view: 'plan.md = "ac!Z" (merged)' } },
    },

    // ---- Phase OX: idempotent dedup (deny arm) ---------------------------
    {
      state: 'B8', phase: 'OX', kind: 'message', from: 'local2', to: 'local1', frame: 'OPS',
      label: 'a straggler re-delivers an already-folded op',
      payload: { share: 'ws-razel', gladeId: 'doc.body', detail: { ops: 'insert {gryth3,4} "Z" — a retry / out-of-order re-send of an op local1 already folded' } },
      note: 'Reconnect anti-entropy can re-ship an op that already landed. This is the ordinary duplicate the heal must absorb without corrupting the text.',
      docRef: `${GE} §1.2 · §3`,
    },
    {
      state: 'A4', phase: 'OX', kind: 'internal', from: 'local1', frame: 'FOLD', variant: 'a',
      variantNote: 'The idempotence branch: an op whose element id is already folded is a no-op — end-to-end dedup, the deny arm of "no duplicated elements".',
      label: 'dedup by element id — no-op',
      payload: { share: 'ws-razel', gladeId: 'doc.body', detail: { verdict: 'NO-OP', reason: 'element id {gryth3,4} already present — dedup by element id', text: '"ac!Z" (unchanged)', guarantee: 'no duplicated element, no lost op — idempotent replay end to end (§8)' } },
      note: 'Replaying an op the fold already holds changes nothing (§1.2). The heal is idempotent all the way to the document text — the u1/u2/u3-style guarantee for editing.',
      docRef: `${GE} §1.2 · §8`,
      sets: { local1: { 'fold doc.body{plan.md}': '"ac!Z" (duplicate {gryth3,4} deduped)' } },
    },
  ],
};

// ---------------------------------------------------------------------------
// s-edit-save-conflict — doc.save delegates to files.write/replace with the
// expected base revision (D12 compare-and-replace); a clean base replaces, but a
// concurrent gwz-pull that moved the base under the session returns an EXPLICIT
// conflict — last-writer-wins must NOT silently overwrite (D12/D13). Positive:
// clean save. Deny arm: base moved → explicit conflict, nothing overwritten.
// ---------------------------------------------------------------------------
export const S_EDIT_SAVE_CONFLICT: Scenario = {
  id: 's-edit-save-conflict',
  stage: 1,
  title: 'Save — compare-and-replace, explicit conflict',
  summary:
    'doc.save is one exchange that delegates to the workspace host’s files.write/replace with the recorded base revision (D12). A clean save (expected r42 == current r42) replaces and advances to r43. Then a concurrent gwz pull moves the file to r44 under the open session; the next save (expected r43) finds current r44 — the write is REFUSED and an explicit conflict returns as data. Last-writer-wins never silently overwrites a changed base.',

  actors: pick('gryth1', 'local1', 'peer1'),

  initial: {
    gryth1: { session: 'local1 (open, dana)', view: 'plan.md (live editing)' },
    local1: { 'session gryth1': 'open (dana)', links: 'peer1 (iroh)' },
    peer1: {
      serving: 'ws-razel via grazel',
      wc: 'ws-razel checkout — plan.md @ rev r42 (workspace.lock available)',
      gwz: 'gwz-core — the files.write/replace target',
    },
  },

  phases: [
    { id: 'DO', label: 'Open records the base revision', summary: 'Opening the editing session records the saved base revision the live CRDT generation layers over (H-P4, §4).' },
    { id: 'DS', label: 'Clean save — compare-and-replace', summary: 'doc.save routes to the workspace host, which files.write/replace under the lock when expected base == current; the base advances.' },
    { id: 'DP', label: 'The base moves under the session', summary: 'A concurrent gwz pull fast-forwards the file; the at-rest truth (D13) changes, the session’s recorded base is now stale (§10 Q3).' },
    { id: 'DC', label: 'Conflicting save — explicit conflict', summary: 'The next save’s expected base no longer matches current; the write is refused and the conflict returns as data — no silent overwrite.' },
  ],

  steps: [
    // ---- Phase DO: open records the base revision ------------------------
    {
      state: 'C1', phase: 'DO', kind: 'message', from: 'gryth1', to: 'local1', frame: 'SUBSCRIBE',
      label: 'dana opens the editing session',
      payload: { share: 'ws-razel', gladeId: 'doc.body', key: '{path:plan.md} (commons)', shape: 'log', detail: { open: 'records the saved base revision the session builds on (H-P4)', atRest: 'the workspace file is the authoritative at-rest document (D13); editing layers the live CRDT over it' } },
      note: 'open records the base revision (H-P4, §4): the live CRDT generation layers over the last-saved snapshot. Which file is a glade-files binding; the editing session keys off that file identity.',
      docRef: `${GE} §4 (D13)`,
      sets: { local1: { 'sub ws-razel/doc.body{plan.md}': 'gryth1' }, gryth1: { subs: 'ws-razel/doc.body{plan.md}', 'docbase plan.md': 'rev r42 (recorded at open)' } },
    },

    // ---- Phase DS: clean save — compare-and-replace ----------------------
    {
      state: 'D1', phase: 'DS', kind: 'message', from: 'gryth1', to: 'local1', frame: 'EXCHANGE',
      label: 'dana saves (expected base r42)',
      payload: { share: 'ws-razel', gladeId: 'doc.save', shape: 'exchange', verb: 'doc.save', correlationId: 'save-1', detail: { expectedBase: 'r42 (the recorded base)', flush: 'flush the live CRDT generation to the at-rest file', delegation: 'editing does NOT write the tree itself — it delegates to files.write/replace (D12)' } },
      note: 'One explicit doc.save exchange; the result is data. Editing does not duplicate files’ AZ-1 enforcement — it delegates with the expected base revision.',
      docRef: `${GE} §4 (D12)`,
      sets: { local1: { 'pending save-1': 'gryth1 → doc.save (expected r42)' } },
    },
    {
      state: 'C2', phase: 'DS', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'route the save to the workspace host',
      payload: { detail: { question: 'who holds the working copy + lock for ws-razel?', answer: 'peer1 (grazel authority)' } },
      gate: { kind: 'routing', label: 'save routing (files.write target)', status: 'designed', note: 'doc.save is a directed exchange to the workspace-host provider that holds the workspace.lock (D12) — the save target is the lock-holder, resolved from the ServeClaim, not any node.' },
      note: 'The save routes to the provider holding the working copy + lock — the compare-and-replace must happen where the tree and its lock live.',
      docRef: `${GE} §4 · ${SM} §2.2`,
      sets: { local1: { 'route doc.save': 'peer1' } },
    },
    {
      state: 'D2', phase: 'DS', kind: 'message', from: 'local1', to: 'peer1', frame: 'EXCHANGE',
      label: 'forward the save',
      payload: { gladeId: 'doc.save', shape: 'exchange', verb: 'doc.save', correlationId: 'save-1', detail: { expectedBase: 'r42' } },
      note: 'Directed to the lock-holder; correlation id preserved 1:1.',
      sets: { peer1: { 'pending save-1': 'local1' } },
    },
    {
      state: 'D3', phase: 'DS', kind: 'internal', from: 'peer1', frame: 'PROVIDE',
      label: 'files.write/replace — base matches',
      payload: { detail: { compare: 'expected r42 == current r42 → MATCH', write: 'replace plan.md under workspace.lock; new rev r43', delegate: 'this IS files.write/replace with the required lock/lease (D12); editing does not reimplement it' } },
      note: 'Compare-and-replace succeeds: the expected base matched, so the flush writes and advances the revision under the lock. The at-rest snapshot (D13) is now r43.',
      docRef: `${GE} §4 (D12/D13)`,
      sets: { peer1: { wc: 'ws-razel checkout — plan.md @ rev r43 (written)', 'generation ws-razel/plan.md': 'gen r43 (saved from live CRDT)', 'pending save-1': 'local1 (writing)' } },
    },
    {
      state: 'D4', phase: 'DS', kind: 'message', from: 'peer1', to: 'local1', frame: 'EXCHANGE-RESP',
      label: 'saved (ok) — new base r43', response: true,
      payload: { correlationId: 'save-1', detail: { ok: 'true', newBase: 'r43', wrote: 'plan.md' } },
      note: 'The save completes; the response carries the new base revision as data.',
      docRef: `${SM} §2.3`,
      sets: { peer1: { 'pending save-1': null } },
    },
    {
      state: 'D5', phase: 'DS', kind: 'message', from: 'local1', to: 'gryth1', frame: 'EXCHANGE-RESP',
      label: 'session rebases to r43', response: true,
      payload: { correlationId: 'save-1', detail: { result: 'saved', newBase: 'r43' } },
      note: 'The session rebases its recorded base r42 → r43. Autosave cadence and gwz-pull conflicts resolve through this SAME compare-and-replace path (§10 Q3).',
      docRef: `${GE} §4`,
      sets: { gryth1: { 'docbase plan.md': 'rev r43 (rebased after save)', view: 'plan.md saved (r43)' }, local1: { 'pending save-1': null } },
    },

    // ---- Phase DP: the base moves under the session ----------------------
    {
      state: 'J1', phase: 'DP', kind: 'internal', from: 'peer1', frame: 'APPEND',
      label: 'a gwz pull moves the base to r44',
      payload: { detail: { op: 'gwz pull fast-forwards plan.md to rev r44 (an external change to the working tree)', case: 'the §10 Q3 gwz-pull-under-open-session conflict', consequence: 'the at-rest truth (D13) moved; the session’s recorded base r43 is now stale' } },
      note: 'A concurrent gwz pull changes the file under the open editing session. The live CRDT generation still layers over r43, but the tree is now r44 — the seam §10 Q3 flags, resolved via the SAME compare-and-replace path.',
      docRef: `${GE} §4 · §10 Q3`,
      sets: { peer1: { wc: 'ws-razel checkout — plan.md @ rev r44 (gwz pull — external change)', 'generation ws-razel/plan.md': 'gen r44 (gwz pull moved the base)' } },
    },

    // ---- Phase DC: conflicting save — explicit conflict (deny arm) -------
    {
      state: 'D1', phase: 'DC', kind: 'message', from: 'gryth1', to: 'local1', frame: 'EXCHANGE',
      label: 'dana saves again (expected base r43)',
      payload: { share: 'ws-razel', gladeId: 'doc.save', shape: 'exchange', verb: 'doc.save', correlationId: 'save-2', detail: { expectedBase: 'r43 (the session’s recorded base — unaware of the pull)' } },
      note: 'dana saves once more; her session still expects r43. She cannot know the tree moved — that is the node/host’s call at compare time.',
      docRef: `${GE} §4`,
      sets: { local1: { 'pending save-2': 'gryth1 → doc.save (expected r43)' } },
    },
    {
      state: 'C2', phase: 'DC', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'route the save to the host',
      payload: { detail: { target: 'peer1 (unchanged — still the lock-holder)' } },
      gate: { kind: 'routing', label: 'save routing (files.write target)', status: 'designed', note: 'Same directed path as the clean save — the difference will be the compare result at the host, not the route.' },
      note: 'The routing is identical; the conflict is a property of the compare-and-replace, not the path.',
      docRef: `${SM} §2.2`,
      sets: { local1: { 'route doc.save': 'peer1' } },
    },
    {
      state: 'D2', phase: 'DC', kind: 'message', from: 'local1', to: 'peer1', frame: 'EXCHANGE',
      label: 'forward the save',
      payload: { gladeId: 'doc.save', shape: 'exchange', verb: 'doc.save', correlationId: 'save-2', detail: { expectedBase: 'r43' } },
      note: 'Forwarded to the lock-holder, corr save-2.',
      sets: { peer1: { 'pending save-2': 'local1' } },
    },
    {
      state: 'D3', phase: 'DC', kind: 'internal', from: 'peer1', frame: 'PROVIDE', variant: 'a',
      variantNote: 'The conflict branch of files.write/replace: expected base != current → the compare fails, the write is REFUSED, nothing is overwritten (D12).',
      label: 'files.write/replace — base MISMATCH → conflict',
      payload: { detail: { compare: 'expected r43 != current r44 → MISMATCH', write: 'REFUSED — no mutation', rule: 'last-writer-wins MUST NOT silently overwrite a changed base (D12); conflict is explicit', lock: 'the workspace.lock is not even taken to overwrite — the compare gates first' } },
      note: 'The base changed under the session, so the save fails LOUDLY: the write is refused and no overwrite happens. This is the D12 contract — an explicit conflict, never a silent clobber of the pulled r44.',
      docRef: `${GE} §4 (D12)`,
      sets: { peer1: { 'conflict save-2': 'expected r43 ≠ current r44 — write refused', 'pending save-2': 'local1 (conflict)' } },
    },
    {
      state: 'D4', phase: 'DC', kind: 'message', from: 'peer1', to: 'local1', frame: 'EXCHANGE-RESP',
      label: 'conflict (ok:false) — nothing written', response: true,
      payload: { correlationId: 'save-2', detail: { ok: 'false', error: 'base revision conflict', expected: 'r43', current: 'r44', wrote: 'nothing' } },
      note: 'The conflict returns as data: ok:false with expected vs current base. No overwrite, no lost pull. Absence/failure is a value (GladeSupplierModel §2.4).',
      docRef: `${GE} §4 · ${SM} §2.4`,
      sets: { peer1: { 'pending save-2': null } },
    },
    {
      state: 'D5', phase: 'DC', kind: 'message', from: 'local1', to: 'gryth1', frame: 'EXCHANGE-RESP',
      label: 'explicit conflict surfaced to the editor', response: true,
      payload: { correlationId: 'save-2', detail: { result: 'CONFLICT — base moved r43 → r44', remedy: 'rebase onto r44 (re-read the pulled base) and re-save; the live CRDT generation is not lost', neverSilent: 'the editor is told, not silently overwritten' } },
      note: 'The editor sees an explicit save conflict with the remedy — the CRDT generation is still live and unlost. D12 refuses to guess; the human reconciles.',
      docRef: `${GE} §4 (D12)`,
      sets: { gryth1: { view: 'plan.md — SAVE CONFLICT (base moved r43→r44; rebase to re-save)' }, local1: { 'pending save-2': null } },
    },
  ],
};

// ---------------------------------------------------------------------------
// s-edit-compaction — tombstones/history compact only behind a causal checkpoint
// acknowledged past the compacted frontier (H-P4 §1.3); a reopen after compaction
// reconstructs identical text; a late out-of-order op referencing pre-frontier
// state is handled safely. Positive: identical reconstruction. Deny arm: the
// straggler cannot break the frontier (dedup / surviving-anchor).
// ---------------------------------------------------------------------------
export const S_EDIT_COMPACTION: Scenario = {
  id: 's-edit-compaction',
  stage: 1,
  title: 'Compaction — behind an acknowledged causal checkpoint',
  summary:
    'Tombstones and superseded history compact ONLY behind a causal checkpoint acknowledged past the compacted frontier — you may drop only what every actor provably saw (H-P4 §1.3). A reopened session bootstraps from the signed, home-anchored checkpoint + tail and reconstructs IDENTICAL text. A late, out-of-order op referencing pre-frontier state is handled safely: its anchor survived the checkpoint (or it dedups), so no still-in-flight op can reference a compacted element.',

  actors: pick('gryth3', 'local1', 'local2'),

  initial: {
    local1: {
      'text doc.body': '"glade plan" (e0..e9 live)',
      'crdt doc.body/e3': 'tombstoned · "x" (superseded)',
      'crdt doc.body/e7': 'tombstoned · "y" (superseded)',
      links: 'local2 (iroh mesh)',
    },
    local2: {
      'text doc.body': '"glade plan" (e0..e9 live)',
      'crdt doc.body/e3': 'tombstoned · "x"',
      'crdt doc.body/e7': 'tombstoned · "y"',
      links: 'local1 (iroh mesh)',
    },
  },

  phases: [
    { id: 'KA', label: 'Acknowledge past the frontier', summary: 'Heads + verify-as-ingest establish that every actor has acknowledged the op-set through the frontier seq — the precondition for dropping anything.' },
    { id: 'KC', label: 'Compact behind the checkpoint', summary: 'Superseded tombstones drop behind the causal checkpoint at the acknowledged frontier; the checkpoint is signed and home-anchored (rewrite is fold-detectable).' },
    { id: 'KR', label: 'Reopen reconstructs identical text', summary: 'A fresh session bootstraps from the signed checkpoint + tail and folds the SAME text — compaction dropped only superseded tombstones, never live content.' },
    { id: 'KX', label: 'Late out-of-order op handled safely', summary: 'A straggler referencing pre-frontier state either dedups or resolves against a surviving anchor — no dangling reference.' },
  ],

  steps: [
    // ---- Phase KA: acknowledge past the frontier -------------------------
    {
      state: 'B7', phase: 'KA', kind: 'message', from: 'local1', to: 'local2', frame: 'HEADS',
      label: 'heads exchange — where is the frontier',
      payload: { share: 'ws-razel', detail: { compare: 'version vectors + chain heads for doc.body; local1 asks how far local2 has folded' } },
      note: 'Compaction is a fold-side GC (§1.3), and it must know the causal frontier every actor has crossed. Heads are how that is established.',
      docRef: `${GE} §1.3 · §3`,
    },
    {
      state: 'Y2', phase: 'KA', kind: 'internal', from: 'local2', frame: 'FOLD',
      label: 'verify-as-ingest + acknowledge through seq 30',
      payload: { share: 'ws-razel', gladeId: 'doc.body', detail: { verify: 'per op: prev-hash continuity + origin signature + seq monotonicity (O(1), carriers untrusted)', ack: 'local2 has verified + folded doc.body through seq 30' } },
      gate: { kind: 'security', label: 'verify-as-ingest', status: 'designed', note: 'Every op is verified as it lands (origin signature + chain continuity) — the acknowledgment that gates compaction is over VERIFIED state, so the checkpoint cannot be poisoned by a bad carrier.' },
      note: 'local2 verifies each op and acknowledges the op-set through seq 30. Only acknowledged, verified ops count toward the frontier a checkpoint may compact behind.',
      docRef: `${GE} §1.3 · AZ-12`,
      sets: { local2: { 'signed gryth1@30': 'doc.body ops e0..e9 + tombstones · sig ok', 'frontier doc.body': 'acknowledged through seq 30' } },
    },
    {
      state: 'B7', phase: 'KA', kind: 'message', from: 'local2', to: 'local1', frame: 'HEADS',
      label: 'ack returns — frontier confirmed', response: true,
      payload: { share: 'ws-razel', detail: { ack: 'local2 acknowledges doc.body through seq 30', condition: 'every actor (local1 self + local2) has now provably seen through seq 30' } },
      note: 'local1 learns the frontier is acknowledged by every actor through seq 30 — the causal checkpoint precondition (§1.3) is met.',
      docRef: `${GE} §1.3`,
      sets: { local1: { 'frontier doc.body': 'acknowledged by all through seq 30' } },
    },

    // ---- Phase KC: compact behind the checkpoint -------------------------
    {
      state: 'Y1', phase: 'KC', kind: 'internal', from: 'local1', frame: 'FOLD',
      label: 'compact — drop superseded tombstones behind the frontier',
      payload: { share: 'ws-razel', gladeId: 'doc.body', detail: { drop: 'tombstones e3, e7 (superseded, both behind the acknowledged frontier seq 30)', rule: 'drop ONLY what every actor provably saw — nothing still in flight can reference a compacted element (§1.3)', checkpoint: 'emit a signed origin checkpoint; the checkpoint head is ALSO anchored in the home share, so a rewrite is fold-detectable (AZ-12)', gc: 'compaction is a fold-side GC, not a wire feature' } },
      note: 'The superseded tombstones compact behind the causal checkpoint. Because the frontier is acknowledged by every actor, no out-of-order op can still reference the dropped elements. The checkpoint is signed + home-anchored.',
      docRef: `${GE} §1.3 · AZ-12 (Y1)`,
      sets: { local1: { 'crdt doc.body/e3': null, 'crdt doc.body/e7': null, 'generation doc.body': 'gen 2 (compacted at frontier seq 30; checkpoint signed + home-anchored)', 'text doc.body': '"glade plan" (checkpoint — live content unchanged)' } },
    },

    // ---- Phase KR: reopen reconstructs identical text --------------------
    {
      state: 'A1', phase: 'KR', kind: 'message', from: 'gryth3', to: 'local1', frame: 'HELLO',
      label: 'a fresh session reopens the doc',
      payload: { detail: { session: 'sess-frank', principal: 'frank — fp:5d90', when: 'AFTER compaction — reconstructs from the checkpoint, not the full history' } },
      gate: { kind: 'security', label: 'HELLO principal seam (B1–B5)', status: 'designed', note: 'A distinct principal reopening; self:frank derived from it (B4).' },
      note: 'A reopen after compaction: the session has never seen the pre-checkpoint history, only the compacted checkpoint + tail.',
      docRef: `${GE} §2 · §1.3`,
      sets: { local1: { 'session gryth3': 'open (frank)', 'selfkey self:frank': 'gryth3 bound — fp:5d90' } },
    },
    {
      state: 'C1', phase: 'KR', kind: 'message', from: 'gryth3', to: 'local1', frame: 'SUBSCRIBE',
      label: 'frank subscribes doc.body',
      payload: { share: 'ws-razel', gladeId: 'doc.body', key: '{path:plan.md} (commons)', shape: 'log' },
      note: 'The reopened body subscription — it will be served from the checkpoint fold + tail.',
      sets: { gryth3: { subs: 'ws-razel/doc.body{plan.md}' }, local1: { 'sub ws-razel/doc.body{plan.md}': 'gryth3' } },
    },
    {
      state: 'Y1', phase: 'KR', kind: 'internal', from: 'local1', frame: 'FOLD', variant: 'a',
      variantNote: 'The reconstruction leg (not the compaction leg): bootstrap the reopened session from the signed checkpoint + tail and fold the text.',
      label: 'reconstruct from the signed checkpoint + tail',
      payload: { share: 'ws-razel', gladeId: 'doc.body', detail: { bootstrap: 'signed checkpoint (gen 2) + the post-frontier tail', text: '"glade plan" — IDENTICAL to pre-compaction', why: 'compaction dropped only superseded TOMBSTONES; every live element (and thus the text) is untouched' } },
      note: 'The reopen reconstructs the SAME text: compaction is behavior-preserving on the folded document — it only garbage-collects dead history. Identical reconstruction is the H-P4 compaction guarantee.',
      docRef: `${GE} §1.3`,
      sets: { local1: { 'text doc.body': '"glade plan" (reconstructed from checkpoint + tail — identical)' } },
    },
    {
      state: 'A5', phase: 'KR', kind: 'message', from: 'local1', to: 'gryth3', frame: 'OPS', response: true,
      label: 'reconstructed doc serves to frank',
      payload: { share: 'ws-razel', gladeId: 'doc.body', shape: 'log', detail: { text: '"glade plan"', identical: 'same as any pre-compaction reader would fold' } },
      note: 'frank folds the reconstructed body — identical to the pre-compaction text. INV-2: local1’s table names gryth3.',
      sets: { gryth3: { view: 'plan.md = "glade plan" (identical after compaction)' } },
    },

    // ---- Phase KX: late out-of-order op handled safely (deny arm) --------
    {
      state: 'B8', phase: 'KX', kind: 'message', from: 'local2', to: 'local1', frame: 'OPS',
      label: 'a late straggler op arrives out of order',
      payload: { share: 'ws-razel', gladeId: 'doc.body', detail: { op: 'insert(element {gryth1,22}, anchor: e5) — a pre-frontier (seq ≤ 30) op arriving LATE / out of order', anchor: 'e5 — a LIVE element (not one of the compacted tombstones e3/e7)' } },
      note: 'A pre-frontier op arrives after compaction — the exact case §1.3 must handle safely: does it dangle against a compacted element?',
      docRef: `${GE} §1.3`,
    },
    {
      state: 'A4', phase: 'KX', kind: 'internal', from: 'local1', frame: 'FOLD', variant: 'a',
      variantNote: 'The safety branch: a straggler cannot break the compacted frontier — its anchor survived (only acknowledged tombstones dropped), and a re-delivery dedups by element id.',
      label: 'handled safely — anchor survived / dedup',
      payload: { share: 'ws-razel', gladeId: 'doc.body', detail: { resolves: 'anchor e5 is still LIVE — compaction dropped only e3/e7 tombstones, never e5', guarantee: 'because the frontier was acknowledged by EVERY actor, no still-in-flight op can reference a compacted (dropped) element (§1.3)', ifAlreadyFolded: 'if this op was already in the fold it dedups by element id (idempotent) — a no-op', outcome: 'no dangling reference, no corruption; text unchanged or extends cleanly' } },
      note: 'The straggler is safe TWICE over: its anchor e5 survived the checkpoint (the acknowledged-frontier rule guarantees this), and a duplicate would dedup by element id. Compaction never strands an in-flight reference — the whole reason you may drop only what every actor provably saw.',
      docRef: `${GE} §1.3 · §1.2`,
      sets: { local1: { 'text doc.body': '"glade plan" (straggler resolved against live anchor e5 — safe)' } },
    },
  ],
};
