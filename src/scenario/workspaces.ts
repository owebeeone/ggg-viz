// glade-workspaces spine traces (GLP-0006), stage 1 — hosting, selection,
// materialization, and clone-born replicas.
//
// The hosting model (glade-workspaces §1): a peer hosts any number of
// workspaces; a hosted workspace IS a gwz workspace on that peer's disk — a
// root with 0–N member repos. Glade's WorkspaceEntry/ServeClaim records are the
// DIRECTORY VIEW of it; the gwz tree is the substance. The name→root mapping is
// APP-OWNED (the data seam, GladeSupplierModel §5): it never rides a request and
// is never derivable from one.
//
// MODELING NOTE (a real design observation — see the trace tests + the returned
// ambiguities): unlike glade-chat / glade-users, glade-workspaces is NOT one
// wire-attached supplier session. Its responsibilities are distributed by the
// spec's own §4 split — the DIRECTORY is the home share (folded by the node,
// as in s-discovery/s-create); SELECTION is client-context (grip-side);
// MATERIALIZATION happens on the target host peer; MEMBER ENUMERATION is served
// from the host's gwz tree. So these traces compose glade-workspaces onto the
// existing node + host-peer + client actors (embedding = a composition
// optimization, GladeSupplierModel §2), rather than minting a standalone
// `ws-sup`. The host peer contributes records; the node folds the directory;
// the client selects.
import type { Scenario } from './types';
import { pick } from './actors';

const GW = 'glade-workspaces';
const SM = 'GladeSupplierModel';
const WD = 'GladeWorkspaceDirectory';

// ---------------------------------------------------------------------------
// s-ws-host — one peer hosts two workspaces; directory lists both with
// claim/liveness; a client's selection drives which workspace a tool targets.
// ---------------------------------------------------------------------------
export const S_WS_HOST: Scenario = {
  id: 's-ws-host',
  stage: 1,
  title: 'Workspace host — two workspaces, selection drives the target',
  summary:
    'peer1 hosts TWO gwz workspaces — ws-alpha (3 members) and ws-beta (0 members, rendered honestly) — mapping each name to its real gwz root via its own app-owned composition. The directory lists both with claim/liveness; the client enumerates members; and the client’s selection (a grip-side value) drives which workspace a gwz tool request targets.',

  actors: pick('gryth1', 'local1', 'peer1'),

  initial: {
    gryth1: { session: 'local1 (open)', view: 'workspaces' },
    local1: { 'session gryth1': 'open', 'sub home/dir.workspaces': 'gryth1', links: 'peer1 (iroh)' },
    peer1: { 'sub home': 'local1 (mesh)', gwz: 'idle' },
  },

  phases: [
    { id: 'WH', label: 'Host two workspaces', summary: 'peer1 maps two workspace names to their real gwz roots (app-owned), writes a WorkspaceEntry for each, and claims both — one with members, one empty.' },
    { id: 'WD', label: 'Directory + member enumeration', summary: 'The client lists both workspaces with claim/liveness and enumerates members; the empty workspace enumerates honestly.' },
    { id: 'WS', label: 'Selection drives the tool target', summary: 'The client selects a workspace (a grip-side value); a gwz tool request resolves its target from the selection and routes to the host.' },
  ],

  steps: [
    // ---- Phase WH: host two workspaces -----------------------------------
    {
      state: 'X1', phase: 'WH', kind: 'internal', from: 'peer1', frame: 'FOLD',
      label: 'map hosted names → gwz roots (app-owned)',
      payload: { detail: { alpha: 'ws-alpha → /srv/gwz/alpha (gwz root, 3 members)', beta: 'ws-beta → /srv/gwz/beta (gwz root, 0 members)', seam: 'the name→path mapping is the peer’s OWN composition (grazel config/data dir) — it NEVER rides a request and is never derivable from one (§1.2, the data seam)' } },
      note: 'A hosted workspace IS a gwz workspace on this peer’s disk. Which name maps to which root is app-owned data; glade only ever sees the directory VIEW (WorkspaceEntry/ServeClaim), never the backing store.',
      docRef: `${GW} §1 · ${SM} §5`,
      sets: { peer1: { 'host ws-alpha': 'gwz root /srv/gwz/alpha (3 members)', 'host ws-beta': 'gwz root /srv/gwz/beta (0 members)' } },
    },
    {
      state: 'K1', phase: 'WH', kind: 'internal', from: 'peer1', frame: 'APPEND',
      label: 'directory entry: ws-alpha',
      payload: { share: 'home', detail: { op: 'WorkspaceEntry(ws-alpha, gwz-manifest: 3 members, eligible: [peer1])' } },
      note: 'The directory view of a hosted workspace is an ordinary home-share record — the gwz tree is the substance, this entry is how it becomes discoverable.',
      docRef: `${WD} §2 · ${GW} §1.1`,
      sets: { peer1: { 'origin log': '+WorkspaceEntry(ws-alpha)' } },
    },
    {
      state: 'K1', phase: 'WH', kind: 'internal', from: 'peer1', frame: 'APPEND',
      label: 'directory entry: ws-beta (zero members, legal)',
      payload: { share: 'home', detail: { op: 'WorkspaceEntry(ws-beta, gwz-manifest: 0 members, eligible: [peer1])', honest: 'a workspace with zero members is legal (freshly created, not yet populated) and MUST render honestly (§1.3)' } },
      note: 'The empty workspace is a first-class entry, not an error state. It exists on disk (gwz init’d) with no members yet.',
      docRef: `${GW} §1.3`,
      sets: { peer1: { 'origin log': '+WorkspaceEntry(ws-beta, 0 members)' } },
    },
    {
      state: 'H1', phase: 'WH', kind: 'internal', from: 'peer1', frame: 'LEASE',
      label: 'serve-claim: ws-alpha',
      payload: { detail: { claim: 'ServeClaim(ws-alpha, peer1, epoch 1)', basis: 'peer1 holds the local workspace.lock' } },
      note: 'A claim follows the lock; ws-alpha is now routable and its liveness is the lease.',
      docRef: `${WD} §4`,
      sets: { peer1: { 'claim ws-alpha': 'held — epoch 1', serving: 'ws-alpha via grazel' } },
    },
    {
      state: 'H1', phase: 'WH', kind: 'internal', from: 'peer1', frame: 'LEASE',
      label: 'serve-claim: ws-beta',
      payload: { detail: { claim: 'ServeClaim(ws-beta, peer1, epoch 1)', basis: 'the empty workspace is served too — it is live, just empty' } },
      note: 'The empty workspace is live and claimed like any other; liveness is independent of member count.',
      docRef: `${WD} §4`,
      sets: { peer1: { 'claim ws-beta': 'held — epoch 1' } },
    },
    {
      state: 'B9', phase: 'WH', kind: 'message', from: 'peer1', to: 'local1', frame: 'OPS',
      label: 'both entries + claims replicate',
      payload: { share: 'home', detail: { ops: 'WorkspaceEntry(ws-alpha) + WorkspaceEntry(ws-beta) + ServeClaim×2' } },
      note: 'Ordinary home-share replication: the node’s directory replica now holds both hosted workspaces with their liveness.',
      docRef: `${WD} §2`,
      sets: { local1: { 'fold home': '2 workspaces (ws-alpha live, ws-beta live) @peer1' } },
    },

    // ---- Phase WD: directory + member enumeration ------------------------
    {
      state: 'A3', phase: 'WD', kind: 'message', from: 'gryth1', to: 'local1', frame: 'SUBSCRIBE',
      label: 'subscribe: workspace directory',
      payload: { share: 'home', gladeId: 'dir.workspaces', key: '∅ (unkeyed)', shape: 'log' },
      note: 'The workspace list is the home-share directory — the same surface s-discovery reads.',
      docRef: `${WD} §2`,
      sets: { gryth1: { subs: 'home/dir.workspaces' } },
    },
    {
      state: 'A4', phase: 'WD', kind: 'internal', from: 'local1', frame: 'FOLD',
      label: 'fold the directory (claim/liveness)',
      payload: { share: 'home', detail: { fold: '2 WorkspaceEntry + 2 ServeClaim → both live @peer1' } },
      note: 'The directory fold carries claim/liveness state and eligible hosts per §2.1 — computed locally, offline-first.',
      docRef: `${WD} §3`,
      sets: { local1: { 'fold home (view)': 'ws-alpha (3 members, live) · ws-beta (0 members, live)' } },
    },
    {
      state: 'A5', phase: 'WD', kind: 'message', from: 'local1', to: 'gryth1', frame: 'OPS', response: true,
      label: 'both workspaces listed (with claim/liveness)',
      payload: { share: 'home', gladeId: 'dir.workspaces', shape: 'log', detail: { ops: 'ws-alpha (3 members, live @peer1) · ws-beta (0 members, live @peer1)', honest: 'ws-beta shows "0 members" — rendered honestly, not hidden' } },
      note: 'The client sees BOTH hosted workspaces with their liveness. The empty one is listed truthfully.',
      docRef: `${GW} §2.1 · §1.3`,
      sets: { gryth1: { view: '2 workspaces: ws-alpha (3, live) · ws-beta (0, live)' } },
    },
    {
      state: 'C1', phase: 'WD', kind: 'message', from: 'gryth1', to: 'local1', frame: 'SUBSCRIBE',
      label: 'enumerate members of ws-alpha',
      payload: { share: 'ws-alpha', gladeId: 'ws.members', key: '∅ (unkeyed)', shape: 'value' },
      note: 'Member repos are enumerable per §2.1 (name, path within the workspace, remote, pinned state — the gwz manifest/lock view served as a surface).',
      docRef: `${GW} §2.1`,
      sets: { gryth1: { subs: 'home/dir.workspaces + ws-alpha/ws.members' }, local1: { 'sub ws-alpha/ws.members': 'gryth1' } },
    },
    {
      state: 'C2', phase: 'WD', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'route ws.members to the host',
      payload: { share: 'ws-alpha', detail: { answer: 'peer1', basis: 'ServeClaim(ws-alpha) valid at projection time' } },
      gate: { kind: 'routing', label: 'ServeClaim lookup', status: 'designed', note: 'The member view is served by the host that owns the gwz tree — routed by the ServeClaim, like any keyed resource.' },
      note: 'Member enumeration is served from the host’s gwz tree; the node routes the interest to peer1.',
      docRef: `${WD} §4`,
      sets: { local1: { 'route ws-alpha': 'peer1 (claim valid)' } },
    },
    {
      state: 'C3', phase: 'WD', kind: 'message', from: 'local1', to: 'peer1', frame: 'SUBSCRIBE',
      label: 'forward member interest',
      payload: { share: 'ws-alpha', gladeId: 'ws.members', key: '∅', shape: 'value' },
      gate: { kind: 'capability', label: 'capability check', status: 'stub-allow-all', note: 'Read enforcement point at SUBSCRIBE; allow-all in stage 1.' },
      note: 'Interest lands at the host; the keyed entry map routes it to the gwz member surface.',
      docRef: `${SM} §2.2`,
      sets: { peer1: { 'sub ws-alpha/ws.members': 'local1' } },
    },
    {
      state: 'X2', phase: 'WD', kind: 'message', from: 'peer1', to: 'local1', frame: 'OPS',
      label: 'ws-alpha members enumerated',
      payload: { share: 'ws-alpha', gladeId: 'ws.members', shape: 'value', detail: { members: '3: {name: core, path: /core, remote: git@…/core, pinned: abc123} · {app, /app, …} · {docs, /docs, …}', source: 'the gwz manifest/lock view — served from the host’s tree, not glade storage' } },
      note: 'The member enumeration is the gwz manifest/lock view projected as a surface. glade-workspaces provides the surface; the DATA is the host’s gwz tree (the split, §4).',
      docRef: `${GW} §2.1 · §4`,
      sets: { local1: { 'fold ws-alpha/ws.members': '3 members (core, app, docs)' } },
    },
    {
      state: 'C6', phase: 'WD', kind: 'message', from: 'local1', to: 'gryth1', frame: 'OPS', response: true,
      label: 'members to the UI',
      payload: { share: 'ws-alpha', gladeId: 'ws.members', shape: 'value', detail: { members: '3 (core, app, docs)' } },
      note: 'The UI renders the member list; the consuming tap never learns where the data came from.',
      sets: { gryth1: { view: '… + ws-alpha members (core, app, docs)' } },
    },
    {
      state: 'X2', phase: 'WD', kind: 'message', from: 'peer1', to: 'local1', frame: 'OPS', variant: 'a',
      variantNote: 'The zero-member case: ws-beta enumerates an EMPTY member set — rendered honestly, not as an error or an omission.',
      label: 'ws-beta members: none (honest empty)',
      payload: { share: 'ws-beta', gladeId: 'ws.members', shape: 'value', detail: { members: '[] (0)', honest: 'the empty workspace enumerates truthfully — "no members yet", a legal state (§1.3)' } },
      note: 'A workspace with zero members enumerates as an empty list, honestly. The UI shows "ws-beta — no members yet", never a phantom or a failure.',
      docRef: `${GW} §1.3 · §2.1`,
      sets: { local1: { 'fold ws-beta/ws.members': '0 members (empty, honest)' } },
    },

    // ---- Phase WS: selection drives the tool target ----------------------
    {
      state: 'X3', phase: 'WS', kind: 'internal', from: 'gryth1', frame: 'ROUTE',
      label: 'select ws-alpha (client-context value)',
      payload: { detail: { selection: 'ws.selection = ws-alpha', nature: 'a grip-side value: the AVAILABLE set is the directory data, but WHICH one is selected is per-client-context (§2.1)', consumers: 'tool suppliers (gwz, files, terminal) key off this' } },
      note: 'Selection is client-context, not a replicated glade surface. The client holds ws.selection; the tool suppliers read it to know their target.',
      docRef: `${GW} §2.1`,
      sets: { gryth1: { 'ws.selection': 'ws-alpha (client-context)' } },
    },
    {
      state: 'D1', phase: 'WS', kind: 'message', from: 'gryth1', to: 'local1', frame: 'EXCHANGE',
      label: 'gwz: status (on the selected workspace)',
      payload: { gladeId: 'gwz.ops', shape: 'exchange', verb: 'workspace.status', correlationId: 'x-h1', detail: { target: 'resolved from ws.selection (= ws-alpha) — the request does not name the workspace, the selection does' } },
      note: 'The tool request targets whatever is selected. Re-selecting ws-beta would send the SAME request to ws-beta — the selection is the routing input.',
      docRef: `${GW} §2.1`,
      sets: { local1: { 'pending x-h1': 'gryth1 → status@selection' } },
    },
    {
      state: 'X4', phase: 'WS', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'selection resolves the target workspace',
      payload: { share: 'ws-alpha', detail: { selection: 'ws-alpha', resolvedShare: 'ws-alpha', then: 'route by ServeClaim(ws-alpha) → peer1', restated: 'this is the selection surface AS routing input — the tool keys off ws.selection' } },
      gate: { kind: 'routing', label: 'selection → target routing', status: 'designed', note: 'The selection picks the workspace; the ServeClaim picks the host. Stage 2 will additionally gate the verb (the s-verbs model) — routing stays the same.' },
      note: 'The selection drives which workspace’s share/root the gwz op addresses. Change the selection, change the target — with no change to the request.',
      docRef: `${GW} §2.1 · §2.3`,
      sets: { local1: { 'route tool': 'ws-alpha → peer1 (from selection)' } },
    },
    {
      state: 'D2', phase: 'WS', kind: 'message', from: 'local1', to: 'peer1', frame: 'EXCHANGE',
      label: 'forward to the selected host',
      payload: { share: 'ws-alpha', gladeId: 'gwz.ops', shape: 'exchange', verb: 'workspace.status', correlationId: 'x-h1' },
      note: 'Directed to the host of the selected workspace; corr preserved.',
      sets: { peer1: { 'pending x-h1': 'local1' } },
    },
    {
      state: 'D3', phase: 'WS', kind: 'internal', from: 'peer1', frame: 'PROVIDE',
      label: 'gwz-core executes on ws-alpha',
      payload: { detail: { engine: 'gwz-core', op: 'per-member git status on /srv/gwz/alpha', fence: 'workspace.lock held' } },
      note: 'The op runs against the SELECTED workspace’s working copy — the one the selection resolved to.',
      docRef: 'gwz-core README',
      sets: { peer1: { gwz: 'ws-alpha status: 3 clean' } },
    },
    {
      state: 'D4', phase: 'WS', kind: 'message', from: 'peer1', to: 'local1', frame: 'EXCHANGE-RESP',
      label: 'status result', response: true,
      payload: { correlationId: 'x-h1', detail: { members: '3 clean' } },
      note: 'Directed response, corr 1:1.',
      sets: { peer1: { 'pending x-h1': null } },
    },
    {
      state: 'D5', phase: 'WS', kind: 'message', from: 'local1', to: 'gryth1', frame: 'EXCHANGE-RESP',
      label: 'status to the UI', response: true,
      payload: { correlationId: 'x-h1' },
      note: 'The exchange completes at the requesting session — the tool operated on exactly the selected workspace.',
      sets: { local1: { 'pending x-h1': null }, gryth1: { view: '… + ws-alpha status (3 clean, via selection)' } },
    },
  ],
};

// ---------------------------------------------------------------------------
// s-ws-create — extends s-create with the MATERIALIZATION leg: records + disk
// commit-or-fail together; self and target-routed; failure mints no records.
// ---------------------------------------------------------------------------
export const S_WS_CREATE: Scenario = {
  id: 's-ws-create',
  stage: 1,
  title: 'Create a workspace — records + disk commit-or-fail together',
  summary:
    'The built workspace.create ceremony (s-create) gains its disk leg: gwz init materializes an empty workspace on the target peer and the directory records commit-or-fail TOGETHER (the records are downstream of disk success). Shown target-routed (to peer3) and self-routed (to the user’s own node), plus a failure where the disk refuses — minting NO records, the fold untouched.',

  actors: pick('gryth1', 'local1', 'peer3'),

  initial: {
    gryth1: { session: 'local1 (open)', view: 'workspaces' },
    local1: { 'session gryth1': 'open', 'sub home/dir.workspaces': 'gryth1', links: 'peer3 (iroh)' },
    peer3: { gwz: 'idle', 'sub home': 'local1 (mesh)' },
  },

  phases: [
    { id: 'MT', label: 'Target-routed create + materialize', summary: 'A create routes to the target peer; gwz init and the directory records commit-or-fail together on that peer.' },
    { id: 'MS', label: 'Self-routed create', summary: 'The same ceremony with the target being the user’s own node — no forward hop, same commit-or-fail.' },
    { id: 'MF', label: 'Failure as data', summary: 'The disk refuses; the ceremony mints NO records and answers failure as data — the fold is never touched.' },
  ],

  steps: [
    // ---- Phase MT: target-routed create ----------------------------------
    {
      state: 'D1', phase: 'MT', kind: 'message', from: 'gryth1', to: 'local1', frame: 'EXCHANGE',
      label: 'gwz: create workspace (empty) on peer3',
      payload: { gladeId: 'gwz.ops', shape: 'exchange', verb: 'workspace.create', correlationId: 'x-c1', detail: { name: 'ws-new', members: '0 (gwz init — empty)', target: 'peer3 (cloud-vm)' } },
      note: 'Creation names an explicit target — placement of a new working copy is a user/policy choice (GDL-016). This is the s-create request shape; the new part is the materialization below.',
      docRef: `${GW} §2.2 · gwz-core README`,
      sets: { local1: { 'pending x-c1': 'gryth1 → create@peer3' } },
    },
    {
      state: 'C2', phase: 'MT', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'route to the target (no claim exists yet)',
      payload: { detail: { target: 'peer3 — named in the request', note: 'creation is the one routed op that cannot consult a ServeClaim — it MAKES the thing claims will be about' } },
      gate: { kind: 'routing', label: 'create-target routing', status: 'designed', note: 'Routes by TARGET; stage 2 asks which principals may create workspaces on which nodes (GDL-016).' },
      note: 'The create routes to the explicit target peer.',
      docRef: 'GDL-016',
      sets: { local1: { 'route create': 'peer3 (explicit target)' } },
    },
    {
      state: 'D2', phase: 'MT', kind: 'message', from: 'local1', to: 'peer3', frame: 'EXCHANGE',
      label: 'forward create',
      payload: { gladeId: 'gwz.ops', shape: 'exchange', verb: 'workspace.create', correlationId: 'x-c1' },
      note: 'Same directed path as any gwz op.',
      sets: { peer3: { 'pending x-c1': 'local1' } },
    },
    {
      state: 'X5', phase: 'MT', kind: 'internal', from: 'peer3', frame: 'PROVIDE',
      label: 'materialize on disk (gwz init) — commit-or-fail',
      payload: { detail: { disk: 'gwz init /srv/gwz/ws-new — empty workspace, 0 members, workspace.lock created + held', atomicity: 'disk and the directory records commit-or-fail TOGETHER (§2.2) — the records below are a downstream consequence of THIS succeeding', order: 'disk FIRST; only on success do the WorkspaceEntry + ServeClaim commit' } },
      note: 'This is the leg s-create left as an external seam: the actual gwz init on the target’s disk. The lock exists from the first byte. Records are not written until the disk succeeds.',
      docRef: `${GW} §2.2`,
      sets: { peer3: { gwz: 'gwz init ws-new (empty, 0 members)', wc: 'ws-new checkout + lock HELD', materialized: 'disk OK → records commit' } },
    },
    {
      state: 'K1', phase: 'MT', kind: 'internal', from: 'peer3', frame: 'APPEND',
      label: 'directory entry (committed with the disk)',
      payload: { share: 'home', detail: { op: 'WorkspaceEntry(ws-new, 0 members, eligible: [peer3])', because: 'the disk leg succeeded — the record is the directory view of the now-real gwz root' } },
      note: 'The WorkspaceEntry commits because the disk did. Had the disk failed, this record would never exist (see phase MF).',
      docRef: `${WD} §2 · ${GW} §2.2`,
      sets: { peer3: { 'origin log': '+WorkspaceEntry(ws-new)' } },
    },
    {
      state: 'H1', phase: 'MT', kind: 'internal', from: 'peer3', frame: 'LEASE',
      label: 'first serve-claim',
      payload: { detail: { claim: 'ServeClaim(ws-new, peer3, epoch 1)', basis: 'lock already held from gwz init' } },
      note: 'Claim follows lock; ws-new (empty) is now routable.',
      docRef: `${WD} §4`,
      sets: { peer3: { 'claim ws-new': 'held — epoch 1', serving: 'ws-new via grazel' } },
    },
    {
      state: 'D4', phase: 'MT', kind: 'message', from: 'peer3', to: 'local1', frame: 'EXCHANGE-RESP',
      label: 'create response (ok)', response: true,
      payload: { correlationId: 'x-c1', detail: { ok: 'true', workspace: 'ws-new (0 members)', committed: 'disk + records together' } },
      note: 'Per-workspace result rides back; the ceremony and the materialization succeeded as one.',
      sets: { peer3: { 'pending x-c1': null } },
    },
    {
      state: 'D5', phase: 'MT', kind: 'message', from: 'local1', to: 'gryth1', frame: 'EXCHANGE-RESP',
      label: 'response to UI', response: true,
      payload: { correlationId: 'x-c1' },
      note: 'The exchange is done — the LIST update arrives separately, as replication.',
      sets: { local1: { 'pending x-c1': null } },
    },
    {
      state: 'B9', phase: 'MT', kind: 'message', from: 'peer3', to: 'local1', frame: 'OPS',
      label: 'directory ops replicate',
      payload: { share: 'home', detail: { ops: 'WorkspaceEntry(ws-new) + ServeClaim(epoch 1)' } },
      note: 'The same ops reach every replica.',
      sets: { local1: { 'fold home': 'ws-new@peer3 (empty, live)' } },
    },
    {
      state: 'B9', phase: 'MT', kind: 'message', from: 'local1', to: 'gryth1', frame: 'OPS', response: true,
      label: 'the list grows (ws-new)',
      payload: { share: 'home', gladeId: 'dir.workspaces', detail: { ops: 'ws-new appears (0 members)' } },
      note: 'Discoverability = an op in the directory share.',
      sets: { gryth1: { view: '+ ws-new (empty, live @peer3)' } },
    },

    // ---- Phase MS: self-routed create ------------------------------------
    {
      state: 'D1', phase: 'MS', kind: 'message', from: 'gryth1', to: 'local1', frame: 'EXCHANGE',
      label: 'gwz: create workspace on SELF',
      payload: { gladeId: 'gwz.ops', shape: 'exchange', verb: 'workspace.create', correlationId: 'x-c2', detail: { name: 'ws-local', members: '0', target: 'local1 (the user’s own node)' } },
      note: 'The same ceremony, target = self. Creation on the local node is not a special case — just a different target.',
      docRef: `${GW} §2.2`,
      sets: { local1: { 'pending x-c2': 'gryth1 → create@self' } },
    },
    {
      state: 'C2', phase: 'MS', kind: 'internal', from: 'local1', frame: 'ROUTE', variant: 'a',
      variantNote: 'Self-routed: the target IS the node handling the request, so there is no forward hop — materialization happens in-process.',
      label: 'route to self (no forward hop)',
      payload: { detail: { target: 'local1 (self)', hop: 'none — materialize locally' } },
      gate: { kind: 'routing', label: 'create-target routing', status: 'designed', note: 'Same routing decision, target resolves to self.' },
      note: 'When the target is the user’s own node, the create materializes in-process — the P00-a embedding case.',
      docRef: 'GDL-016 · ' + SM + ' §2',
      sets: { local1: { 'route create': 'self (local materialize)' } },
    },
    {
      state: 'X5', phase: 'MS', kind: 'internal', from: 'local1', frame: 'PROVIDE',
      label: 'materialize on the local disk — commit-or-fail',
      payload: { detail: { disk: 'gwz init ~/.gwz/ws-local — empty, lock held', atomicity: 'disk + records commit-or-fail together, on self' } },
      note: 'The self-routed materialization: the user’s own node does the gwz init and commits the records together — identical contract, shorter transport.',
      docRef: `${GW} §2.2`,
      sets: { local1: { gwz: 'gwz init ws-local (empty)', wc: 'ws-local checkout + lock HELD', materialized: 'disk OK → records commit' } },
    },
    {
      state: 'K1', phase: 'MS', kind: 'internal', from: 'local1', frame: 'APPEND',
      label: 'directory entry (self)',
      payload: { share: 'home', detail: { op: 'WorkspaceEntry(ws-local, 0 members, eligible: [local1])' } },
      note: 'The local node writes the directory entry under its own device chain.',
      docRef: `${WD} §2`,
      sets: { local1: { 'origin log': '+WorkspaceEntry(ws-local)', 'fold home': '+ ws-local@self (empty, live)' } },
    },
    {
      state: 'H1', phase: 'MS', kind: 'internal', from: 'local1', frame: 'LEASE',
      label: 'self serve-claim',
      payload: { detail: { claim: 'ServeClaim(ws-local, local1, epoch 1)', basis: 'local lock held' } },
      note: 'The local node claims its own new workspace.',
      docRef: `${WD} §4`,
      sets: { local1: { 'claim ws-local': 'held — epoch 1' } },
    },
    {
      state: 'D5', phase: 'MS', kind: 'message', from: 'local1', to: 'gryth1', frame: 'EXCHANGE-RESP',
      label: 'self-create response', response: true,
      payload: { correlationId: 'x-c2', detail: { ok: 'true', workspace: 'ws-local (0 members, on self)' } },
      note: 'The self-routed exchange completes with no forward leg — one node did it all.',
      sets: { local1: { 'pending x-c2': null }, gryth1: { view: '+ ws-local (empty, live @self)' } },
    },

    // ---- Phase MF: failure as data ---------------------------------------
    {
      state: 'D1', phase: 'MF', kind: 'message', from: 'gryth1', to: 'local1', frame: 'EXCHANGE',
      label: 'gwz: create ws-dup on peer3 (will fail)',
      payload: { gladeId: 'gwz.ops', shape: 'exchange', verb: 'workspace.create', correlationId: 'x-c3', detail: { name: 'ws-dup', target: 'peer3', note: 'a path collision awaits on disk' } },
      note: 'Same request shape — failure is a property of the materialization, not the ask.',
      docRef: `${GW} §2.2`,
      sets: { local1: { 'pending x-c3': 'gryth1 → create@peer3' } },
    },
    {
      state: 'D2', phase: 'MF', kind: 'message', from: 'local1', to: 'peer3', frame: 'EXCHANGE',
      label: 'forward create',
      payload: { gladeId: 'gwz.ops', shape: 'exchange', verb: 'workspace.create', correlationId: 'x-c3' },
      note: 'Routed to the target.',
      sets: { peer3: { 'pending x-c3': 'local1' } },
    },
    {
      state: 'X6', phase: 'MF', kind: 'internal', from: 'peer3', frame: 'PROVIDE',
      label: 'materialization FAILS — no records minted',
      payload: { detail: { disk: 'gwz init /srv/gwz/ws-dup → REFUSED (path already exists / no permission)', commitOrFail: 'the commit-or-fail contract (§2.2): the disk leg failed, so NO WorkspaceEntry and NO ServeClaim are written', fold: 'untouched — there is no half-created workspace anywhere' } },
      note: 'The disk refuses; the ceremony mints NOTHING. There is no WorkspaceEntry to clean up, no dangling claim — failure leaves the fold exactly as it was.',
      docRef: `${GW} §2.2`,
      sets: { peer3: { 'create ws-dup': 'FAILED — disk refused (path exists)', materialized: 'none — no records (commit-or-fail)' } },
    },
    {
      state: 'D4', phase: 'MF', kind: 'message', from: 'peer3', to: 'local1', frame: 'EXCHANGE-RESP',
      label: 'create response (ok:false)', response: true,
      payload: { correlationId: 'x-c3', detail: { ok: 'false', error: 'disk refused: /srv/gwz/ws-dup exists', minted: 'nothing' } },
      note: 'Failure is data: a directed ok:false response with the reason, corr intact.',
      docRef: `${SM} §2.4`,
      sets: { peer3: { 'pending x-c3': null } },
    },
    {
      state: 'D5', phase: 'MF', kind: 'message', from: 'local1', to: 'gryth1', frame: 'EXCHANGE-RESP',
      label: 'failure surfaced to the UI', response: true,
      payload: { correlationId: 'x-c3', detail: { result: 'create failed', reason: 'path exists', workspaces: 'unchanged — ws-dup was never minted' } },
      note: 'The UI shows the reason; the workspace list is unchanged. No records were minted, so nothing replicates.',
      sets: { local1: { 'pending x-c3': null }, gryth1: { view: 'ws-dup create FAILED (path exists) — nothing minted' } },
    },
  ],
};

// ---------------------------------------------------------------------------
// s-ws-clone — a second peer materializes via gwz clone, registers eligibility,
// and the directory converges to two eligible hosts. glade carries only records.
// ---------------------------------------------------------------------------
export const S_WS_CLONE: Scenario = {
  id: 's-ws-clone',
  stage: 1,
  title: 'Clone a workspace — a second host is born',
  summary:
    'peer2 materializes ws-shared via gwz clone from peer1 — the tree transfers over gwz/git remotes (the v1 lean), glade carrying ONLY the records. peer2 registers eligibility on the existing WorkspaceEntry and advertises its fresh replica; the directory converges to TWO eligible hosts for one workspace. Clone-from-existing IS how a second host/replica is born.',

  actors: pick('gryth1', 'local1', 'peer1', 'peer2'),

  initial: {
    gryth1: { session: 'local1 (open)', view: 'ws-shared (1 host)' },
    local1: {
      'session gryth1': 'open',
      'sub home/dir.workspaces': 'gryth1',
      'fold home': 'ws-shared — eligible: [peer1], serving: peer1 (epoch 1)',
      links: 'peer1, peer2 (iroh)',
    },
    peer1: { 'host ws-shared': 'gwz root /srv/gwz/shared', 'claim ws-shared': 'held — epoch 1', serving: 'ws-shared via grazel', 'sub home': 'local1 (mesh)' },
    peer2: { gwz: 'idle', 'sub home': 'local1 (mesh)' },
  },

  phases: [
    { id: 'CL', label: 'Clone from the source', summary: 'A clone-mode create targets peer2; it materializes ws-shared via gwz clone from peer1 over git remotes — glade carries only the records.' },
    { id: 'CE', label: 'Register eligibility + advertise', summary: 'peer2 adds itself to the WorkspaceEntry’s eligible hosts and advertises its fresh replica (leased).' },
    { id: 'CV', label: 'Converge to two hosts', summary: 'The directory converges: ws-shared now has two eligible hosts — peer1 serving, peer2 warm.' },
  ],

  steps: [
    // ---- Phase CL: clone from the source ---------------------------------
    {
      state: 'D1', phase: 'CL', kind: 'message', from: 'gryth1', to: 'local1', frame: 'EXCHANGE',
      label: 'gwz: create (clone) ws-shared onto peer2',
      payload: { gladeId: 'gwz.ops', shape: 'exchange', verb: 'workspace.create', correlationId: 'x-cl1', detail: { name: 'ws-shared', mode: 'clone-from-existing', source: 'peer1 (the current host)', target: 'peer2' } },
      note: 'Cloning an existing workspace is how a second peer becomes an eligible host/replica (§2.2). Same create verb, clone mode.',
      docRef: `${GW} §2.2`,
      sets: { local1: { 'pending x-cl1': 'gryth1 → clone@peer2' } },
    },
    {
      state: 'C2', phase: 'CL', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'route to the target host',
      payload: { detail: { target: 'peer2 — the node that will hold the new replica' } },
      gate: { kind: 'routing', label: 'create-target routing', status: 'designed', note: 'Routes by target; the source is a parameter of the materialization, not a routing decision.' },
      note: 'The clone routes to the new host peer2; peer1 is the source it will pull from.',
      docRef: 'GDL-016',
      sets: { local1: { 'route create': 'peer2 (clone target)' } },
    },
    {
      state: 'D2', phase: 'CL', kind: 'message', from: 'local1', to: 'peer2', frame: 'EXCHANGE',
      label: 'forward the clone create',
      payload: { gladeId: 'gwz.ops', shape: 'exchange', verb: 'workspace.create', correlationId: 'x-cl1' },
      note: 'Directed to peer2.',
      sets: { peer2: { 'pending x-cl1': 'local1' } },
    },
    {
      state: 'X7', phase: 'CL', kind: 'internal', from: 'peer2', frame: 'PROVIDE',
      label: 'materialize via gwz clone (git remotes)',
      payload: { detail: { engine: 'gwz clone ws-shared from peer1', transport: 'gwz/git remotes — the tree transfers at the git level; glade carries ONLY the records (the v1 lean, §7 OQ)', result: 'a full checkout of ws-shared on peer2, workspace.lock held' } },
      note: 'The heavy tree transfer rides gwz/git remotes (the machinery already exists); glade never carries file content. This is the resolved v1 lean of the clone-transport open question.',
      docRef: `${GW} §2.2 · §7`,
      sets: { peer2: { gwz: 'gwz clone ws-shared from peer1 (git remotes)', wc: 'ws-shared checkout + lock HELD', transport: 'git-level (glade carries only records)' } },
    },

    // ---- Phase CE: register eligibility + advertise ----------------------
    {
      state: 'X8', phase: 'CE', kind: 'internal', from: 'peer2', frame: 'APPEND',
      label: 'register replica eligibility',
      payload: { share: 'home', detail: { op: 'WorkspaceEntry(ws-shared) update — eligible hosts: [peer1] → [peer1, peer2]', meaning: 'peer2 declares it can host/serve ws-shared; this is HOW a second host is born (§2.2)' } },
      note: 'peer2 adds itself to the existing entry’s eligible-host set. Eligibility (can take over) is what grows to two — the active serve is still resolved by the lease model.',
      docRef: `${GW} §2.2 · ${WD} §2`,
      sets: { peer2: { 'origin log': '+WorkspaceEntry(ws-shared, eligible +peer2)', 'eligible ws-shared': 'peer2 (registered)' } },
    },
    {
      state: 'M3', phase: 'CE', kind: 'internal', from: 'peer2', frame: 'LEASE',
      label: 'advertise the fresh replica (leased)',
      payload: { detail: { hint: 'ReplicaHint(ws-shared, peer2) — a fresh verified replica, leased', role: 'warm eligible host: feeds nearest-replica routing and is ready to take over (s-takeover) — WITHOUT displacing peer1’s live epoch-1 claim' } },
      note: 'peer2 advertises its replica per the lease model. It does not seize the serve — peer1 keeps its epoch-1 claim; peer2 is a warm, eligible second host.',
      docRef: `${WD} §4 · ${GW} §2.2`,
      sets: { peer2: { 'replica ws-shared': 'fresh (gwz clone) — advertised (leased)' } },
    },

    // ---- Phase CV: converge to two hosts ---------------------------------
    {
      state: 'B9', phase: 'CV', kind: 'message', from: 'peer2', to: 'local1', frame: 'OPS',
      label: 'eligibility + replica hint replicate',
      payload: { share: 'home', detail: { ops: 'WorkspaceEntry(ws-shared, eligible: [peer1, peer2]) + ReplicaHint(peer2)' } },
      note: 'Ordinary home-share replication carries the records — and ONLY the records; the cloned tree never touched glade.',
      docRef: `${WD} §2`,
      sets: { local1: { 'fold home': 'ws-shared — eligible: [peer1, peer2], serving: peer1 (epoch 1)' } },
    },
    {
      state: 'D4', phase: 'CV', kind: 'message', from: 'peer2', to: 'local1', frame: 'EXCHANGE-RESP',
      label: 'clone response (ok)', response: true,
      payload: { correlationId: 'x-cl1', detail: { ok: 'true', workspace: 'ws-shared cloned onto peer2', eligible: 'peer2 registered' } },
      note: 'The clone ceremony completes: materialized + eligible.',
      sets: { peer2: { 'pending x-cl1': null } },
    },
    {
      state: 'D5', phase: 'CV', kind: 'message', from: 'local1', to: 'gryth1', frame: 'EXCHANGE-RESP',
      label: 'response to UI', response: true,
      payload: { correlationId: 'x-cl1' },
      note: 'The exchange is done; the directory convergence arrives as replication.',
      sets: { local1: { 'pending x-cl1': null } },
    },
    {
      state: 'B9', phase: 'CV', kind: 'message', from: 'local1', to: 'gryth1', frame: 'OPS', response: true,
      label: 'directory converges to two hosts',
      payload: { share: 'home', gladeId: 'dir.workspaces', detail: { ops: 'ws-shared — eligible hosts: [peer1, peer2]', converged: 'one workspace, two eligible hosts — peer1 serving, peer2 warm/ready' } },
      note: 'The user-testable win: ws-shared now shows two eligible hosts. A clone became a second replica through ordinary records; a takeover (s-takeover) could shift the active serve to peer2 with no new machinery.',
      docRef: `${GW} §6 · ${WD} §4`,
      sets: { gryth1: { view: 'ws-shared — 2 eligible hosts (peer1 serving, peer2 warm)' } },
    },
  ],
};

// ---------------------------------------------------------------------------
// s-ws-select-by-id (E-ws-1, H-C3) — the addressed STABLE WORKSPACE ID is the
// SOLE authority input. Two workspaces share the display name "razel"; the node
// routes by ID (never the name), the authority resolves ID→root from its
// app-owned map, and a request that ASSERTS a mismatching root FAILS CLOSED.
// Display names never route; duplicates are tolerated (H-C3).
// ---------------------------------------------------------------------------
export const S_WS_SELECT_BY_ID: Scenario = {
  id: 's-ws-select-by-id',
  stage: 1,
  title: 'Select by stable ID — the addressed ID is the sole authority input',
  summary:
    'peer1 hosts TWO workspaces that share the display name "razel" but have distinct stable IDs (ws-7a2, ws-9c4) mapping to distinct gwz roots. Selection addresses a workspace by its STABLE ID (E-ws-1); the node routes by ID (names never route — duplicates tolerated, H-C3); the authority resolves ID→root from its app-owned map. The positive arm targets ws-7a2 correctly; the DENY arm sends a request ASSERTING a root that mismatches the ID→root resolution — the authority trusts the ID, not the assertion, and FAILS CLOSED.',

  actors: pick('gryth1', 'local1', 'peer1'),

  initial: {
    gryth1: { session: 'local1 (open)', view: 'workspaces' },
    local1: { 'session gryth1': 'open', 'sub home/dir.workspaces': 'gryth1', links: 'peer1 (iroh)' },
    peer1: { 'sub home': 'local1 (mesh)', gwz: 'idle' },
  },

  phases: [
    { id: 'IB', label: 'Host two same-named workspaces', summary: 'peer1 maps two DISTINCT stable IDs (both display-named "razel") to distinct gwz roots, writes an entry + claim for each, and the directory replicates — duplicates tolerated (H-C3).' },
    { id: 'IS', label: 'Select + route by stable ID', summary: 'The client lists both (disambiguated by ID), selects ws-7a2 by its STABLE ID, and a gwz op routes by ID to the host, which resolves ID→root and executes (E-ws-1).' },
    { id: 'ID', label: 'Asserted root mismatch fails closed', summary: 'A request addressed ws-7a2 but ASSERTING the OTHER workspace’s root is refused: the authority resolves ID→root itself and trusts the addressed ID, never the asserted root (E-ws-1, fail closed).' },
  ],

  steps: [
    // ---- Phase IB: host two same-named workspaces ------------------------
    {
      state: 'X1', phase: 'IB', kind: 'internal', from: 'peer1', frame: 'FOLD',
      label: 'map two stable IDs → distinct gwz roots (app-owned)',
      payload: { detail: { a: 'ws-7a2 (display "razel") → /srv/gwz/razel-a (gwz root)', b: 'ws-9c4 (display "razel") → /srv/gwz/razel-b (gwz root)', seam: 'the STABLE ID → root map is the peer’s OWN composition (the data seam) — it never rides a request and is never derivable from one (§1.2)', names: 'the display name "razel" is shared by both — display-only, NEVER a routing/authority input (§1.2, H-C3)' } },
      note: 'The stable workspace ID is the sole routing + authorization identity (E-ws-1). Two workspaces may share a display name; the ID→root map disambiguates them and never rides the wire. Display names never route.',
      docRef: `${GW} §1.2 · ${SM} §5`,
      sets: { peer1: { 'host ws-7a2': 'gwz root /srv/gwz/razel-a (display "razel")', 'host ws-9c4': 'gwz root /srv/gwz/razel-b (display "razel")' } },
    },
    {
      state: 'K1', phase: 'IB', kind: 'internal', from: 'peer1', frame: 'APPEND',
      label: 'directory entry: ws-7a2 (name "razel")',
      payload: { share: 'home', detail: { op: 'WorkspaceEntry(id: ws-7a2, display: "razel", eligible: [peer1])', keyedBy: 'the record is keyed by the STABLE ID; the display name is a mere attribute' } },
      note: 'The directory entry carries the stable ID as identity and the display name as a non-routing attribute (H-C3).',
      docRef: `${WD} §2 · ${GW} §1.2`,
      sets: { peer1: { 'origin log': '+WorkspaceEntry(ws-7a2, "razel")' } },
    },
    {
      state: 'K1', phase: 'IB', kind: 'internal', from: 'peer1', frame: 'APPEND',
      label: 'directory entry: ws-9c4 (also "razel", distinct ID)',
      payload: { share: 'home', detail: { op: 'WorkspaceEntry(id: ws-9c4, display: "razel", eligible: [peer1])', dup: 'a SECOND workspace with the SAME display name — tolerated, no unique name-claim (H-C3)' } },
      note: 'Duplicate display names are legal — routing is by stable ID, so "razel" collisions never ambiguate (H-C3). The UI disambiguates with an ID suffix.',
      docRef: `${GW} §1.2 · §7`,
      sets: { peer1: { 'origin log': '+WorkspaceEntry(ws-9c4, "razel")' } },
    },
    {
      state: 'H1', phase: 'IB', kind: 'internal', from: 'peer1', frame: 'LEASE',
      label: 'serve-claims for both (distinct subjects)',
      payload: { detail: { claims: 'ServeClaim(ws-7a2, peer1, epoch 1) + ServeClaim(ws-9c4, peer1, epoch 1)', keyedBy: 'each claim is keyed by the stable ID — the shared display name is irrelevant to routing' } },
      note: 'Both workspaces are routable, claimed by stable ID. Two claims coexist because the SUBJECTS differ (ws-7a2 vs ws-9c4), not the epoch.',
      docRef: `${WD} §4`,
      sets: { peer1: { 'claim ws-7a2': 'held — epoch 1', 'claim ws-9c4': 'held — epoch 1', serving: 'ws-7a2 + ws-9c4 via grazel' } },
    },
    {
      state: 'B9', phase: 'IB', kind: 'message', from: 'peer1', to: 'local1', frame: 'OPS',
      label: 'both entries + claims replicate',
      payload: { share: 'home', detail: { ops: 'WorkspaceEntry×2 (both "razel") + ServeClaim×2 — keyed by stable ID' } },
      note: 'Ordinary home-share replication: the node’s directory holds two same-named workspaces distinguished by their stable IDs.',
      docRef: `${WD} §2`,
      sets: { local1: { 'fold home': 'ws-7a2 "razel" (live) · ws-9c4 "razel" (live) @peer1' } },
    },

    // ---- Phase IS: select + route by stable ID ---------------------------
    {
      state: 'A3', phase: 'IS', kind: 'message', from: 'gryth1', to: 'local1', frame: 'SUBSCRIBE',
      label: 'subscribe: workspace directory',
      payload: { share: 'home', gladeId: 'dir.workspaces', key: '∅ (unkeyed)', shape: 'log' },
      note: 'The client reads the directory — it will see two "razel" entries, disambiguated by ID.',
      docRef: `${WD} §2`,
      sets: { gryth1: { subs: 'home/dir.workspaces' } },
    },
    {
      state: 'A5', phase: 'IS', kind: 'message', from: 'local1', to: 'gryth1', frame: 'OPS', response: true,
      label: 'both "razel" workspaces listed (ID-disambiguated)',
      payload: { share: 'home', gladeId: 'dir.workspaces', shape: 'log', detail: { ops: 'razel·7a2 (live @peer1) · razel·9c4 (live @peer1)', disambig: 'same display name → the UI renders an ID suffix so the two are distinguishable (H-C3); the NAME is never the identity' } },
      note: 'Two identically-named workspaces render honestly, disambiguated by stable-ID suffix. Selection cannot key off the name — it keys off the ID.',
      docRef: `${GW} §1.2 · §7`,
      sets: { gryth1: { view: '2× "razel": razel·7a2 (live) · razel·9c4 (live)' } },
    },
    {
      state: 'X3', phase: 'IS', kind: 'internal', from: 'gryth1', frame: 'ROUTE',
      label: 'select ws-7a2 by its STABLE ID',
      payload: { detail: { selection: 'ws.selection = ws-7a2 (the stable ID — NOT "razel")', why: 'the client addresses the workspace by its stable ID; the shared display name could not select unambiguously (E-ws-1)', consumers: 'tool suppliers key off this addressed ID' } },
      note: 'The selection surface ADDRESSES a workspace by stable ID (E-ws-1). Choosing "razel" would be ambiguous; choosing ws-7a2 is exact — the ID is the sole authority input.',
      docRef: `${GW} §1.2 · §3`,
      sets: { gryth1: { 'ws.selection': 'ws-7a2 (stable ID, client-context)' } },
    },
    {
      state: 'D1', phase: 'IS', kind: 'message', from: 'gryth1', to: 'local1', frame: 'EXCHANGE',
      label: 'gwz: status — addressed by stable ID ws-7a2',
      payload: { gladeId: 'gwz.ops', shape: 'exchange', verb: 'workspace.status', correlationId: 'x-sel1', detail: { addressed: 'ws-7a2 (the stable ID resolved from ws.selection) — the SOLE authority input; the request carries no root and no name to route on' } },
      note: 'The tool request addresses the workspace by its stable ID only. No display name, no root path rides the request — the ID is authoritative (E-ws-1).',
      docRef: `${GW} §1.2 · §2.3`,
      sets: { local1: { 'pending x-sel1': 'gryth1 → status@ws-7a2' } },
    },
    {
      state: 'C2', phase: 'IS', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'route by stable ID → host',
      payload: { share: 'ws-7a2', detail: { answer: 'peer1', basis: 'ServeClaim(ws-7a2) — the node routes on the stable ID; the shared display name never enters routing' } },
      gate: { kind: 'routing', label: 'ServeClaim lookup (by stable ID)', status: 'designed', note: 'Routing is keyed by the stable workspace ID (E-ws-1); a display-name collision cannot misroute because the name is never consulted.' },
      note: 'The node routes the op by stable ID to the claim-holder. Duplicate "razel" names are invisible to routing (H-C3).',
      docRef: `${WD} §4 · ${GW} §1.2`,
      sets: { local1: { 'route ws-7a2': 'peer1 (claim valid, by ID)' } },
    },
    {
      state: 'D2', phase: 'IS', kind: 'message', from: 'local1', to: 'peer1', frame: 'EXCHANGE',
      label: 'forward to the host (carrying the stable ID)',
      payload: { share: 'ws-7a2', gladeId: 'gwz.ops', shape: 'exchange', verb: 'workspace.status', correlationId: 'x-sel1' },
      note: 'Directed to peer1; the request still names only the stable ID.',
      sets: { peer1: { 'pending x-sel1': 'local1' } },
    },
    {
      state: 'X4', phase: 'IS', kind: 'internal', from: 'peer1', frame: 'ROUTE',
      label: 'authority resolves ID→root (app-owned map)',
      payload: { share: 'ws-7a2', detail: { resolve: 'ws-7a2 → /srv/gwz/razel-a', basis: 'the authority’s OWN app-owned ID→root map (X1) — the request asserts nothing to override it', restated: 'the authority trusts the addressed stable ID and resolves the root itself (E-ws-1)' } },
      gate: { kind: 'routing', label: 'ID→root resolution', status: 'designed', note: 'The host resolves the stable ID to its real gwz root from its own composition; the ID is the input, the root is derived here — never asserted by the caller (E-ws-1).' },
      note: 'The host — the authority for the workspace — resolves ID→root from its app-owned map. This is the resolution the deny arm tries (and fails) to override.',
      docRef: `${GW} §1.2 · §3`,
      sets: { peer1: { 'resolve x-sel1': 'ws-7a2 → /srv/gwz/razel-a (authority map)' } },
    },
    {
      state: 'D3', phase: 'IS', kind: 'internal', from: 'peer1', frame: 'PROVIDE',
      label: 'gwz-core executes on the resolved root',
      payload: { detail: { engine: 'gwz-core', op: 'per-member git status on /srv/gwz/razel-a', fence: 'workspace.lock held' } },
      note: 'The op runs against the root the AUTHORITY resolved from the stable ID — exactly ws-7a2, never its same-named sibling.',
      docRef: 'gwz-core README',
      sets: { peer1: { gwz: 'ws-7a2 status: clean' } },
    },
    {
      state: 'D4', phase: 'IS', kind: 'message', from: 'peer1', to: 'local1', frame: 'EXCHANGE-RESP',
      label: 'status result', response: true,
      payload: { correlationId: 'x-sel1', detail: { workspace: 'ws-7a2 (/srv/gwz/razel-a)', result: 'clean' } },
      note: 'Directed response, corr 1:1 — the right "razel".',
      sets: { peer1: { 'pending x-sel1': null } },
    },
    {
      state: 'D5', phase: 'IS', kind: 'message', from: 'local1', to: 'gryth1', frame: 'EXCHANGE-RESP',
      label: 'status to the UI', response: true,
      payload: { correlationId: 'x-sel1' },
      note: 'The exchange completes at the requester — the op hit exactly the selected stable ID.',
      sets: { local1: { 'pending x-sel1': null }, gryth1: { view: '… + razel·7a2 status (clean, by ID)' } },
    },

    // ---- Phase ID: asserted root mismatch fails closed -------------------
    {
      state: 'D1', phase: 'ID', kind: 'message', from: 'gryth1', to: 'local1', frame: 'EXCHANGE',
      label: 'gwz: op addressed ws-7a2 but ASSERTING a mismatching root',
      payload: { gladeId: 'gwz.ops', shape: 'exchange', verb: 'workspace.status', correlationId: 'x-sel2', detail: { addressed: 'ws-7a2', asserts: 'root = /srv/gwz/razel-b (the OTHER "razel" — ws-9c4’s root)', why: 'a confused/malicious caller tries to smuggle a root that does not match the addressed ID' } },
      note: 'The request addresses ws-7a2 yet ASSERTS ws-9c4’s root. Per E-ws-1 this MUST fail closed — the asserted root is never trusted over the ID→root resolution.',
      docRef: `${GW} §1.2`,
      sets: { local1: { 'pending x-sel2': 'gryth1 → status@ws-7a2 (asserts /srv/gwz/razel-b)' } },
    },
    {
      state: 'C2', phase: 'ID', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'route by stable ID (ignores the asserted root)',
      payload: { share: 'ws-7a2', detail: { answer: 'peer1', basis: 'ServeClaim(ws-7a2) — the node routes on the ADDRESSED ID; the asserted root is not a routing input' } },
      gate: { kind: 'routing', label: 'ServeClaim lookup (by stable ID)', status: 'designed', note: 'Routing consults only the stable ID; the caller-asserted root is carried through untrusted, to be adjudicated by the authority.' },
      note: 'The node routes by the addressed ID to the authority — it does not act on the asserted root; that is the authority’s to reject.',
      docRef: `${WD} §4`,
      sets: { local1: { 'route ws-7a2 (deny)': 'peer1 (by ID; asserted root ignored)' } },
    },
    {
      state: 'D2', phase: 'ID', kind: 'message', from: 'local1', to: 'peer1', frame: 'EXCHANGE',
      label: 'forward (asserted root rides through untrusted)',
      payload: { share: 'ws-7a2', gladeId: 'gwz.ops', shape: 'exchange', verb: 'workspace.status', correlationId: 'x-sel2', detail: { asserts: 'root = /srv/gwz/razel-b' } },
      note: 'The forward carries the caller’s asserted root to the authority, which will adjudicate it against its own ID→root map.',
      sets: { peer1: { 'pending x-sel2': 'local1 (asserts /srv/gwz/razel-b)' } },
    },
    {
      state: 'X4', phase: 'ID', kind: 'internal', from: 'peer1', frame: 'ROUTE', variant: 'a',
      variantNote: 'The deny twist: the authority resolves ID→root itself (ws-7a2 → /srv/gwz/razel-a) and finds the asserted root (/srv/gwz/razel-b) MISMATCHES — it refuses rather than honoring the assertion. The ID is the sole authority input; the root is derived, never accepted from the caller.',
      label: 'ID→root resolution ≠ asserted root → FAIL CLOSED',
      payload: { share: 'ws-7a2', detail: { resolved: 'ws-7a2 → /srv/gwz/razel-a (authority map)', asserted: '/srv/gwz/razel-b', verdict: 'MISMATCH — asserted root is NOT the ID→root resolution; refuse (fail closed)', principle: 'the authority trusts the addressed stable ID, not the caller’s asserted root (E-ws-1)' } },
      gate: { kind: 'routing', label: 'ID→root fail-closed check', status: 'designed', note: 'The authority resolves the stable ID to its own root and rejects any request asserting a different root — a request that contradicts the ID→root map fails closed (E-ws-1). Stage 2 additionally gates the verb; the fail-closed resolution is unchanged.' },
      note: 'The authority never lets a caller-asserted root override its ID→root resolution. ws-7a2 resolves to razel-a; the request asserted razel-b; the mismatch fails closed — no execution, no leak into ws-9c4.',
      docRef: `${GW} §1.2 · §3`,
      sets: { peer1: { 'deny x-sel2': 'asserted /srv/gwz/razel-b ≠ resolved /srv/gwz/razel-a — FAIL CLOSED' } },
    },
    {
      state: 'E5', phase: 'ID', kind: 'message', from: 'peer1', to: 'local1', frame: 'STATUS',
      label: 'fail-closed denial (asserted root mismatch)', response: true,
      payload: { correlationId: 'x-sel2', detail: { ok: 'false', reason: 'asserted root /srv/gwz/razel-b does not match the ID→root resolution for ws-7a2 (= /srv/gwz/razel-a) — refused (E-ws-1)', executed: 'nothing' } },
      gate: { kind: 'security', label: 'fail-closed enforcement', status: 'designed', note: 'A request contradicting the ID→root map is refused as data, with a reason — never partially honored. The addressed stable ID is the sole authority input (E-ws-1).' },
      note: 'The refusal is data, not an exception: a directed failure with the reason. The caller cannot address one ID and act on another root.',
      docRef: `${GW} §1.2 · ${SM} §2.4`,
      sets: { peer1: { 'pending x-sel2': null } },
    },
    {
      state: 'E5', phase: 'ID', kind: 'message', from: 'local1', to: 'gryth1', frame: 'STATUS', response: true,
      label: 'denial surfaced to the UI',
      payload: { detail: { result: 'refused — root assertion did not match the addressed stable ID', workspace: 'unchanged — nothing executed' } },
      note: 'The UI shows the reason; nothing ran on either "razel". The stable ID stayed the sole authority input, and the mismatching assertion failed closed.',
      docRef: `${GW} §1.2`,
      sets: { local1: { 'pending x-sel2': null }, gryth1: { view: 'razel·7a2 op REFUSED — asserted root ≠ ID→root (fail closed)' } },
    },
  ],
};

// ---------------------------------------------------------------------------
// s-ws-create-durable (C-gwz-8) — workspace.create is a DURABLE STATE MACHINE:
// intent → materialized → registered → claimed → complete. Disk GATES the
// records (materialized commits before registered); the client submits INTENT
// and the host appends the canonical result preserving requester (B3) context
// (H-R3). A disk failure yields `failed` + NO records — the machine never
// advances past materialize.
// ---------------------------------------------------------------------------
export const S_WS_CREATE_DURABLE: Scenario = {
  id: 's-ws-create-durable',
  stage: 1,
  title: 'Create — the durable state machine (intent→materialized→registered→claimed→complete)',
  summary:
    'workspace.create runs a DURABLE state machine (C-gwz-8): the client submits an INTENT; the host validates, materializes on disk (gwz init), then appends the canonical records preserving the requester’s B3 context (H-R3). Disk GATES the records — `materialized` commits before `registered`, and each stage is visible fold state that walks intent→materialized→registered→claimed→complete. The failure arm shows the disk refusing: the machine stops at `failed`, mints NO records, and the fold is untouched.',

  actors: pick('gryth1', 'local1', 'peer3'),

  initial: {
    gryth1: { session: 'local1 (open, gianni)', view: 'workspaces' },
    local1: { 'session gryth1': 'open (gianni)', 'sub home/dir.workspaces': 'gryth1', links: 'peer3 (iroh)' },
    peer3: { gwz: 'idle', 'sub home': 'local1 (mesh)' },
  },

  phases: [
    { id: 'SI', label: 'Intent → materialize', summary: 'The client submits a create INTENT; the host receives it (preserving B3 requester context, H-R3) and materializes on disk — the machine walks intent→materialized.' },
    { id: 'SR', label: 'Registered → claimed → complete', summary: 'Disk success GATES the records: the WorkspaceEntry (registered) then the ServeClaim (claimed) append, and the machine reaches complete — records are downstream of disk (C-gwz-8).' },
    { id: 'SF', label: 'Disk failure → failed, no records', summary: 'The disk refuses; the machine stops at `failed` before `registered`, mints NO WorkspaceEntry and NO ServeClaim, and answers failure as data — the fold is never touched.' },
  ],

  steps: [
    // ---- Phase SI: intent → materialize ----------------------------------
    {
      state: 'D1', phase: 'SI', kind: 'message', from: 'gryth1', to: 'local1', frame: 'EXCHANGE',
      label: 'submit create INTENT (ws-new, empty) on peer3',
      payload: { gladeId: 'gwz.ops', shape: 'exchange', verb: 'workspace.create', correlationId: 'x-dur1', detail: { name: 'ws-new', members: '0 (gwz init — empty)', target: 'peer3', authorship: 'the client submits the INTENT only — it never appends the result effect record itself (H-R3)' } },
      note: 'The client submits a create INTENT (H-R3): the ask, not the effect. The host authority owns validation, materialization, and the canonical result records. This is stage `intent` of the durable machine (C-gwz-8).',
      docRef: `${GW} §2.2 · gwz-core README`,
      sets: { local1: { 'pending x-dur1': 'gryth1 → create@peer3', 'create ws-new': 'intent (client submitted)' } },
    },
    {
      state: 'C2', phase: 'SI', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'route the intent to the target host',
      payload: { detail: { target: 'peer3 — named in the intent', note: 'creation is the one routed op with no ServeClaim to consult — it MAKES the thing claims will be about' } },
      gate: { kind: 'routing', label: 'create-target routing', status: 'designed', note: 'Routes by TARGET; stage 2 asks which principals may create workspaces on which nodes (GDL-016).' },
      note: 'The create intent routes to the explicit target host peer3.',
      docRef: 'GDL-016',
      sets: { local1: { 'route create': 'peer3 (explicit target)' } },
    },
    {
      state: 'D2', phase: 'SI', kind: 'message', from: 'local1', to: 'peer3', frame: 'EXCHANGE',
      label: 'forward the create intent',
      payload: { gladeId: 'gwz.ops', shape: 'exchange', verb: 'workspace.create', correlationId: 'x-dur1', detail: { requester: 'gianni (via session gryth1) — B3 context carried so the host can attribute the canonical records (H-R3)' } },
      note: 'The intent reaches the host, carrying the requester’s B3 context so the host-appended records preserve WHO asked (H-R3) — not a client-appended effect.',
      docRef: `${GW} §2.2 · ${SM} §2.2`,
      sets: { peer3: { 'pending x-dur1': 'local1', 'requester x-dur1': 'gianni via gryth1', 'create ws-new': 'intent received (validating)' } },
    },
    {
      state: 'X5', phase: 'SI', kind: 'internal', from: 'peer3', frame: 'PROVIDE',
      label: 'materialize on disk (gwz init) — stage `materialized`',
      payload: { detail: { disk: 'gwz init /srv/gwz/ws-new — empty workspace, 0 members, workspace.lock created + held', gate: 'this is the GATE: `materialized` commits FIRST; only on disk success do `registered`/`claimed` follow (C-gwz-8)', order: 'disk BEFORE records — the records are a downstream consequence of THIS succeeding' } },
      note: 'The host validates then materializes: gwz init on disk. The machine reaches `materialized`. Disk GATES the records — nothing is registered until the disk commits (C-gwz-8).',
      docRef: `${GW} §2.2`,
      sets: { peer3: { gwz: 'gwz init ws-new (empty, 0 members)', wc: 'ws-new checkout + lock HELD', 'create ws-new': 'materialized (disk OK — gates the records)' } },
    },

    // ---- Phase SR: registered → claimed → complete -----------------------
    {
      state: 'K1', phase: 'SR', kind: 'internal', from: 'peer3', frame: 'APPEND',
      label: 'append WorkspaceEntry — stage `registered`',
      payload: { share: 'home', detail: { op: 'WorkspaceEntry(ws-new, 0 members, eligible: [peer3])', attribution: 'host-appended, preserving requester gianni (B3) — the canonical result record (H-R3)', because: 'the disk leg succeeded — registered is GATED behind materialized' } },
      note: 'The host appends the canonical WorkspaceEntry, preserving the B3 requester (H-R3). The machine reaches `registered` — reachable ONLY because `materialized` succeeded (the disk gate, C-gwz-8).',
      docRef: `${WD} §2 · ${GW} §2.2`,
      sets: { peer3: { 'origin log': '+WorkspaceEntry(ws-new) by gianni', 'create ws-new': 'registered (WorkspaceEntry appended)' } },
    },
    {
      state: 'H1', phase: 'SR', kind: 'internal', from: 'peer3', frame: 'LEASE',
      label: 'publish ServeClaim — stage `claimed`',
      payload: { detail: { claim: 'ServeClaim(ws-new, peer3, epoch 1)', basis: 'lock already held from gwz init' } },
      note: 'The host claims the new workspace (lock already held). The machine reaches `claimed` — ws-new is now routable.',
      docRef: `${WD} §4`,
      sets: { peer3: { 'claim ws-new': 'held — epoch 1', serving: 'ws-new via grazel', 'create ws-new': 'claimed (ServeClaim published)' } },
    },
    {
      state: 'D4', phase: 'SR', kind: 'message', from: 'peer3', to: 'local1', frame: 'EXCHANGE-RESP',
      label: 'create response — stage `complete`', response: true,
      payload: { correlationId: 'x-dur1', detail: { ok: 'true', workspace: 'ws-new (0 members)', machine: 'intent→materialized→registered→claimed→complete (all durable, disk-gated)' } },
      note: 'The durable machine reaches `complete`: disk + records + claim all committed in order. The response rides back the exchange.',
      docRef: `${GW} §2.2`,
      sets: { peer3: { 'pending x-dur1': null, 'create ws-new': 'complete (durable state machine finished)' } },
    },
    {
      state: 'D5', phase: 'SR', kind: 'message', from: 'local1', to: 'gryth1', frame: 'EXCHANGE-RESP',
      label: 'response to the UI', response: true,
      payload: { correlationId: 'x-dur1' },
      note: 'The exchange is done; the directory LIST update arrives separately, as replication.',
      sets: { local1: { 'pending x-dur1': null } },
    },
    {
      state: 'B9', phase: 'SR', kind: 'message', from: 'peer3', to: 'local1', frame: 'OPS',
      label: 'directory ops replicate',
      payload: { share: 'home', detail: { ops: 'WorkspaceEntry(ws-new) + ServeClaim(epoch 1) — attributed to gianni' } },
      note: 'The committed records reach every replica; the machine’s output is ordinary home-share data.',
      docRef: `${WD} §2`,
      sets: { local1: { 'fold home': 'ws-new@peer3 (empty, live) — created by gianni' } },
    },

    // ---- Phase SF: disk failure → failed, no records ---------------------
    {
      state: 'D1', phase: 'SF', kind: 'message', from: 'gryth1', to: 'local1', frame: 'EXCHANGE',
      label: 'submit create INTENT (ws-bad) — disk will refuse',
      payload: { gladeId: 'gwz.ops', shape: 'exchange', verb: 'workspace.create', correlationId: 'x-dur2', detail: { name: 'ws-bad', target: 'peer3', note: 'a path collision / permission refusal awaits on disk' } },
      note: 'Same intent shape — failure is a property of the materialization, not the ask. Stage `intent`.',
      docRef: `${GW} §2.2`,
      sets: { local1: { 'pending x-dur2': 'gryth1 → create@peer3', 'create ws-bad': 'intent (client submitted)' } },
    },
    {
      state: 'D2', phase: 'SF', kind: 'message', from: 'local1', to: 'peer3', frame: 'EXCHANGE',
      label: 'forward the create intent',
      payload: { gladeId: 'gwz.ops', shape: 'exchange', verb: 'workspace.create', correlationId: 'x-dur2' },
      note: 'Routed to the target host.',
      sets: { peer3: { 'pending x-dur2': 'local1', 'create ws-bad': 'intent received (validating)' } },
    },
    {
      state: 'X6', phase: 'SF', kind: 'internal', from: 'peer3', frame: 'PROVIDE',
      label: 'materialization FAILS — machine stops at `failed`, no records',
      payload: { detail: { disk: 'gwz init /srv/gwz/ws-bad → REFUSED (path exists / no permission)', gate: 'the disk GATE failed: `materialized` never succeeds, so `registered` and `claimed` NEVER run (C-gwz-8)', minted: 'NO WorkspaceEntry, NO ServeClaim — the fold is untouched, there is no half-created workspace' } },
      note: 'The disk refuses. The durable machine cannot advance past materialize — it stops at `failed`, mints NOTHING. No orphan record, no dangling claim (C-gwz-8 — the disk gates the records).',
      docRef: `${GW} §2.2`,
      sets: { peer3: { 'create ws-bad': 'FAILED — disk refused; NO records (materialized gates registered)' } },
    },
    {
      state: 'D4', phase: 'SF', kind: 'message', from: 'peer3', to: 'local1', frame: 'EXCHANGE-RESP',
      label: 'create response (ok:false)', response: true,
      payload: { correlationId: 'x-dur2', detail: { ok: 'false', error: 'disk refused: /srv/gwz/ws-bad exists', minted: 'nothing', machine: 'intent→failed (never reached registered)' } },
      note: 'Failure is data: a directed ok:false with the reason, corr intact. The machine’s terminal state is `failed`, not a partial create.',
      docRef: `${SM} §2.4`,
      sets: { peer3: { 'pending x-dur2': null } },
    },
    {
      state: 'D5', phase: 'SF', kind: 'message', from: 'local1', to: 'gryth1', frame: 'EXCHANGE-RESP',
      label: 'failure surfaced to the UI', response: true,
      payload: { correlationId: 'x-dur2', detail: { result: 'create failed', reason: 'path exists', workspaces: 'unchanged — ws-bad was never minted' } },
      note: 'The UI shows the reason; the workspace list is unchanged. No records were minted, so nothing replicates — the disk gate held.',
      sets: { local1: { 'pending x-dur2': null }, gryth1: { view: 'ws-bad create FAILED (path exists) — nothing minted' } },
    },
  ],
};

// ---------------------------------------------------------------------------
// s-ws-create-recover (C-gwz-8) — a crash BETWEEN the record appends. The
// create materializes + registers (WorkspaceEntry durable in the HOME log),
// then the host crashes BEFORE the ServeClaim. On restart, recovery is
// FORWARD-ONLY + IDEMPOTENT: it folds the home log (authoritative), sees
// `registered`, re-attempts the WorkspaceEntry append as a NO-OP (dedup), and
// appends only the missing ServeClaim → `complete`. No orphan, no half-create.
// ---------------------------------------------------------------------------
export const S_WS_CREATE_RECOVER: Scenario = {
  id: 's-ws-create-recover',
  stage: 1,
  title: 'Create recovery — a crash between appends replays forward-only',
  summary:
    'A workspace.create materializes (gwz init) and registers (WorkspaceEntry, durable in the HOME log), then the host CRASHES before the ServeClaim append — a create caught between record appends (C-gwz-8). On restart, recovery is forward-only + idempotent: the host folds the home log (authoritative), sees position `registered`, re-attempts the WorkspaceEntry append as a NO-OP (op-identity dedup — no orphan, no duplicate), and appends ONLY the missing ServeClaim, reaching `complete`. No orphan, no half-create; the original client exchange had already timed out and re-syncs via the directory.',

  actors: pick('gryth1', 'local1', 'peer3'),

  initial: {
    gryth1: { session: 'local1 (open, gianni)', view: 'workspaces' },
    local1: { 'session gryth1': 'open (gianni)', 'sub home/dir.workspaces': 'gryth1', links: 'peer3 (iroh)' },
    peer3: { gwz: 'idle', 'sub home': 'local1 (mesh)' },
  },

  phases: [
    { id: 'RC', label: 'Crash between appends', summary: 'The create materializes and registers the WorkspaceEntry (durable in the home log), then the host crashes BEFORE the ServeClaim append — the ceremony is caught mid-way.' },
    { id: 'RR', label: 'Recover forward-only + idempotent', summary: 'On restart the host folds the home log (authoritative), sees `registered`, re-attempts the entry append as a NO-OP (dedup), and appends only the missing ServeClaim — reaching `complete`.' },
    { id: 'RV', label: 'Converge — no orphan, no half-create', summary: 'The completed records replicate; the directory shows ws-rec live, recovered — no orphan workspace, no half-create, exactly one WorkspaceEntry.' },
  ],

  steps: [
    // ---- Phase RC: crash between appends ---------------------------------
    {
      state: 'D1', phase: 'RC', kind: 'message', from: 'gryth1', to: 'local1', frame: 'EXCHANGE',
      label: 'submit create INTENT (ws-rec) on peer3',
      payload: { gladeId: 'gwz.ops', shape: 'exchange', verb: 'workspace.create', correlationId: 'x-rec1', detail: { name: 'ws-rec', target: 'peer3' } },
      note: 'A create intent that will be interrupted by a crash. Stage `intent`.',
      docRef: `${GW} §2.2`,
      sets: { local1: { 'pending x-rec1': 'gryth1 → create@peer3', 'create ws-rec': 'intent (client submitted)' } },
    },
    {
      state: 'D2', phase: 'RC', kind: 'message', from: 'local1', to: 'peer3', frame: 'EXCHANGE',
      label: 'forward the create intent',
      payload: { gladeId: 'gwz.ops', shape: 'exchange', verb: 'workspace.create', correlationId: 'x-rec1', detail: { requester: 'gianni via gryth1 (B3)' } },
      note: 'The intent reaches the host, carrying B3 requester context (H-R3).',
      docRef: `${GW} §2.2`,
      sets: { peer3: { 'pending x-rec1': 'local1', 'requester x-rec1': 'gianni via gryth1', 'create ws-rec': 'intent received' } },
    },
    {
      state: 'X5', phase: 'RC', kind: 'internal', from: 'peer3', frame: 'PROVIDE',
      label: 'materialize (gwz init) — stage `materialized`',
      payload: { detail: { disk: 'gwz init /srv/gwz/ws-rec — empty, lock held', gate: 'disk commits first (materialized); the records follow (C-gwz-8)' } },
      note: 'The host materializes on disk — the machine reaches `materialized`. Disk is durable before any record.',
      docRef: `${GW} §2.2`,
      sets: { peer3: { gwz: 'gwz init ws-rec (empty)', wc: 'ws-rec checkout + lock HELD', 'create ws-rec': 'materialized (disk OK)' } },
    },
    {
      state: 'K1', phase: 'RC', kind: 'internal', from: 'peer3', frame: 'APPEND',
      label: 'append WorkspaceEntry — stage `registered` (durable in the home log)',
      payload: { share: 'home', detail: { op: 'WorkspaceEntry(ws-rec, 0 members, eligible: [peer3]) — op id: op-wsrec-entry', authoritative: 'the HOME share log is authoritative for the ceremony position (C-gwz-8) — this record is now durable' } },
      note: 'The WorkspaceEntry appends to the home log and is DURABLE. The machine reaches `registered`. The home log — authoritative — now records that the ceremony got this far.',
      docRef: `${WD} §2 · ${GW} §2.2`,
      sets: { peer3: { 'origin log': '+WorkspaceEntry(ws-rec) [op-wsrec-entry]', 'create ws-rec': 'registered (WorkspaceEntry durable)' } },
    },
    {
      state: 'H3', phase: 'RC', kind: 'internal', from: 'peer3', frame: 'LEASE',
      label: 'host CRASHES before the ServeClaim append',
      payload: { detail: { crash: 'peer3 dies AFTER registered, BEFORE the claim append — a create caught between record appends', durable: 'the WorkspaceEntry (registered) is safe in the home log; the ServeClaim (claimed) was NEVER written', risk: 'without forward-only recovery this would be a half-create — an entry with no claim, or (worse under naive retry) a duplicate entry' } },
      note: 'The crash lands exactly between the WorkspaceEntry and the ServeClaim appends. The entry is durable; the claim never happened. The client’s exchange (x-rec1) will time out. Recovery — not the exchange — completes the ceremony.',
      docRef: `${GW} §2.2 · ${WD} §4`,
      sets: { peer3: { gwz: 'DOWN (crashed)', serving: null, 'create ws-rec': 'CRASHED — registered, not yet claimed' } },
    },

    // ---- Phase RR: recover forward-only + idempotent ---------------------
    {
      state: 'N1', phase: 'RR', kind: 'internal', from: 'peer3', frame: 'FOLD',
      label: 'restart — reacquire instance.lock',
      payload: { detail: { boot: 'peer3 restarts; StoreApi takes instance.lock (single-writer — the workspace.lock precedent)', next: 'recovery will fold the home log to find any in-flight ceremony' } },
      note: 'On restart the host reacquires its instance lock and begins recovery. It does not blindly retry — it reads the authoritative home log first.',
      docRef: `${GW} §2.2 · GDL-036`,
      sets: { peer3: { gwz: 'restarting (recovery)', 'create ws-rec': 'recovering' } },
    },
    {
      state: 'A4', phase: 'RR', kind: 'internal', from: 'peer3', frame: 'FOLD',
      label: 'fold the HOME log — position = `registered`, claim missing',
      payload: { share: 'home', detail: { fold: 'WorkspaceEntry(ws-rec) present (registered) · NO ServeClaim → ceremony position = registered', authoritative: 'the home log is the source of truth for where the ceremony got to (C-gwz-8)', decision: 'advance FORWARD-ONLY from registered → claimed → complete; never redo the disk, never re-mint the entry' } },
      note: 'Recovery folds the authoritative home log and discovers the ceremony stopped at `registered`: the entry exists, the claim does not. It resolves to move forward only — the disk and the entry are already done.',
      docRef: `${GW} §2.2 · ${WD} §3`,
      sets: { peer3: { 'create ws-rec': 'recovered position: registered (home log authoritative)' } },
    },
    {
      state: 'K1', phase: 'RR', kind: 'internal', from: 'peer3', frame: 'APPEND', variant: 'a',
      variantNote: 'Idempotent replay: the recovery re-attempts the WorkspaceEntry append, but the op (op-wsrec-entry) is ALREADY in the home log — dedup by op identity makes it a NO-OP. No orphan, no duplicate entry. This is why forward-only recovery is safe to re-run.',
      label: 'replay WorkspaceEntry append → idempotent NO-OP',
      payload: { share: 'home', detail: { op: 'WorkspaceEntry(ws-rec) [op-wsrec-entry] — re-attempt', result: 'NO-OP: op-wsrec-entry already present; the append dedups by op identity (idempotent)', guarantee: 'exactly ONE WorkspaceEntry(ws-rec) exists after recovery — no duplicate, no orphan' } },
      note: 'The idempotency proof: replaying the entry append is a no-op because the op is already durable. Forward-only recovery re-runs safely — the home log dedups, so there is never a second entry.',
      docRef: `${GW} §2.2 · ${WD} §2`,
      sets: { peer3: { 'create ws-rec': 'replay: WorkspaceEntry already present (idempotent no-op)' } },
    },
    {
      state: 'H1', phase: 'RR', kind: 'internal', from: 'peer3', frame: 'LEASE',
      label: 'append the MISSING ServeClaim — stage `claimed` → `complete`',
      payload: { detail: { claim: 'ServeClaim(ws-rec, peer3, epoch 1) — the append that the crash skipped', basis: 'lock re-held on restart; the working copy from the pre-crash gwz init is intact', forwardOnly: 'recovery only ADDS the missing claim — it never rewinds or re-materializes (C-gwz-8)' } },
      note: 'The one thing the crash skipped — the ServeClaim — is now appended. The machine reaches `claimed` then `complete`. Recovery moved forward only: it added the missing record, nothing more.',
      docRef: `${WD} §4 · ${GW} §2.2`,
      sets: { peer3: { 'claim ws-rec': 'held — epoch 1', serving: 'ws-rec via grazel', gwz: 'ws-rec ready', 'create ws-rec': 'complete (recovered forward-only)' } },
    },

    // ---- Phase RV: converge — no orphan, no half-create ------------------
    {
      state: 'B9', phase: 'RV', kind: 'message', from: 'peer3', to: 'local1', frame: 'OPS',
      label: 'completed records replicate',
      payload: { share: 'home', detail: { ops: 'WorkspaceEntry(ws-rec) [op-wsrec-entry, single] + ServeClaim(epoch 1)', note: 'exactly one entry + one claim — the recovery produced no duplicate' } },
      note: 'The now-complete records reach the node’s replica: a single WorkspaceEntry and its ServeClaim. No orphan, no half-create survived the crash.',
      docRef: `${WD} §2`,
      sets: { local1: { 'fold home': 'ws-rec@peer3 (empty, live) — recovered', 'pending x-rec1': null } },
    },
    {
      state: 'B9', phase: 'RV', kind: 'message', from: 'local1', to: 'gryth1', frame: 'OPS', response: true,
      label: 'directory shows ws-rec live (recovered)',
      payload: { share: 'home', gladeId: 'dir.workspaces', detail: { ops: 'ws-rec appears — live @peer3, exactly one entry', recovered: 'the create that crashed mid-append completed durably via forward-only recovery (C-gwz-8) — no orphan, no half-create' } },
      note: 'The user-visible outcome: ws-rec is live and singular. The original exchange had timed out, but the durable machine finished the job on restart — the client re-syncs via the directory, not a stale response.',
      docRef: `${GW} §2.2 · §6`,
      sets: { gryth1: { view: '+ ws-rec (empty, live @peer3) — recovered, no half-create' } },
    },
  ],
};

// ---------------------------------------------------------------------------
// s-ws-clone-orset (E-ws-2, H-C5, H-C4) — TWO peers clone the same source
// (peer1) CONCURRENTLY. Each registers eligibility as an OR-set ADD with a
// unique add-tag; neither saw the other (peer2 → [peer1,peer2], peer3 →
// [peer1,peer3]). The `eligible_hosts` OR-set merges add-wins to [peer1,peer2,
// peer3] — LWW would have DROPPED one concurrent add. Clone = eligible + warm,
// NOT seize: peer1 keeps its epoch-1 claim (H-C5). The tree rides gwz/git
// remotes; glade carries only the records/manifest (H-C4).
// ---------------------------------------------------------------------------
export const S_WS_CLONE_ORSET: Scenario = {
  id: 's-ws-clone-orset',
  stage: 1,
  title: 'Concurrent clones — eligible_hosts is an OR-set, not LWW',
  summary:
    'peer2 and peer3 clone ws-shared from peer1 CONCURRENTLY. Each registers eligibility as an OR-set ADD with its own add-tag, neither having seen the other — peer2’s view is [peer1,peer2], peer3’s is [peer1,peer3]. The eligible_hosts OR-set (E-ws-2) merges ADD-WINS to [peer1,peer2,peer3]; LWW would have dropped one concurrent add. Neither clone seizes the active serve — peer1 keeps its epoch-1 claim; the two are WARM eligible hosts (H-C5). The heavy tree rides gwz/git remotes; glade carries only the records + manifest (H-C4).',

  actors: pick('gryth1', 'local1', 'peer1', 'peer2', 'peer3'),

  initial: {
    gryth1: { session: 'local1 (open)', view: 'ws-shared (1 host)' },
    local1: {
      'session gryth1': 'open',
      'sub home/dir.workspaces': 'gryth1',
      'fold home': 'ws-shared — eligible: [peer1] (add-tags: a0), serving: peer1 (epoch 1)',
      links: 'peer1, peer2, peer3 (iroh)',
    },
    peer1: { 'host ws-shared': 'gwz root /srv/gwz/shared', 'claim ws-shared': 'held — epoch 1', serving: 'ws-shared via grazel', 'sub home': 'local1 (mesh)', 'eligible ws-shared': 'peer1 (add-tags: a0)' },
    peer2: { gwz: 'idle', 'sub home': 'local1 (mesh)' },
    peer3: { gwz: 'idle', 'sub home': 'local1 (mesh)' },
  },

  phases: [
    { id: 'OC', label: 'Two concurrent clones', summary: 'peer2 and peer3 each clone ws-shared from peer1 — the trees transfer over gwz/git remotes (glade carries only the records + manifest, H-C4).' },
    { id: 'OA', label: 'Concurrent OR-set adds', summary: 'Each peer registers eligibility as an OR-set ADD with a unique add-tag, neither having seen the other — peer2 sees [peer1,peer2], peer3 sees [peer1,peer3]. Each advertises a WARM replica without seizing (H-C5).' },
    { id: 'OV', label: 'Add-wins convergence', summary: 'The eligible_hosts OR-set merges add-wins to [peer1,peer2,peer3] — LWW would have dropped one; peer1 keeps its epoch-1 serve (H-C5, E-ws-2).' },
  ],

  steps: [
    // ---- Phase OC: two concurrent clones ---------------------------------
    {
      state: 'D1', phase: 'OC', kind: 'message', from: 'gryth1', to: 'local1', frame: 'EXCHANGE',
      label: 'clone ws-shared → peer2 (from peer1)',
      payload: { gladeId: 'gwz.ops', shape: 'exchange', verb: 'workspace.create', correlationId: 'x-p2', detail: { name: 'ws-shared', mode: 'clone-from-existing', source: 'peer1', target: 'peer2' } },
      note: 'The first of two concurrent clones. Cloning is how a peer becomes an eligible host (§2.2).',
      docRef: `${GW} §2.2`,
      sets: { local1: { 'pending x-p2': 'gryth1 → clone@peer2' } },
    },
    {
      state: 'D2', phase: 'OC', kind: 'message', from: 'local1', to: 'peer2', frame: 'EXCHANGE',
      label: 'forward the clone to peer2',
      payload: { gladeId: 'gwz.ops', shape: 'exchange', verb: 'workspace.create', correlationId: 'x-p2' },
      note: 'Directed to peer2 (clone target).',
      sets: { peer2: { 'pending x-p2': 'local1' } },
    },
    {
      state: 'X7', phase: 'OC', kind: 'internal', from: 'peer2', frame: 'PROVIDE',
      label: 'peer2 materializes via gwz clone (git remotes)',
      payload: { detail: { engine: 'gwz clone ws-shared from peer1', transport: 'gwz/git remotes — the tree transfers at the git level; glade carries ONLY the records + manifest/lock (H-C4, the v1 lean)', result: 'full checkout on peer2, workspace.lock held' } },
      note: 'The heavy tree rides gwz/git remotes (the machinery exists); glade never carries file content — only the records and the manifest/lock travel with them (H-C4).',
      docRef: `${GW} §2.2 · §7`,
      sets: { peer2: { gwz: 'gwz clone ws-shared from peer1 (git remotes)', wc: 'ws-shared checkout + lock HELD', 'blob sha256:shared-pack': '~180MB · via gwz/git remotes — ref only (content out-of-band)' } },
    },
    {
      state: 'D1', phase: 'OC', kind: 'message', from: 'gryth1', to: 'local1', frame: 'EXCHANGE',
      label: 'clone ws-shared → peer3 (from peer1), CONCURRENTLY',
      payload: { gladeId: 'gwz.ops', shape: 'exchange', verb: 'workspace.create', correlationId: 'x-p3', detail: { name: 'ws-shared', mode: 'clone-from-existing', source: 'peer1', target: 'peer3', concurrency: 'issued before peer2’s eligibility replicated — the two adds will be CONCURRENT in the OR-set' } },
      note: 'The second clone, concurrent with the first: peer3 clones from the SAME source before peer2’s eligibility add has propagated. This concurrency is what LWW mishandles and the OR-set survives (E-ws-2).',
      docRef: `${GW} §2.2 · §7`,
      sets: { local1: { 'pending x-p3': 'gryth1 → clone@peer3' } },
    },
    {
      state: 'D2', phase: 'OC', kind: 'message', from: 'local1', to: 'peer3', frame: 'EXCHANGE',
      label: 'forward the clone to peer3',
      payload: { gladeId: 'gwz.ops', shape: 'exchange', verb: 'workspace.create', correlationId: 'x-p3' },
      note: 'Directed to peer3 (clone target).',
      sets: { peer3: { 'pending x-p3': 'local1' } },
    },
    {
      state: 'X7', phase: 'OC', kind: 'internal', from: 'peer3', frame: 'PROVIDE',
      label: 'peer3 materializes via gwz clone (git remotes)',
      payload: { detail: { engine: 'gwz clone ws-shared from peer1', transport: 'gwz/git remotes — glade carries only the records + manifest (H-C4)', result: 'full checkout on peer3, workspace.lock held' } },
      note: 'peer3’s tree also transfers over git remotes; glade carries only records. Both clones are now materialized, neither aware of the other’s eligibility.',
      docRef: `${GW} §2.2 · §7`,
      sets: { peer3: { gwz: 'gwz clone ws-shared from peer1 (git remotes)', wc: 'ws-shared checkout + lock HELD', 'blob sha256:shared-pack': '~180MB · via gwz/git remotes — ref only (content out-of-band)' } },
    },

    // ---- Phase OA: concurrent OR-set adds --------------------------------
    {
      state: 'X8', phase: 'OA', kind: 'internal', from: 'peer2', frame: 'APPEND',
      label: 'peer2 OR-set ADD (add-tag a-p2) — base [peer1]',
      payload: { share: 'home', detail: { op: 'WorkspaceEntry(ws-shared) eligible OR-set ADD: +peer2 (add-tag a-p2)', base: 'peer2’s view is [peer1] (add-tags a0) → [peer1, peer2] — it has NOT seen peer3’s add', orset: 'add-wins observed-remove set: the add carries a unique tag so concurrent adds/removes converge (E-ws-2)' } },
      note: 'peer2 adds itself to the eligible_hosts OR-set with a unique add-tag (a-p2), from a base of [peer1]. It cannot see peer3’s concurrent add yet — its local view is [peer1, peer2].',
      docRef: `${GW} §2.2 · ${WD} §2`,
      sets: {
        peer2: {
          'origin log': '+WorkspaceEntry(ws-shared, eligible ADD +peer2 @a-p2)',
          'eligible ws-shared': 'peer1, peer2 (add-tags: a0, a-p2)',
          'optag dir.workspaces/eligible:peer2': 'add-tag a-p2',
        },
      },
    },
    {
      state: 'X8', phase: 'OA', kind: 'internal', from: 'peer3', frame: 'APPEND',
      label: 'peer3 OR-set ADD (add-tag a-p3) — base [peer1], CONCURRENT',
      payload: { share: 'home', detail: { op: 'WorkspaceEntry(ws-shared) eligible OR-set ADD: +peer3 (add-tag a-p3)', base: 'peer3’s view is ALSO [peer1] (add-tags a0) → [peer1, peer3] — it has NOT seen peer2’s add', concurrent: 'peer2 and peer3 added from the SAME base independently — this is the concurrency LWW would resolve by DROPPING one', orset: 'each add’s unique tag is what lets both survive the merge (E-ws-2)' } },
      note: 'peer3 adds itself with add-tag a-p3, ALSO from a base of [peer1] — concurrent with peer2. Two divergent views now exist: [peer1,peer2] and [peer1,peer3]. LWW would keep only the last writer; the OR-set keeps both.',
      docRef: `${GW} §2.2 · ${WD} §2`,
      sets: {
        peer3: {
          'origin log': '+WorkspaceEntry(ws-shared, eligible ADD +peer3 @a-p3)',
          'eligible ws-shared': 'peer1, peer3 (add-tags: a0, a-p3)',
          'optag dir.workspaces/eligible:peer3': 'add-tag a-p3',
        },
      },
    },
    {
      state: 'M3', phase: 'OA', kind: 'internal', from: 'peer2', frame: 'LEASE',
      label: 'peer2 advertises a WARM replica (no seize)',
      payload: { detail: { hint: 'ReplicaHint(ws-shared, peer2) — fresh verified replica, leased', role: 'WARM eligible host: ready to take over via the lease model, WITHOUT displacing peer1’s epoch-1 claim (H-C5)' } },
      note: 'peer2 advertises its fresh replica as WARM — clone makes it eligible + warm, not the active server. It does NOT claim ws-shared; peer1’s serve is untouched (H-C5).',
      docRef: `${WD} §4 · ${GW} §2.2`,
      sets: { peer2: { 'replica ws-shared': 'fresh (gwz clone) — advertised (leased, warm)' } },
    },
    {
      state: 'M3', phase: 'OA', kind: 'internal', from: 'peer3', frame: 'LEASE',
      label: 'peer3 advertises a WARM replica (no seize)',
      payload: { detail: { hint: 'ReplicaHint(ws-shared, peer3) — fresh verified replica, leased', role: 'WARM eligible host — like peer2, ready but not seizing (H-C5)' } },
      note: 'peer3 likewise advertises a warm replica without claiming. Neither concurrent clone seizes the serve — the single epoch-1 claim stays with peer1 (H-C5).',
      docRef: `${WD} §4 · ${GW} §2.2`,
      sets: { peer3: { 'replica ws-shared': 'fresh (gwz clone) — advertised (leased, warm)' } },
    },

    // ---- Phase OV: add-wins convergence ----------------------------------
    {
      state: 'B9', phase: 'OV', kind: 'message', from: 'peer2', to: 'local1', frame: 'OPS',
      label: 'peer2’s eligibility add + replica hint replicate',
      payload: { share: 'home', detail: { ops: 'WorkspaceEntry(ws-shared, eligible ADD +peer2 @a-p2) + ReplicaHint(peer2)' } },
      note: 'Ordinary home-share replication carries peer2’s add (with its tag) — and only records; the cloned tree never touched glade.',
      docRef: `${WD} §2`,
      sets: { local1: { 'fold home': 'ws-shared — eligible: [peer1, peer2] (add-tags: a0, a-p2), serving: peer1 (epoch 1)' } },
    },
    {
      state: 'B9', phase: 'OV', kind: 'message', from: 'peer3', to: 'local1', frame: 'OPS',
      label: 'peer3’s add merges ADD-WINS → all three eligible',
      payload: { share: 'home', detail: { ops: 'WorkspaceEntry(ws-shared, eligible ADD +peer3 @a-p3) + ReplicaHint(peer3)', merge: 'OR-set union of tags {a0, a-p2, a-p3} → eligible: [peer1, peer2, peer3] — ADD-WINS, both concurrent adds survive (E-ws-2)', lwwCounterfactual: 'a last-writer-wins register would have kept only ONE of {peer2, peer3} — the concurrent clone would be silently LOST' } },
      note: 'The OR-set merges the two concurrent adds by tag-union: [peer1, peer2, peer3]. This is the E-ws-2 win — LWW would have dropped a peer; the OR-set converges to all three eligible.',
      docRef: `${GW} §3 · ${WD} §2`,
      sets: { local1: { 'fold home': 'ws-shared — eligible: [peer1, peer2, peer3] (add-tags: a0, a-p2, a-p3), serving: peer1 (epoch 1)' } },
    },
    {
      state: 'D4', phase: 'OV', kind: 'message', from: 'peer2', to: 'local1', frame: 'EXCHANGE-RESP',
      label: 'peer2 clone response (ok)', response: true,
      payload: { correlationId: 'x-p2', detail: { ok: 'true', workspace: 'ws-shared cloned onto peer2', eligible: 'peer2 registered (add-tag a-p2)' } },
      note: 'peer2’s clone ceremony completes: materialized + eligible (warm).',
      sets: { peer2: { 'pending x-p2': null } },
    },
    {
      state: 'D4', phase: 'OV', kind: 'message', from: 'peer3', to: 'local1', frame: 'EXCHANGE-RESP',
      label: 'peer3 clone response (ok)', response: true,
      payload: { correlationId: 'x-p3', detail: { ok: 'true', workspace: 'ws-shared cloned onto peer3', eligible: 'peer3 registered (add-tag a-p3)' } },
      note: 'peer3’s clone ceremony completes too — both concurrent clones succeeded.',
      sets: { peer3: { 'pending x-p3': null } },
    },
    {
      state: 'D5', phase: 'OV', kind: 'message', from: 'local1', to: 'gryth1', frame: 'EXCHANGE-RESP',
      label: 'peer2 response to UI', response: true,
      payload: { correlationId: 'x-p2' },
      note: 'The peer2 exchange completes at the requester.',
      sets: { local1: { 'pending x-p2': null } },
    },
    {
      state: 'D5', phase: 'OV', kind: 'message', from: 'local1', to: 'gryth1', frame: 'EXCHANGE-RESP',
      label: 'peer3 response to UI', response: true,
      payload: { correlationId: 'x-p3' },
      note: 'The peer3 exchange completes; the OR-set convergence arrives as replication.',
      sets: { local1: { 'pending x-p3': null } },
    },
    {
      state: 'B9', phase: 'OV', kind: 'message', from: 'local1', to: 'gryth1', frame: 'OPS', response: true,
      label: 'directory converges to THREE eligible hosts',
      payload: { share: 'home', gladeId: 'dir.workspaces', detail: { ops: 'ws-shared — eligible hosts: [peer1, peer2, peer3]', converged: 'two concurrent clones both survived the OR-set merge — peer1 serving (epoch 1), peer2 + peer3 warm', notLww: 'under LWW one of peer2/peer3 would be missing here', notSeize: 'the active claim never moved — clone = eligible + warm, not takeover (H-C5)' } },
      note: 'The user-testable win: ws-shared shows THREE eligible hosts after two CONCURRENT clones — none lost. The OR-set (E-ws-2) converged where LWW would not; peer1 still serves its epoch-1 claim (H-C5).',
      docRef: `${GW} §3 · §6 · ${WD} §4`,
      sets: { gryth1: { view: 'ws-shared — 3 eligible hosts (peer1 serving, peer2 + peer3 warm) — OR-set converged, none dropped' } },
    },
  ],
};
