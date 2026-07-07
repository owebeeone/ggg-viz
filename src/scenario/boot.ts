// Node boot — the system-data seam made observable (GDL-036).
// A node comes up from $HOME/.glade/sys/<name>/: it takes its instance,
// validates the disk as just another untrusted carrier (the load = sync
// ladder), materialises the RegistryApi fold, writes its own presence with
// origin attribution, and answers the first UI query over that fold. This
// trace GATES Lane R step 1: the interim blob StoreApi and the real
// home-share folds must both produce exactly these observable steps.
import type { Scenario } from './types';
import { pick } from './actors';

const GDS = 'GladeSystemDataSeam';
const WD = 'GladeWorkspaceDirectory';

export const S_BOOT: Scenario = {
  id: 's-boot',
  stage: 1,
  title: 'Boot — the system-data seam',
  summary:
    'A node boots from ~/.glade/sys/<name>/: instance acquired, the whole-state taut blob loaded through StoreApi, the load-validation ladder run, RegistryApi answering the first query over its fold.',

  actors: pick('local1', 'gryth1'),

  phases: [
    { id: 'BD', label: 'Acquire the instance', summary: 'Open the per-instance directory, take the single-writer lock, bind the node identity.' },
    { id: 'BV', label: 'Load + validate (the disk is a carrier)', summary: 'One taut SystemSnapshot blob through StoreApi; verify-as-ingest per class — the load path IS the sync path.' },
    { id: 'BR', label: 'RegistryApi answers over the fold', summary: 'The materialised fold answers queries; the node writes its presence with origin attribution; the first UI query is served.' },
  ],

  steps: [
    // ---- Phase BD: acquire the instance ----------------------------------
    {
      state: 'N1', phase: 'BD', kind: 'internal', from: 'local1', frame: 'FOLD',
      label: 'open instance dir + lock',
      payload: { detail: { dir: '$HOME/.glade/sys/glade-local/', lock: 'instance.lock (single-writer, workspace.lock precedent)', cache: 'cache/ present — class-4, rebuildable, never load-bearing' } },
      note: 'The launch profile picks a default name (glade-local); the protocol never sees the profile. Nothing above StoreApi knows files exist.',
      docRef: `${GDS} · On-disk layout · GDL-036`,
      sets: { local1: { instance: 'glade-local (lock held)' } },
    },
    {
      state: 'N2', phase: 'BD', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'node.key → NodeId',
      payload: { detail: { key: 'node.key (class 1, mode 0600)', check: 'refuse group/world-readable — the ssh discipline', derive: 'NodeId = ed25519 pubkey', match: 'MUST equal our own NodeRecord in class 2' } },
      gate: { kind: 'security', label: 'node identity bind', status: 'designed', note: 'Possession IS the credential. Key replacement is identity LOSS (NodeId changes, the mesh rejects), never forgery — a tamperer who overwrites the key only announces themselves.' },
      note: 'Class-1 secrets are never shipped and never in any snapshot; the boot derives identity locally before touching a single record.',
      docRef: `${GDS} · Data classification (class 1)`,
      sets: { local1: { identity: 'NodeId derived (matches NodeRecord)' } },
    },

    // ---- Phase BV: load + validate ---------------------------------------
    {
      state: 'N3', phase: 'BV', kind: 'internal', from: 'local1', frame: 'HYDRATE',
      label: 'load SystemSnapshot blob',
      payload: { detail: { file: 'records.json (class 2)', shape: 'ONE taut SystemSnapshot{records, heads}', reading: 'a snapshot is a cached fold + heads (SubstrateV1 §2) — degenerate sync from a carrier named "the disk"', later: 'SQLite behind the SAME StoreApi; op-granular home-share sync behind the SAME RegistryApi' } },
      note: 'The interim impl (whole blob, rewritten on change) hides behind StoreApi. The test of the seam is this trace: no migration rung may change it.',
      docRef: `${GDS} · The non-negotiable shape · Migration ladder`,
      sets: { local1: { 'store': 'records.json: 14 records + heads (loaded)' } },
    },
    {
      state: 'Y2', phase: 'BV', kind: 'internal', from: 'local1', frame: 'FOLD',
      label: 'verify-as-ingest (class 2)',
      payload: { detail: { perOp: 'prev-hash continuity + origin signature + seq monotonicity', cost: 'O(1) per op, no whole-share view', onFail: 'Y3 — reject the op and its suffix, quarantine bytes as evidence, heal from a replica; policy records fail CLOSED (AZ-11)' } },
      gate: { kind: 'security', label: 'verify-as-ingest', status: 'designed', note: 'A malicious edit of the JSON is indistinguishable from a tampered sync chunk — and rejected the same way. There is no separate storage-security audit: hardening s-sync hardens boot for free.' },
      note: 'Signed replicated records self-authenticate at rest exactly as on the wire; the disk gets no more trust than any peer.',
      docRef: `${GDS} · Validation at load · s-sync Y2`,
      sets: { local1: { 'verify': 'class-2 records: all chains valid' } },
    },
    {
      state: 'N4', phase: 'BV', kind: 'internal', from: 'local1', frame: 'FOLD',
      label: 'class-3 fail-closed load',
      payload: { detail: { file: 'local.json (class 3 — node-private assertions)', items: 'authority overlay, suspect marks, trust-plug config, resume vectors', check: 'node-self-signature', onMismatch: 'discard each item to its declared MOST-restrictive default — never to "off"', bound: 'the overlay only ever NARROWS, so tamper cannot exceed granted rights' } },
      gate: { kind: 'security', label: 'class-3 self-signature', status: 'designed', note: 'Detects corruption and non-root tamper; it honestly does NOT stop local root (hardware trumps records). Every class-3 item MUST declare a fail-closed default — a failed check discards to the most restrictive value.' },
      note: 'Class 3 is never shipped (private judgments). Local root can change it and self-DoS — hardware trumps records — but cannot widen access. Class-4 cache/ then hash-checks or is discarded-and-refolded.',
      docRef: `${GDS} · Data classification (class 3/4)`,
      sets: { local1: { 'overlay': 'local.json: verified (fail-closed defaults ready)' } },
    },

    // ---- Phase BR: RegistryApi answers -----------------------------------
    {
      state: 'N5', phase: 'BR', kind: 'internal', from: 'local1', frame: 'FOLD',
      label: 'RegistryApi ready',
      payload: { detail: { queries: 'whoServes(ws) · replicasOf(share) · grantsFor(principal, share) · nodesOf(operator)', shape: 'reads are queries-over-fold, never getConfig(blob)', promise: 'a fold-backed impl slots in without any caller changing' } },
      note: 'The anti-pattern named and refused: a get/set-config-object API couples every caller to blob shape. If the interim API could not be re-implemented over folds untouched, it would be wrong.',
      docRef: `${GDS} · The non-negotiable shape (reads)`,
      sets: { local1: { 'registry': 'ready (fold: 3 workspaces, 1 claim, grants)' } },
    },
    {
      state: 'K1', phase: 'BR', kind: 'internal', from: 'local1', frame: 'APPEND',
      label: 'write presence — origin attributed',
      payload: { share: 'home', detail: { op: 'append(NodeRecord{glade-local}) + append(ServeClaim{glade-local, lease 30s})', origin: 'attributed to node.key EVEN in blob-land', why: 'so migration to per-origin logs is mechanical — writes are record APPENDS, never setConfig(blob)' } },
      note: 'The node announces itself the same way it announces everything: an attributed append. The blob is rewritten tmp+rename (crash-atomic); origin attribution rides every record from day one.',
      docRef: `${GDS} · The non-negotiable shape (writes) · ${WD} §2`,
      sets: { local1: { 'store': 'records.json: 16 records (+NodeRecord, +ServeClaim origin=glade-local)' } },
    },
    {
      state: 'A1', phase: 'BR', kind: 'message', from: 'gryth1', to: 'local1', frame: 'HELLO',
      label: 'first UI session opens',
      payload: { detail: { session: 'sess-b01', principal: 'gianni (asserted)' } },
      gate: { kind: 'security', label: 'HELLO principal seam', status: 'stub-allow-all', note: 'Principal asserted at HELLO; the enforcement hook is a no-op in v1 — the retrofit seam ships now, unchanged from the discovery golden path.' },
      note: 'Boot is finished before any client connects: the node served itself from its own disk first.',
      docRef: `${WD} §2`,
      sets: { local1: { 'session gryth1': 'open (principal asserted)' } },
    },
    {
      state: 'A3', phase: 'BR', kind: 'message', from: 'gryth1', to: 'local1', frame: 'SUBSCRIBE',
      label: 'subscribe: workspace directory',
      payload: { share: 'home', gladeId: 'dir.workspaces', key: '∅ (unkeyed)', shape: 'log' },
      note: 'The directory is the home share — the first thing every UI asks for. This is a RegistryApi query in disguise.',
      docRef: `${WD} §2`,
      sets: { local1: { 'sub home/dir.workspaces': 'gryth1' }, gryth1: { subs: 'home/dir.workspaces' } },
    },
    {
      state: 'A4', phase: 'BR', kind: 'internal', from: 'local1', frame: 'FOLD',
      label: 'answer over the fold',
      payload: { share: 'home', detail: { query: 'RegistryApi.replicasOf(home) + whoServes(*)', answer: 'read straight off the materialised fold — no getConfig, no disk re-read' } },
      note: 'The query hits the fold that boot already built. Whether that fold came from a blob or op-granular sync is invisible here — that is the seam working.',
      docRef: `${GDS} · The non-negotiable shape (reads) · ${WD} §3`,
      sets: { local1: { 'fold home': '3 WorkspaceEntry + this node’s claim' } },
    },
    {
      state: 'A5', phase: 'BR', kind: 'message', from: 'local1', to: 'gryth1', frame: 'OPS',
      label: 'workspace entries', response: true,
      payload: { share: 'home', gladeId: 'dir.workspaces', shape: 'log', detail: { ops: 'WorkspaceEntry ×3 (origin-attributed)' } },
      note: 'The UI renders the list from the fold — the exact same observable serve the discovery trace shows, now traced back to a cold boot off disk.',
      docRef: `${WD} §2`,
      sets: { gryth1: { view: '3 workspaces (from cold boot)' } },
    },
  ],
};
