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
