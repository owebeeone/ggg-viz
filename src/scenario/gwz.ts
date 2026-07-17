// gwz supplier FAMILY trace-arms (GLP-0006, glade-gwz spec v3, RATIFIED
// 2026-07-12), stage 1 (the family as data ON the security substrate) + one
// stage-2 deny arm. Spec of record: dev-docs/glade/suppliers/glade-gwz.md.
//
// The gwz family is a MECHANICAL 25-interface grain over gwz-core v0.9.2: one
// surface per (method, capability-class), a uniform kit per member (a path-free
// DTO exchange → a method-specific typed response wrapper + a run-keyed events
// log that carries the closing OperationResult record). These traces prove the
// invariants the reshape rests on, each arm proving EXACTLY its claim:
//   · s-gwz-status         — path-free DTO, addressed-share-ID selection (E-ws-1)
//   · s-gwz-dto-project    — server-side projection; host-path DTO refused (C-gwz-3)
//   · s-gwz-stream         — run-keyed events + closing replicated result (C-gwz-4)
//   · s-gwz-tag-egress     — the four-way tag split; absence as data (C-gwz-2)
//   · s-gwz-create-recover — durable state machine, forward-only replay (C-gwz-8)
//   · s-gwz-requester-ctx  — attribution from the ProviderCallContext (B3)
//   · s-gwz-compose-readonly — read-only composition; structural wall (B1)
//   · s-gwz-push-deny       — stage-2 surface-grant denial (failure as data)
//
// MODELING NOTE: like glade-workspaces, the gwz family is NOT one standalone
// actor — the peers (grazel hosts) run gwz-core in-process behind one shared
// kit crate (§9, C-gwz-6); the node routes the addressed share ID to the host;
// the client's tap projects the typed wrapper. So these traces compose onto the
// existing client + node + host-peer actors rather than minting a `gwz-sup`.
import type { Scenario } from './types';
import { pick } from './actors';

const GWZ = 'glade-gwz'; // dev-docs/glade/suppliers/glade-gwz.md
const SM = 'GladeSupplierModel';

// ---------------------------------------------------------------------------
// s-gwz-status — a path-free StatusRequest DTO → StatusResponse +
// WorkspaceGitStatus. The workspace is picked by the ADDRESSED SHARE (its stable
// ID); no host path rides the wire; the node resolves ID→root server-side; and
// the ProviderCallContext actor is present from stage 1 (B3). (C-gwz-3, E-ws-1)
// ---------------------------------------------------------------------------
export const S_GWZ_STATUS: Scenario = {
  id: 's-gwz-status',
  stage: 1,
  title: 'gwz status — path-free DTO, selection is the addressed share ID',
  summary:
    'A gwz.status request carries a glade-owned, path-free DTO; the workspace is selected by the ADDRESSED SHARE (its stable ID) in the binding route, never a host path on the wire. The node resolves ID→root server-side, gwz-core answers a method-specific StatusResponse + WorkspaceGitStatus (not a bare envelope), and the ProviderCallContext actor rides beside the DTO from stage 1 (B3).',

  actors: pick('gryth1', 'local1', 'peer1'),

  initial: {
    gryth1: { session: 'local1 (open, gianni)', view: 'workspaces' },
    local1: {
      'session gryth1': 'open (gianni)',
      'fold home': 'ws-alpha — serving: peer1 (epoch 1)',
      links: 'peer1 (iroh)',
    },
    // The gwz.status provider is attached and serving on the host (B1); the
    // events/result kit rides the same session (§4).
    peer1: {
      serving: 'ws-alpha via grazel',
      'provider ws-alpha/gwz.status': 'gwz#1@peer1 attached — epoch 1',
      'sub home': 'local1 (mesh)',
    },
  },

  phases: [
    { id: 'GS', label: 'Path-free request, stable-ID routing', summary: 'The DTO carries the stable share ID — no host path; the addressed ID is the selection AND the authorization identity (E-ws-1).' },
    { id: 'GR', label: 'Server-side resolve + typed serve', summary: 'The host resolves ID→root, gwz-core answers a method-specific StatusResponse + WorkspaceGitStatus, attributed via the ProviderCallContext (B3).' },
  ],

  steps: [
    // ---- Phase GS: path-free request -------------------------------------
    {
      state: 'D1', phase: 'GS', kind: 'message', from: 'gryth1', to: 'local1', frame: 'EXCHANGE',
      label: 'gwz.status (path-free DTO)',
      payload: { share: 'ws-alpha', gladeId: 'gwz.status', shape: 'exchange', verb: 'status', correlationId: 'g-st1', detail: { dto: 'StatusRequest{schema_version} — NO workspace_root, NO cwd, NO host path', selection: 'the ADDRESSED SHARE ws-alpha (its stable ID in the binding route) IS the selection — display names never route (E-ws-1)', guard: 'the bring-up DENIED_ARGS scope-guard is now STRUCTURAL: there is no --root field to refuse (§3)' } },
      note: 'The wire payload is a glade-owned, path-free DTO. Which workspace it targets is the stable share ID the request is addressed to, not a path the caller supplies. This is the E-ws-1 rule: the addressed ID is the sole routing + authz identity.',
      docRef: `${GWZ} §3 (C-gwz-3) · §5 (E-ws-1)`,
      sets: { local1: { 'pending g-st1': 'gryth1 → status@ws-alpha' } },
    },
    {
      state: 'X4', phase: 'GS', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'addressed ID selects + routes',
      payload: { share: 'ws-alpha', detail: { selection: 'ws-alpha (the addressed stable ID)', route: 'ServeClaim(ws-alpha) → peer1', identity: 'the ID is BOTH the routing and the authorization identity — a DTO asserting a mismatching root would fail (E-ws-1)' } },
      gate: { kind: 'routing', label: 'addressed-ID routing', status: 'designed', note: 'The stable share ID picks the workspace and the host; stage 2 gates the surface grant on the same ID — routing is unchanged.' },
      note: 'The node routes on the addressed share ID. There is no selection token in the DTO — the address is the selection (E-ws-1). The host is resolved by the ordinary ServeClaim.',
      docRef: `${GWZ} §5 (E-ws-1) · §7`,
      sets: { local1: { 'route ws-alpha': 'peer1 (from addressed ID)' } },
    },

    // ---- Phase GR: resolve + typed serve ---------------------------------
    {
      state: 'D2', phase: 'GR', kind: 'message', from: 'local1', to: 'peer1', frame: 'EXCHANGE',
      label: 'forward + ProviderCallContext beside the DTO',
      payload: { share: 'ws-alpha', gladeId: 'gwz.status', shape: 'exchange', verb: 'status', correlationId: 'g-st1', detail: { ctx: 'ProviderCallContext{requester: gianni, session gryth1, certified device} — node-authenticated, delivered BESIDE the DTO (B3)', dtoPrincipal: 'the DTO carries NO principal field' } },
      note: 'The node forwards the exchange and constructs a ProviderCallContext from the authenticated session — delivered beside, never inside, the request DTO (B3, §6).',
      docRef: `${GWZ} §6 (B3) · ${SM} §2.2`,
      sets: { peer1: { 'pending g-st1': 'local1', 'requester g-st1': 'gianni@fp:11a7 via gryth1' } },
    },
    {
      state: 'X1', phase: 'GR', kind: 'internal', from: 'peer1', frame: 'FOLD',
      label: 'resolve stable ID → gwz root (app-owned map)',
      payload: { share: 'ws-alpha', detail: { map: 'ws-alpha → /srv/gwz/alpha (the ID→root resolution, glade-workspaces §1.2 owns the map)', fill: 'WorkspaceRef.root / cwd are filled SERVER-SIDE from the map — the DTO never carried them (C-gwz-3)' } },
      note: 'The host resolves the addressed ID to the real gwz root through the app-owned ID→root map. The canonical Request the DTO projects into gets its host-path fields here, never from the wire.',
      docRef: `${GWZ} §3 (C-gwz-3) · §5`,
      sets: { peer1: { 'resolve ws-alpha': '/srv/gwz/alpha (app-owned map)' } },
    },
    {
      state: 'D3', phase: 'GR', kind: 'internal', from: 'peer1', frame: 'PROVIDE',
      label: 'gwz-core status, attributed via the context',
      payload: { share: 'ws-alpha', detail: { engine: 'gwz-core status on /srv/gwz/alpha (lock-consistent read)', wrapper: 'StatusResponse{ ...envelope, workspace_git_status } — the METHOD-SPECIFIC typed wrapper (1214), not a bare ResponseEnvelope (§4)', attribution: 'OperationAttribution.actor = gianni@fp:11a7 (from the ProviderCallContext, glade-users §1), not any DTO field' } },
      note: 'gwz-core reads the working copy and answers the typed StatusResponse wrapper carrying WorkspaceGitStatus (branches, ahead/behind, file-changes, lock-match). Attribution is the context principal — real and honest from stage 1 (B3).',
      docRef: `${GWZ} §4 (C-gwz-4) · §6 (B3)`,
      sets: { peer1: { gwz: 'ws-alpha status: 3 members, 1 ahead, lock matches' } },
    },
    {
      state: 'D4', phase: 'GR', kind: 'message', from: 'peer1', to: 'local1', frame: 'EXCHANGE-RESP', response: true,
      label: 'StatusResponse + WorkspaceGitStatus',
      payload: { correlationId: 'g-st1', detail: { wrapper: 'StatusResponse{ ok: true }', status: 'WorkspaceGitStatus{ branches, ahead: 1, behind: 0, file_changes, lock_match: true }' } },
      note: 'The typed wrapper routes back by correlation id — decode is fail-closed (B2): a malformed/oversized DTO or a gwz-core failure would return a well-formed failed wrapper, never a panic.',
      docRef: `${GWZ} §4 (C-gwz-4/B2)`,
      sets: { peer1: { 'pending g-st1': null } },
    },
    {
      state: 'D5', phase: 'GR', kind: 'message', from: 'local1', to: 'gryth1', frame: 'EXCHANGE-RESP', response: true,
      label: 'dashboard renders',
      payload: { correlationId: 'g-st1', detail: { render: 'status dashboard: 3 members · 1 ahead · lock matches' } },
      note: 'The status dashboard renders from the typed wrapper. The consuming tap never learned a host path — none crossed the wire.',
      docRef: `${GWZ} §7`,
      sets: { local1: { 'pending g-st1': null }, gryth1: { view: 'ws-alpha status (3 members, 1 ahead, lock ok)' } },
    },
  ],
};

// ---------------------------------------------------------------------------
// s-gwz-dto-project — the path-free DTO is projected SERVER-SIDE into the
// canonical Request (host-path fields filled from the ID→root map; every
// filesystem field normalized through RootRelativePath). A DTO that carries an
// absolute host path / a `..` traversal / a root mismatching the ID is refused
// as DATA. (C-gwz-3, D14)
// ---------------------------------------------------------------------------
export const S_GWZ_DTO_PROJECT: Scenario = {
  id: 's-gwz-dto-project',
  stage: 1,
  title: 'gwz DTO projection — path-free in, canonical out; host paths refused',
  summary:
    'A path-free stage DTO (ws-relative pathspecs on RootRelativePath) projects server-side into the canonical StageRequest — host-path fields filled from the ID→root map, every filesystem field normalized (reject absolute, reject parent traversal, symlinks constrained to the root, no TOCTOU). The negative arm: a DTO that carries an absolute host path, a `..` traversal, or a root mismatching the ID is refused as DATA, no gwz-core call, no filesystem touch (C-gwz-3, D14).',

  actors: pick('gryth1', 'local1', 'peer1'),

  initial: {
    gryth1: { session: 'local1 (open, gianni)' },
    local1: { 'session gryth1': 'open (gianni)', 'fold home': 'ws-alpha — serving: peer1 (epoch 1)', links: 'peer1 (iroh)' },
    peer1: { serving: 'ws-alpha via grazel', 'provider ws-alpha/gwz.stage': 'gwz#1@peer1 attached — epoch 1', 'sub home': 'local1 (mesh)' },
  },

  phases: [
    { id: 'DP', label: 'Path-free DTO → canonical request', summary: 'A ws-relative DTO projects into the canonical StageRequest; host-path fields are filled from the ID→root map and normalized through RootRelativePath (D14).' },
    { id: 'DN', label: 'Host-path DTO refused as data', summary: 'A DTO asserting an absolute host path (or `..`, or a mismatching root) is rejected as data before any gwz-core call — the fold and the disk are never touched (C-gwz-3).' },
  ],

  steps: [
    // ---- Phase DP: path-free projection ----------------------------------
    {
      state: 'D1', phase: 'DP', kind: 'message', from: 'gryth1', to: 'local1', frame: 'EXCHANGE',
      label: 'gwz.stage (ws-relative pathspecs)',
      payload: { share: 'ws-alpha', gladeId: 'gwz.stage', shape: 'exchange', verb: 'stage', correlationId: 'dp-1', detail: { dto: 'StageRequest DTO{ pathspecs: ["core/src/lib.rs", "app/main.ts"] } — ws-relative RootRelativePath fields only', absent: 'no cwd, no absolute path — those are canonical-Request fields the server fills (§3)' } },
      note: 'The DTO rides only path-free or ws-relative fields on the shared RootRelativePath type. cwd and the workspace root are NOT on the wire — the server projects them in.',
      docRef: `${GWZ} §3 (C-gwz-3, D14)`,
      sets: { local1: { 'pending dp-1': 'gryth1 → stage@ws-alpha' } },
    },
    {
      state: 'C2', phase: 'DP', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'route to the host',
      payload: { share: 'ws-alpha', detail: { answer: 'peer1 (ServeClaim valid)' } },
      gate: { kind: 'routing', label: 'ServeClaim lookup', status: 'designed', note: 'The addressed ID routes to the host that owns the gwz tree; projection happens there.' },
      note: 'The exchange routes to the host of the addressed workspace.',
      docRef: `${GWZ} §5`,
      sets: { local1: { 'route ws-alpha': 'peer1' } },
    },
    {
      state: 'D2', phase: 'DP', kind: 'message', from: 'local1', to: 'peer1', frame: 'EXCHANGE',
      label: 'forward the stage DTO',
      payload: { share: 'ws-alpha', gladeId: 'gwz.stage', shape: 'exchange', verb: 'stage', correlationId: 'dp-1' },
      note: 'Directed to the host; corr preserved 1:1.',
      docRef: `${SM} §2.3`,
      sets: { peer1: { 'pending dp-1': 'local1' } },
    },
    {
      state: 'X1', phase: 'DP', kind: 'internal', from: 'peer1', frame: 'FOLD',
      label: 'project DTO → canonical StageRequest',
      payload: { share: 'ws-alpha', detail: { fill: 'cwd = /srv/gwz/alpha (from the ID→root map) — the DTO never carried it', normalize: 'each pathspec through RootRelativePath (D14): reject absolute, reject `..` traversal, constrain symlinks to the root, safe-open (no TOCTOU)', result: 'canonical StageRequest{ cwd, pathspecs } — a server-side construction' } },
      note: 'The glade-owned DTO becomes the canonical gwz-core Request server-side: host-path fields from the ID→root resolution, every filesystem field normalized by the one shared RootRelativePath utility (D14).',
      docRef: `${GWZ} §3 (C-gwz-3, D14)`,
      sets: { peer1: { 'project dp-1': 'canonical StageRequest (cwd from map, paths normalized)' } },
    },
    {
      state: 'D3', phase: 'DP', kind: 'internal', from: 'peer1', frame: 'PROVIDE',
      label: 'gwz-core stages on the resolved root',
      payload: { share: 'ws-alpha', detail: { engine: 'gwz-core multi-repo git add on /srv/gwz/alpha', staged: '2 pathspecs' } },
      note: 'gwz-core executes the canonical request against the resolved working copy.',
      docRef: 'gwz-core v0.9.2',
      sets: { peer1: { gwz: 'ws-alpha: staged core/src/lib.rs, app/main.ts' } },
    },
    {
      state: 'D4', phase: 'DP', kind: 'message', from: 'peer1', to: 'local1', frame: 'EXCHANGE-RESP', response: true,
      label: 'stage ok', payload: { correlationId: 'dp-1', detail: { ok: 'true', staged: '2 paths' } },
      note: 'Typed wrapper back; the projection was invisible to the caller.',
      docRef: `${GWZ} §4`,
      sets: { peer1: { 'pending dp-1': null } },
    },
    {
      state: 'D5', phase: 'DP', kind: 'message', from: 'local1', to: 'gryth1', frame: 'EXCHANGE-RESP', response: true,
      label: 'staged (to UI)', payload: { correlationId: 'dp-1' },
      note: 'The exchange completes; the client never named a host path and never could.',
      sets: { local1: { 'pending dp-1': null }, gryth1: { view: 'staged 2 paths' } },
    },

    // ---- Phase DN: host-path DTO refused as data -------------------------
    {
      state: 'D1', phase: 'DN', kind: 'message', from: 'gryth1', to: 'local1', frame: 'EXCHANGE',
      label: 'add_existing_repo asserting an absolute host path',
      payload: { share: 'ws-alpha', gladeId: 'gwz.repo', shape: 'exchange', verb: 'add_existing_repo', correlationId: 'dp-2', detail: { dto: 'DTO{ repository_path: "/private/var/other/repo" } — an ABSOLUTE host path', forbidden: 'C-gwz-3: an arbitrary caller-supplied host path is FORBIDDEN — the only allowed forms are a selected-root-relative path OR a scoped expiring RepoImportHandle' } },
      note: 'The hard field: add_existing_repo.repository_path. A DTO that smuggles an absolute host path is exactly what C-gwz-3 refuses — AZ-1 path-scoping alone cannot sanctify an unbounded host path.',
      docRef: `${GWZ} §3 (C-gwz-3) · §13`,
      sets: { local1: { 'pending dp-2': 'gryth1 → add_existing_repo@ws-alpha' } },
    },
    {
      state: 'D2', phase: 'DN', kind: 'message', from: 'local1', to: 'peer1', frame: 'EXCHANGE',
      label: 'forward (will be refused)',
      payload: { share: 'ws-alpha', gladeId: 'gwz.repo', shape: 'exchange', verb: 'add_existing_repo', correlationId: 'dp-2' },
      note: 'Routed to the host; refusal is a property of the DTO, not the ask.',
      sets: { peer1: { 'pending dp-2': 'local1' } },
    },
    {
      state: 'D3', phase: 'DN', kind: 'internal', from: 'peer1', frame: 'PROVIDE', variant: 'a',
      variantNote: 'The refusal branch: projection rejects the DTO before any gwz-core call — the same PROVIDE slot, opposite verdict.',
      label: 'projection REFUSES the host path',
      payload: { share: 'ws-alpha', detail: { reject: 'RootRelativePath rejects the absolute path; a `..` traversal would reject identically; a root MISMATCHING the resolved ID also fails (E-ws-1)', effect: 'NO gwz-core call, NO filesystem touch, NO record minted — the fold is untouched', remedy: 'use a selected-root-relative path or a server-issued scoped RepoImportHandle (§3, §14 open)' } },
      note: 'The three refused forms — absolute path, parent traversal, root/ID mismatch — are all caught structurally by the shared path type. Out-of-tree imports beyond a scoped handle are deferred to a future contract (§14).',
      docRef: `${GWZ} §3 (C-gwz-3, D14) · §5 (E-ws-1)`,
      sets: { peer1: { 'refuse dp-2': 'host path forbidden (RootRelativePath) — nothing touched' } },
    },
    {
      state: 'D4', phase: 'DN', kind: 'message', from: 'peer1', to: 'local1', frame: 'EXCHANGE-RESP', response: true,
      label: 'refused (ok:false, typed GwzError)',
      payload: { correlationId: 'dp-2', detail: { ok: 'false', error: 'GwzError{ path_forbidden }: absolute host path rejected', minted: 'nothing' } },
      note: 'Fail-closed decode (B2): a well-formed rejected wrapper with a typed GwzError — failure is DATA (ExchangeRes.ok stays true), never a panic or a partial fold.',
      docRef: `${GWZ} §4 (B2)`,
      sets: { peer1: { 'pending dp-2': null } },
    },
    {
      state: 'D5', phase: 'DN', kind: 'message', from: 'local1', to: 'gryth1', frame: 'EXCHANGE-RESP', response: true,
      label: 'refusal surfaced to the UI',
      payload: { correlationId: 'dp-2', detail: { result: 'refused', reason: 'host paths are not accepted on the wire', remedy: 'select a repo under the workspace root, or request an import handle' } },
      note: 'The UI shows an honest refusal with the remedy — no host path ever reached a filesystem call.',
      sets: { local1: { 'pending dp-2': null }, gryth1: { view: 'add-member refused: host path forbidden' } },
    },
  ],
};

// ---------------------------------------------------------------------------
// s-gwz-stream — a long op (pull_head) answers {operation_id, accepted} first,
// then streams OperationEvents on the run-keyed events log; a LATE subscriber
// backfills from cursor; and the FINAL OperationResult is a CLOSING replicated
// log record (survives provider restart), NOT a paired result exchange. A
// derived .result(operation_id) view projects the same record. (C-gwz-4)
// ---------------------------------------------------------------------------
export const S_GWZ_STREAM: Scenario = {
  id: 's-gwz-stream',
  stage: 1,
  title: 'gwz pull — run-keyed event stream + closing replicated result',
  summary:
    'pull_head is a long op: the exchange answers {operation_id, accepted} first, then OperationEvents (operation_started · member_progress · member_finished) append to the run-keyed events log and fan out to subscribers. A LATE subscriber backfills the stream from its cursor. The authoritative final members[]/errors[] is a CLOSING, REPLICATED OperationResult record appended to that same log — so it survives a provider restart; a derived .result view projects it but is not the authority (C-gwz-4).',

  actors: pick('gryth1', 'gryth2', 'local1', 'peer1'),

  initial: {
    gryth1: { session: 'local1 (open, gianni)' },
    gryth2: { session: 'local1 (open, second view)' },
    local1: { 'session gryth1': 'open', 'session gryth2': 'open', 'fold home': 'ws-alpha — serving: peer1 (epoch 1)', links: 'peer1 (iroh)' },
    peer1: {
      serving: 'ws-alpha via grazel',
      'provider ws-alpha/gwz.pull': 'gwz#1@peer1 attached — epoch 1',
      'sub home': 'local1 (mesh)',
    },
  },

  phases: [
    { id: 'SA', label: 'Long op accepted', summary: 'pull_head answers {operation_id, accepted} inline — the work runs asynchronously behind the run-keyed log.' },
    { id: 'SS', label: 'Events stream on the run-keyed log', summary: 'OperationEvents append to the events log keyed by operation_id and fan out to the subscriber.' },
    { id: 'SB', label: 'Late subscriber backfills', summary: 'A second view subscribes late and backfills the stream from its cursor — the log carries its own history.' },
    { id: 'SC', label: 'Closing replicated result', summary: 'A closing OperationResult TERMINAL record on the same log yields the final members[]/errors[] and survives a provider restart (C-gwz-4).' },
  ],

  steps: [
    // ---- Phase SA: long op accepted --------------------------------------
    {
      state: 'D1', phase: 'SA', kind: 'message', from: 'gryth1', to: 'local1', frame: 'EXCHANGE',
      label: 'gwz.pull (pull_head — egress)',
      payload: { share: 'ws-alpha', gladeId: 'gwz.pull', shape: 'exchange', verb: 'pull_head', correlationId: 'pl-1', detail: { dto: 'PullHeadRequest DTO (path-free)', class: 'egress — network fetch + fast-forward' } },
      note: 'pull_head is an egress member (network fetch). Long ops do not answer inline; the exchange returns an accepted acknowledgement and the work streams on the log.',
      docRef: `${GWZ} §1 (#18) · §4`,
      sets: { local1: { 'pending pl-1': 'gryth1 → pull_head@ws-alpha' } },
    },
    {
      state: 'X4', phase: 'SA', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'route by addressed ID',
      payload: { share: 'ws-alpha', detail: { route: 'ServeClaim(ws-alpha) → peer1' } },
      gate: { kind: 'routing', label: 'addressed-ID routing', status: 'designed', note: 'The addressed share ID routes to the host; the events log lives on the same workspace share (commons).' },
      note: 'The exchange routes to the host on the addressed ID.',
      docRef: `${GWZ} §5`,
      sets: { local1: { 'route ws-alpha': 'peer1' } },
    },
    {
      state: 'D2', phase: 'SA', kind: 'message', from: 'local1', to: 'peer1', frame: 'EXCHANGE',
      label: 'forward pull_head',
      payload: { share: 'ws-alpha', gladeId: 'gwz.pull', shape: 'exchange', verb: 'pull_head', correlationId: 'pl-1' },
      note: 'Directed to the host; the long op begins there.',
      sets: { peer1: { 'pending pl-1': 'local1' } },
    },
    {
      state: 'D4', phase: 'SA', kind: 'message', from: 'peer1', to: 'local1', frame: 'EXCHANGE-RESP', response: true,
      label: 'accepted {operation_id}',
      payload: { correlationId: 'pl-1', detail: { wrapper: 'PullResponse{ operation_id: op-77, aggregate_status: accepted }', meaning: 'the long op is running; progress + the final result ride the run-keyed events log (§4), NOT this exchange' } },
      note: 'A long op answers accepted first, carrying the operation_id that keys its events log. The final member/errors do NOT come back on this exchange — that gap is exactly what the closing log record closes (C-gwz-4).',
      docRef: `${GWZ} §4 (C-gwz-4)`,
      sets: { peer1: { 'pending pl-1': null, 'op op-77': 'running (pull_head ws-alpha)' } },
    },
    {
      state: 'D5', phase: 'SA', kind: 'message', from: 'local1', to: 'gryth1', frame: 'EXCHANGE-RESP', response: true,
      label: 'accepted (to UI)',
      payload: { correlationId: 'pl-1', detail: { operation_id: 'op-77', status: 'accepted' } },
      note: 'The UI gets the operation_id and will subscribe to the run-keyed events log for progress.',
      sets: { gryth1: { view: 'pull started (op-77)' } },
    },

    // ---- Phase SS: events stream -----------------------------------------
    {
      state: 'C1', phase: 'SS', kind: 'message', from: 'gryth1', to: 'local1', frame: 'SUBSCRIBE',
      label: 'subscribe: events log (keyed by operation_id)',
      payload: { share: 'ws-alpha', gladeId: 'gwz.pull.events', key: '{op-77}', shape: 'log', detail: { visibility: 'commons (workspace share); egress events read-gated by the surface grant in stage 2 (C-gwz-5) — allow-all here' } },
      note: 'The events log is a commons log keyed by the workspace share, one log per member keyed by operation_id (§4). The client subscribes to op-77 to watch progress.',
      docRef: `${GWZ} §4 (C-gwz-4/C-gwz-5) · §7`,
      sets: { gryth1: { subs: 'ws-alpha/gwz.pull.events{op-77}' }, local1: { 'sub ws-alpha/gwz.pull.events{op-77}': 'gryth1' } },
    },
    {
      state: 'C2', phase: 'SS', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'route the events log to the host',
      payload: { share: 'ws-alpha', detail: { answer: 'peer1 (holds the run-keyed log)' } },
      gate: { kind: 'routing', label: 'ServeClaim lookup', status: 'designed', note: 'The events log is served from the host that runs the op; commons read is a membership check in stage 2.' },
      note: 'The log interest routes to the host running the op.',
      docRef: `${GWZ} §4`,
      sets: { local1: { 'route ws-alpha/gwz.pull.events': 'peer1' } },
    },
    {
      state: 'C3', phase: 'SS', kind: 'message', from: 'local1', to: 'peer1', frame: 'SUBSCRIBE',
      label: 'forward events interest',
      payload: { share: 'ws-alpha', gladeId: 'gwz.pull.events', key: '{op-77}', shape: 'log' },
      gate: { kind: 'capability', label: 'commons read check', status: 'stub-allow-all', note: 'Stage 1 allow-all; stage 2 requires membership (local events) or the exact surface grant (egress events) per C-gwz-5.' },
      note: 'Interest lands at the host; the run-keyed log is the stream source.',
      docRef: `${GWZ} §4 (C-gwz-5)`,
      sets: { peer1: { 'sub ws-alpha/gwz.pull.events{op-77}': 'local1' } },
    },
    {
      state: 'D3', phase: 'SS', kind: 'internal', from: 'peer1', frame: 'PROVIDE',
      label: 'gwz-core fetches; emits OperationEvents',
      payload: { share: 'ws-alpha', detail: { events: 'operation_started · member_started · member_progress (GitTransferProgress) · member_finished — appended to the log keyed op-77 (917–936)', note: 'OperationEvent carries NO final result — that is a distinct closing record (§4)' } },
      note: 'The fetch runs; each OperationEvent appends to the run-keyed log. Progress is data on the log, not a side channel.',
      docRef: `${GWZ} §4`,
      sets: { peer1: { 'log op-77': '+started +member_progress (fetch 40%)' } },
    },
    {
      state: 'C5', phase: 'SS', kind: 'message', from: 'peer1', to: 'local1', frame: 'OPS', response: true,
      label: 'events replicate to the node',
      payload: { share: 'ws-alpha', gladeId: 'gwz.pull.events', key: '{op-77}', shape: 'log', detail: { ops: 'operation_started · member_progress (40%)' } },
      note: 'The log ops flow to the node replica (origin: peer1).',
      docRef: `${GWZ} §4`,
      sets: { local1: { 'replica ws-alpha/gwz.pull.events{op-77}': 'started, 40% (cursor 2)' } },
    },
    {
      state: 'C6', phase: 'SS', kind: 'message', from: 'local1', to: 'gryth1', frame: 'OPS', response: true,
      label: 'events forwarded to the UI',
      payload: { share: 'ws-alpha', gladeId: 'gwz.pull.events', key: '{op-77}', shape: 'log', detail: { progress: 'member_progress: fetch 40%' } },
      note: 'The subscribing session sees live progress. INV-2 holds: local1’s subscription table names gryth1 for this log.',
      docRef: `${GWZ} §4`,
      sets: { gryth1: { view: 'pull op-77: fetching 40%' } },
    },

    // ---- Phase SB: late subscriber backfills -----------------------------
    {
      state: 'C1', phase: 'SB', kind: 'message', from: 'gryth2', to: 'local1', frame: 'SUBSCRIBE',
      label: 'second view subscribes LATE',
      payload: { share: 'ws-alpha', gladeId: 'gwz.pull.events', key: '{op-77}', shape: 'log', detail: { cursor: 'from 0 — this session has seen no events yet' } },
      note: 'A second view joins after progress has already streamed; the substrate owes it the backlog from its cursor.',
      docRef: `${GWZ} §4`,
      sets: { gryth2: { subs: 'ws-alpha/gwz.pull.events{op-77}' }, local1: { 'sub ws-alpha/gwz.pull.events{op-77}': 'gryth1, gryth2' } },
    },
    {
      state: 'A4', phase: 'SB', kind: 'internal', from: 'local1', frame: 'FOLD',
      label: 'fold the events backlog from cursor',
      payload: { share: 'ws-alpha', gladeId: 'gwz.pull.events', key: '{op-77}', detail: { backfill: 'the replicated log from cursor 0: operation_started · member_progress (40%)', converge: 'a late subscriber converges by from-cursor backfill (§4) — the log is its own catch-up' } },
      note: 'Backfill is ordinary log replay from the node’s replica — the late subscriber gets exactly the events it missed, no host round-trip.',
      docRef: `${GWZ} §4`,
      sets: { local1: { 'backfill gryth2 op-77': 'from cursor 0' } },
    },
    {
      state: 'A5', phase: 'SB', kind: 'message', from: 'local1', to: 'gryth2', frame: 'OPS', response: true,
      label: 'backfilled events to the late view',
      payload: { share: 'ws-alpha', gladeId: 'gwz.pull.events', key: '{op-77}', shape: 'log', detail: { ops: 'operation_started · member_progress (40%) — the missed prefix' } },
      note: 'The late view catches up. INV-2 holds: local1’s subscription table now names gryth2 for this log too.',
      docRef: `${GWZ} §4`,
      sets: { gryth2: { view: 'pull op-77: fetching 40% (caught up)' } },
    },

    // ---- Phase SC: closing replicated result -----------------------------
    {
      state: 'C4', phase: 'SC', kind: 'internal', from: 'peer1', frame: 'PROVIDE',
      label: 'append the CLOSING OperationResult record',
      payload: { share: 'ws-alpha', gladeId: 'gwz.pull.events', key: '{op-77}', detail: { record: 'OperationResult{ started, finished_at_ms, members[], errors: [], aggregate_status: succeeded } — a CLOSING TERMINAL record appended to the run-keyed log (§4)', durability: 'because it lives on the REPLICATED log, it survives a provider restart — the "accepted pull never yields final member/errors" gap is closed durably (C-gwz-4)', view: 'a derived .result(op-77) query MAY project this record but is NOT the authority' } },
      note: 'The authoritative final result is not a paired result exchange (v2, retracted) — it is a closing, replicated OperationResult record on the events log. The log is where durability lives.',
      docRef: `${GWZ} §4 (C-gwz-4) · §13 (SR56-14)`,
      sets: { peer1: { 'log op-77': '+OperationResult (succeeded, members[3], errors[])', 'op op-77': 'complete (result on log)' } },
    },
    {
      state: 'C5', phase: 'SC', kind: 'message', from: 'peer1', to: 'local1', frame: 'OPS', response: true,
      label: 'closing record replicates',
      payload: { share: 'ws-alpha', gladeId: 'gwz.pull.events', key: '{op-77}', shape: 'log', detail: { ops: 'OperationResult(succeeded) — the terminal log record' } },
      note: 'The closing record replicates like any op; it is now durable on the node replica.',
      docRef: `${GWZ} §4`,
      sets: { local1: { 'replica ws-alpha/gwz.pull.events{op-77}': 'closed — OperationResult(succeeded, 3 members)' } },
    },
    {
      state: 'C6', phase: 'SC', kind: 'message', from: 'local1', to: 'gryth1', frame: 'OPS', response: true,
      label: 'final result to the first view',
      payload: { share: 'ws-alpha', gladeId: 'gwz.pull.events', key: '{op-77}', shape: 'log', detail: { result: 'members: [3 fast-forwarded] · errors: [] · succeeded' } },
      note: 'The first view reads the final members[]/errors[] off the log — no separate result fetch. INV-2 holds (local1 names gryth1).',
      docRef: `${GWZ} §4`,
      sets: { gryth1: { view: 'pull op-77: DONE (3 members ff, 0 errors)' } },
    },
    {
      state: 'B9', phase: 'SC', kind: 'message', from: 'local1', to: 'gryth2', frame: 'OPS', response: true,
      label: 'final result to the late view too',
      payload: { share: 'ws-alpha', gladeId: 'gwz.pull.events', key: '{op-77}', shape: 'log', detail: { result: 'same closing record — the log yields one authoritative result to every subscriber' } },
      note: 'Both views converge on the same closing record — one authoritative result, delivered from the log to each subscriber. INV-2 holds (local1 names gryth2).',
      docRef: `${GWZ} §4 (C-gwz-4)`,
      sets: { gryth2: { view: 'pull op-77: DONE (3 members ff, 0 errors)' } },
    },
  ],
};

// ---------------------------------------------------------------------------
// s-gwz-tag-egress — the FOUR-way tag split (C-gwz-2): tag-list (read) /
// tag-mutate (create,delete) / tag-fetch (egress-read) / tag-push (egress-write)
// on disjoint, closed, generated DTO op-enums. A read+local composition attaches
// tag-list + tag-mutate but NOT tag-fetch/tag-push — so a remote tag PUSH has no
// provider → absence as data; and a tag-list provider structurally cannot even
// receive a push op (push ∉ its wire TagOp enum — no runtime check). (C-gwz-2)
// ---------------------------------------------------------------------------
export const S_GWZ_TAG_EGRESS: Scenario = {
  id: 's-gwz-tag-egress',
  stage: 1,
  title: 'gwz tag split — four disjoint enums; remote push is absent',
  summary:
    'TagOp {create,list,fetch,push,delete} spans all four capability classes, so `tag` projects to FOUR surfaces on disjoint, closed, generated DTO op-enums. A read+local composition attaches tag-list{list} + tag-mutate{create,delete} only. Local tag list works; a tag-list provider structurally cannot receive a push op (push is not in its wire type). A remote tag PUSH has NO provider in this composition → absence as data (ExchangeRes{ok:false}). This is the least-privilege wall v2’s two-surface split failed to hold (C-gwz-2).',

  actors: pick('gryth1', 'local1', 'peer1'),

  initial: {
    gryth1: { session: 'local1 (open, gianni)' },
    local1: { 'session gryth1': 'open', 'fold home': 'ws-alpha — serving: peer1 (epoch 1)', links: 'peer1 (iroh)' },
    peer1: { serving: 'ws-alpha via grazel', 'sub home': 'local1 (mesh)' },
  },

  phases: [
    { id: 'TC', label: 'Read+local composition attaches two of four', summary: 'The composition attaches tag-list{list} and tag-mutate{create,delete}; tag-fetch and tag-push are NOT attached — a structural, authenticated wall (B1).' },
    { id: 'TR', label: 'Local tag list works', summary: 'A tag-list exchange succeeds; the provider’s wire TagOp enum is {list} only — it cannot receive a push.' },
    { id: 'TA', label: 'Remote tag push — no provider (absence as data)', summary: 'A tag-push exchange finds no attached provider → the exchange answers absence as data; there is no runtime "denied op" — the surface simply is not there.' },
  ],

  steps: [
    // ---- Phase TC: compose (attach two of four) --------------------------
    {
      state: 'C4', phase: 'TC', kind: 'internal', from: 'peer1', frame: 'PROVIDE',
      label: 'attach tag-list (read) — closed enum {list}',
      payload: { share: 'ws-alpha', gladeId: 'gwz.tag-list', detail: { enum: 'this provider’s wire TagOp sub-enum = {list} — disjoint + closed + generated (C-gwz-2)', class: 'read' } },
      gate: { kind: 'security', label: 'authenticated provider attach (B1)', status: 'stub-allow-all', note: 'B1: the provider authenticates and presents an exact provider.attach(share_id, glade_id) grant; an existing attachment is never silently replaced; stage 1 is allow-all at the seam.' },
      note: 'The composition attaches the tag READ surface. Its wire type carries only {list} — the four-way split is enforced by disjoint generated DTO enums, not a per-op runtime check.',
      docRef: `${GWZ} §2 (C-gwz-2) · §8 (B1)`,
      sets: { peer1: { 'provider ws-alpha/gwz.tag-list': 'gwz#1@peer1 attached — epoch 1' } },
    },
    {
      state: 'C4', phase: 'TC', kind: 'internal', from: 'peer1', frame: 'PROVIDE',
      label: 'attach tag-mutate (local) — enum {create,delete}',
      payload: { share: 'ws-alpha', gladeId: 'gwz.tag-mutate', detail: { enum: 'wire TagOp sub-enum = {create, delete} — local tag create/delete', notAttached: 'gwz.tag-fetch (egress-read) and gwz.tag-push (egress-write) are NOT attached — a read+local deployment', class: 'local-mutate' } },
      gate: { kind: 'security', label: 'authenticated provider attach (B1)', status: 'stub-allow-all', note: 'The egress wall is STRUCTURAL and authenticated: the mutating/egress members are present iff the composition attaches them. No racing peer can hijack an attached surface (epoch-guarded, B1).' },
      note: 'Local tag mutation is attached; the two egress tag surfaces are deliberately left off. "Compose only what you trust" is a hard wall (B1) — the four-way split keeps the egress grant surface separate at attach time too (§8).',
      docRef: `${GWZ} §2 (C-gwz-2) · §8 (B1)`,
      sets: { peer1: { 'provider ws-alpha/gwz.tag-mutate': 'gwz#1@peer1 attached — epoch 1', 'composition ws-alpha': 'read+local: tag-list, tag-mutate (tag-fetch/tag-push ABSENT)' } },
    },

    // ---- Phase TR: local tag list works ----------------------------------
    {
      state: 'D1', phase: 'TR', kind: 'message', from: 'gryth1', to: 'local1', frame: 'EXCHANGE',
      label: 'gwz.tag-list {list}',
      payload: { share: 'ws-alpha', gladeId: 'gwz.tag-list', shape: 'exchange', verb: 'tag', correlationId: 'tg-1', detail: { op: 'TagOp::list — the ONLY op in tag-list’s wire enum' } },
      note: 'The read surface answers list. A `push` op could not even be encoded onto this surface — it is not a member of tag-list’s wire TagOp enum (C-gwz-2).',
      docRef: `${GWZ} §2 (C-gwz-2)`,
      sets: { local1: { 'pending tg-1': 'gryth1 → tag-list@ws-alpha' } },
    },
    {
      state: 'C2', phase: 'TR', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'route to the tag-list provider',
      payload: { share: 'ws-alpha', gladeId: 'gwz.tag-list', detail: { answer: 'peer1 (gwz.tag-list attached)' } },
      gate: { kind: 'routing', label: 'provider entry-map lookup', status: 'designed', note: 'One provider per (share, glade id); the keyed provider entry map IS the routing table (§2.2).' },
      note: 'The read exchange routes to the attached tag-list provider.',
      docRef: `${SM} §2.2`,
      sets: { local1: { 'route ws-alpha/gwz.tag-list': 'peer1' } },
    },
    {
      state: 'D2', phase: 'TR', kind: 'message', from: 'local1', to: 'peer1', frame: 'EXCHANGE',
      label: 'forward tag-list',
      payload: { share: 'ws-alpha', gladeId: 'gwz.tag-list', shape: 'exchange', verb: 'tag', correlationId: 'tg-1' },
      note: 'Directed to the provider.',
      sets: { peer1: { 'pending tg-1': 'local1' } },
    },
    {
      state: 'D3', phase: 'TR', kind: 'internal', from: 'peer1', frame: 'PROVIDE',
      label: 'gwz-core lists tags',
      payload: { share: 'ws-alpha', detail: { engine: 'gwz-core git tag --list', tags: 'v1.0, v1.1, v2.0-rc' } },
      note: 'The read op runs; a tag-list provider is structurally incapable of a remote push — that authority is a different surface entirely.',
      docRef: 'gwz-core v0.9.2',
      sets: { peer1: { gwz: 'ws-alpha tags: v1.0, v1.1, v2.0-rc' } },
    },
    {
      state: 'D4', phase: 'TR', kind: 'message', from: 'peer1', to: 'local1', frame: 'EXCHANGE-RESP', response: true,
      label: 'TagResponse{tags[]}', payload: { correlationId: 'tg-1', detail: { ok: 'true', tags: '3' } },
      note: 'The method-specific TagResponse wrapper (tags[]) returns.',
      sets: { peer1: { 'pending tg-1': null } },
    },
    {
      state: 'D5', phase: 'TR', kind: 'message', from: 'local1', to: 'gryth1', frame: 'EXCHANGE-RESP', response: true,
      label: 'tag list to UI', payload: { correlationId: 'tg-1' },
      note: 'The tag list panel renders.',
      sets: { local1: { 'pending tg-1': null }, gryth1: { view: 'tags: v1.0, v1.1, v2.0-rc' } },
    },

    // ---- Phase TA: remote tag push — no provider -------------------------
    {
      state: 'D1', phase: 'TA', kind: 'message', from: 'gryth1', to: 'local1', frame: 'EXCHANGE',
      label: 'gwz.tag-push {push} (remote)',
      payload: { share: 'ws-alpha', gladeId: 'gwz.tag-push', shape: 'exchange', verb: 'tag', correlationId: 'tg-2', detail: { op: 'TagOp::push (egress-write) — a distinct surface with its own closed enum {push}' } },
      note: 'A remote tag push addresses the tag-push surface — the egress-write member of the four-way split. This composition never attached it.',
      docRef: `${GWZ} §2 (C-gwz-2)`,
      sets: { local1: { 'pending tg-2': 'gryth1 → tag-push@ws-alpha' } },
    },
    {
      state: 'C2', phase: 'TA', kind: 'internal', from: 'local1', frame: 'ROUTE', variant: 'a',
      variantNote: 'No provider is attached for gwz.tag-push in this read+local composition, so the entry-map lookup finds nothing — routing resolves to absence, not a denial.',
      label: 'no provider for tag-push → absence',
      payload: { share: 'ws-alpha', gladeId: 'gwz.tag-push', detail: { lookup: 'provider entry map has no gwz.tag-push — the surface was never attached', result: 'absence as data (ExchangeRes{ok:false}) — an unattached member has no provider (§8)', notARuntimeCheck: 'there is no "denied op" logic: the push op is not in any attached wire type — the surface simply is not present' } },
      gate: { kind: 'routing', label: 'provider entry-map lookup', status: 'designed', note: 'The composition wall is structural: a member is present iff its composition attaches it. Missing provider → absence as data, no runtime allow-list consulted.' },
      note: 'The heir of the retired allow-list: a member’s absence is the wall. No provider ⇒ the exchange answers absence as data — no verb-denial code path exists.',
      docRef: `${GWZ} §8 (B1) · §10`,
      sets: { local1: { 'route ws-alpha/gwz.tag-push': 'NONE — no provider (absence as data)' } },
    },
    {
      state: 'D5', phase: 'TA', kind: 'message', from: 'local1', to: 'gryth1', frame: 'EXCHANGE-RESP', response: true,
      label: 'absence as data (ok:false)',
      payload: { correlationId: 'tg-2', detail: { ok: 'false', reason: 'no provider for gwz.tag-push in this composition', ui: 'the remote-tag-push panel is structurally absent — nothing to render' } },
      note: 'The node answers the requester directly: absence as data. The remote tag push has no provider to reach, so the panel simply is not there — the egress wall held.',
      docRef: `${GWZ} §8 · ${SM} §2.4`,
      sets: { local1: { 'pending tg-2': null }, gryth1: { view: 'remote tag push: unavailable (not composed)' } },
    },
  ],
};

// ---------------------------------------------------------------------------
// s-gwz-create-recover — the durable create state machine
// intent → materialized → registered → claimed → complete (C-gwz-8). A crash
// AFTER disk success and BETWEEN the two record appends (registered but not yet
// claimed) replays FORWARD-ONLY and IDEMPOTENTLY to complete: re-materialize is
// a no-op, re-append is idempotent on record identity, the missing ServeClaim
// is appended — no orphan, no rollback. The HOME-share logs are authoritative.
// The create arm is the INTERNAL materializer leg of workspace.create (C-gwz-7).
// ---------------------------------------------------------------------------
export const S_GWZ_CREATE_RECOVER: Scenario = {
  id: 's-gwz-create-recover',
  stage: 1,
  title: 'gwz create recovery — forward-only, idempotent, no orphan',
  summary:
    'glade-gwz-create is the INTERNAL host-local leg of glade-workspaces’ workspace.create ceremony (C-gwz-7). The durable state machine is intent → materialized → registered → claimed → complete. peer3 crashes AFTER disk success and AFTER the WorkspaceEntry (registered) but BEFORE the ServeClaim (claimed). On restart it folds the HOME-share logs (the recovery authority), replays FORWARD-ONLY and IDEMPOTENTLY — re-materialize is a no-op, the WorkspaceEntry re-append is idempotent on record identity — appends the missing ServeClaim, and completes. No orphan, no compensating rollback (C-gwz-8).',

  actors: pick('gryth1', 'local1', 'peer3'),

  initial: {
    gryth1: { session: 'local1 (open, gianni)', view: 'workspaces' },
    local1: { 'session gryth1': 'open', 'sub home/dir.workspaces': 'gryth1', links: 'peer3 (iroh)' },
    peer3: { gwz: 'idle', 'sub home': 'local1 (mesh)' },
  },

  phases: [
    { id: 'CI', label: 'Intent + materialize + register', summary: 'The ceremony records intent durably, materializes disk (app-allocated root), then appends the WorkspaceEntry (registered) — records commit only after disk success.' },
    { id: 'CX', label: 'Crash between the two record appends', summary: 'peer3 crashes after registered but before claimed — a rollback design would risk an orphan; here recovery is forward-only.' },
    { id: 'CR', label: 'Forward-only idempotent replay → complete', summary: 'On restart peer3 folds the HOME logs, replays idempotently (re-materialize no-op, re-append idempotent), appends the missing ServeClaim, and completes — no orphan.' },
  ],

  steps: [
    // ---- Phase CI: intent + materialize + register -----------------------
    {
      state: 'D1', phase: 'CI', kind: 'message', from: 'gryth1', to: 'local1', frame: 'EXCHANGE',
      label: 'workspace.create (internal materializer leg)',
      payload: { gladeId: 'gwz.create', shape: 'exchange', verb: 'workspace.create', correlationId: 'cr-1', detail: { name: 'ws-new', target: 'peer3', leg: 'the INTERNAL host-local leg glade-workspaces’ workspace.create state machine invokes (C-gwz-7) — NOT a public gwz.create racing the ceremony', selection: 'NONE — creation cannot select; nothing exists to select yet (F5-10)' } },
      note: 'Creation members are the internal materializer leg of the public workspace.create ceremony. The ws.ops façade is retired (C-gwz-7); events + the closing result ride the HOME share until the new workspace’s share exists (§5).',
      docRef: `${GWZ} §5 (C-gwz-7, C-gwz-8)`,
      sets: { local1: { 'pending cr-1': 'gryth1 → create@peer3', 'create ws-new': 'intent — durably recorded on HOME (ceremony start)' } },
    },
    {
      state: 'C2', phase: 'CI', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'route to the target host',
      payload: { detail: { target: 'peer3 (named; creation is the one routed op that cannot consult a ServeClaim — it MAKES the thing claims are about)' } },
      gate: { kind: 'routing', label: 'create-target routing', status: 'designed', note: 'Routes by target; the app-allocated root comes from the data seam, never the request (§5).' },
      note: 'The create routes to the explicit target host.',
      docRef: `${GWZ} §5`,
      sets: { local1: { 'route create': 'peer3' } },
    },
    {
      state: 'D2', phase: 'CI', kind: 'message', from: 'local1', to: 'peer3', frame: 'EXCHANGE',
      label: 'forward create',
      payload: { gladeId: 'gwz.create', shape: 'exchange', verb: 'workspace.create', correlationId: 'cr-1' },
      note: 'Directed to peer3; the durable state machine runs there.',
      sets: { peer3: { 'pending cr-1': 'local1' } },
    },
    {
      state: 'X5', phase: 'CI', kind: 'internal', from: 'peer3', frame: 'PROVIDE',
      label: 'materialize — disk (app-allocated root)',
      payload: { detail: { disk: 'gwz init /srv/gwz/ws-new — root APP-ALLOCATED by the data seam (the ID→root map gains an entry), NOT the request; empty, workspace.lock held', state: 'intent → materialized (disk root+members exist)', order: 'disk FIRST; records only on success' } },
      note: 'The materialized state: disk exists. The root is allocated by the app data seam, never asserted by the DTO (§5, E-ws-1). A disk failure BEFORE registered would yield aggregate_status:failed + NO records.',
      docRef: `${GWZ} §5 (C-gwz-8)`,
      sets: { peer3: { gwz: 'gwz init ws-new (empty)', wc: 'ws-new checkout + lock HELD', 'create ws-new': 'materialized — disk OK' } },
    },
    {
      state: 'K1', phase: 'CI', kind: 'internal', from: 'peer3', frame: 'APPEND',
      label: 'register — WorkspaceEntry commits (record #1)',
      payload: { share: 'home', detail: { op: 'WorkspaceEntry(ws-new, 0 members, eligible: [peer3]) — a signed governance op (B5), on the HOME share', state: 'materialized → registered', identity: 'the record has a stable identity — a re-append is idempotent (C-gwz-8)' } },
      note: 'The first of the two record appends: the WorkspaceEntry (registered). Governance records are signed ops on the HOME share, which is the recovery authority.',
      docRef: `${GWZ} §5 (C-gwz-8, B5)`,
      sets: { peer3: { 'origin log': '+WorkspaceEntry(ws-new)', 'create ws-new': 'registered — WorkspaceEntry committed' } },
    },

    // ---- Phase CX: crash between the two appends --------------------------
    {
      state: 'A4', phase: 'CX', kind: 'internal', from: 'peer3', frame: 'FOLD',
      label: 'CRASH here — then restart + fold the HOME logs',
      payload: { detail: { crash: 'peer3 dies AFTER disk + AFTER WorkspaceEntry (registered), BEFORE the ServeClaim (claimed) — the exact between-the-two-appends window', recover: 'on restart, fold the HOME-share logs (the recovery authority): disk root exists · WorkspaceEntry ✓ · ServeClaim ✗', posture: 'FORWARD-ONLY — no compensating rollback, no orphan cleanup; a rollback design is exactly what would risk an orphan here' } },
      note: 'The crash lands between the two record appends. Recovery reads the durable HOME logs to learn the state = registered. There is nothing to undo; the machine only ever moves forward (C-gwz-8).',
      docRef: `${GWZ} §5 (C-gwz-8) · §13 (SR56-15)`,
      sets: { peer3: { gwz: 'restarted', 'create ws-new': 'recovered state: registered (WorkspaceEntry ✓, ServeClaim ✗)' } },
    },

    // ---- Phase CR: forward-only idempotent replay ------------------------
    {
      state: 'X5', phase: 'CR', kind: 'internal', from: 'peer3', frame: 'PROVIDE', variant: 'a',
      variantNote: 'Replay of the materialize step: re-materialize is a NO-OP because the disk root already exists — idempotent forward replay, not a fresh create.',
      label: 'replay materialize — no-op (disk exists)',
      payload: { detail: { remat: 're-materialize ws-new → NO-OP: /srv/gwz/ws-new + workspace.lock already exist', reappend: 're-appending the WorkspaceEntry is idempotent on record identity — no duplicate entry', invariant: 'replay is safe at ANY state: re-materialize no-op, re-append idempotent (C-gwz-8)' } },
      note: 'Forward replay is idempotent. The disk step no-ops; the WorkspaceEntry re-append dedups by record identity — no orphan, no half-create, no duplicate directory entry.',
      docRef: `${GWZ} §5 (C-gwz-8)`,
      sets: { peer3: { 'create ws-new': 'replayed to registered (idempotent — no duplicate)' } },
    },
    {
      state: 'H1', phase: 'CR', kind: 'internal', from: 'peer3', frame: 'LEASE',
      label: 'claimed — append the missing ServeClaim (record #2)',
      payload: { detail: { claim: 'ServeClaim(ws-new, peer3, epoch 1) — the append the crash skipped; a signed governance op (B5)', state: 'registered → claimed', basis: 'the lock was held from gwz init' } },
      note: 'Recovery completes the second record append — the ServeClaim (claimed) — the one the crash never reached. The lock has been continuously held since gwz init.',
      docRef: `${GWZ} §5 (C-gwz-8, B5)`,
      sets: { peer3: { 'claim ws-new': 'held — epoch 1', 'create ws-new': 'claimed — ServeClaim committed' } },
    },
    {
      state: 'K1', phase: 'CR', kind: 'internal', from: 'peer3', frame: 'APPEND',
      label: 'complete — the ceremony closes',
      payload: { share: 'home', detail: { state: 'claimed → complete', result: 'ws-new materialized + registered + claimed — one workspace, no orphan, no half-create', authority: 'the HOME-share logs are authoritative for this recovery (§5)' } },
      note: 'The state machine reaches complete. The crash-and-replay produced exactly one workspace with exactly one WorkspaceEntry and one ServeClaim — the forward-only idempotence guarantee (C-gwz-8).',
      docRef: `${GWZ} §5 (C-gwz-8)`,
      sets: { peer3: { 'create ws-new': 'complete (no orphan, no half-create)' } },
    },
    {
      state: 'B9', phase: 'CR', kind: 'message', from: 'peer3', to: 'local1', frame: 'OPS', response: true,
      label: 'records replicate (exactly once)',
      payload: { share: 'home', detail: { ops: 'WorkspaceEntry(ws-new) + ServeClaim(epoch 1) — folded once; the idempotent re-append never doubled the entry' } },
      note: 'The HOME-share records replicate to the node. Because re-append is idempotent, the directory shows ws-new exactly once, not twice — the fold is clean. INV-2 holds (peer3 names local1).',
      docRef: `${GWZ} §5`,
      sets: { local1: { 'fold home': 'ws-new@peer3 (empty, live) — one entry' } },
    },
    {
      state: 'D4', phase: 'CR', kind: 'message', from: 'peer3', to: 'local1', frame: 'EXCHANGE-RESP', response: true,
      label: 'create ok (recovered)',
      payload: { correlationId: 'cr-1', detail: { ok: 'true', workspace: 'ws-new (0 members)', recovery: 'forward-only replay completed the ceremony — no orphan' } },
      note: 'The ceremony answers success after forward recovery; the crash was invisible to the outcome.',
      sets: { peer3: { 'pending cr-1': null } },
    },
    {
      state: 'D5', phase: 'CR', kind: 'message', from: 'local1', to: 'gryth1', frame: 'EXCHANGE-RESP', response: true,
      label: 'workspace created (to UI)',
      payload: { correlationId: 'cr-1', detail: { workspace: 'ws-new (live @peer3)' } },
      note: 'The UI shows ws-new. Disk + records committed together, crash-recovered forward-only — no orphan anywhere.',
      sets: { local1: { 'pending cr-1': null }, gryth1: { view: '+ ws-new (empty, live @peer3)' } },
    },
  ],
};

// ---------------------------------------------------------------------------
// s-gwz-requester-ctx — attribution comes from the NODE-AUTHENTICATED
// ProviderCallContext delivered BESIDE the DTO (B3), never from a DTO principal
// field. A session forges a DTO principal claiming the owner; the context says
// who the caller really is; the forged field is IGNORED — there is no principal
// field to honor. (B3, the retired SR56-04 supplier.rs:146-147 anti-pattern)
// ---------------------------------------------------------------------------
export const S_GWZ_REQUESTER_CTX: Scenario = {
  id: 's-gwz-requester-ctx',
  stage: 1,
  title: 'gwz attribution — the context principal, not the DTO field',
  summary:
    'A guest session (eve) sends a gwz.commit DTO that FORGES a principal field claiming the owner (gianni). The node builds a ProviderCallContext from the AUTHENTICATED session (requester = eve) and delivers it beside — never inside — the request DTO (B3). gwz-core fills OperationAttribution.actor from the context principal, so the commit is attributed to eve; the forged DTO principal is IGNORED — the retired supplier.rs:146-147 anti-pattern where a caller-supplied req.principal was trusted (SR56-04).',

  actors: pick('guest1', 'local1', 'peer1'),

  initial: {
    // eve is a real, node-authenticated principal — a DIFFERENT one than the owner.
    guest1: { session: 'local1 (open, eve)' },
    local1: { 'session guest1': 'open (eve — node-authenticated device)', 'fold home': 'ws-alpha — serving: peer1 (epoch 1)', links: 'peer1 (iroh)' },
    peer1: { serving: 'ws-alpha via grazel', 'provider ws-alpha/gwz.commit': 'gwz#1@peer1 attached — epoch 1', 'sub home': 'local1 (mesh)' },
  },

  phases: [
    { id: 'RC', label: 'Authenticated context, forged DTO principal', summary: 'eve’s session is node-authenticated; her DTO forges the owner’s principal — the node builds the ProviderCallContext from the session, not the payload.' },
    { id: 'RI', label: 'Attribution = context principal (forgery ignored)', summary: 'gwz-core attributes the op to the context principal (eve); the DTO principal field has no field to honor and is ignored.' },
  ],

  steps: [
    // ---- Phase RC: authenticated context ---------------------------------
    {
      state: 'A1', phase: 'RC', kind: 'message', from: 'guest1', to: 'local1', frame: 'HELLO',
      label: 'eve’s session (node-authenticated)',
      payload: { detail: { session: 'sess-eve', principal: 'eve — fp:e11e (device cert bound at HELLO)', bind: 'the node binds the session principal from the authenticated Hello — never from a later payload (B3)' } },
      gate: { kind: 'security', label: 'HELLO principal seam', status: 'stub-allow-all', note: 'Stage 1 is allow-all at the door, but the identity is REAL and honest from stage 1 (B3): the session principal is the authenticated device’s, bound here, not asserted later.' },
      note: 'eve authenticates as herself. This bound principal — not anything in a request body — is what attribution will use.',
      docRef: `${GWZ} §6 (B3)`,
      sets: { local1: { 'session guest1': 'open (eve, fp:e11e — node-authenticated)' } },
    },
    {
      state: 'D1', phase: 'RC', kind: 'message', from: 'guest1', to: 'local1', frame: 'EXCHANGE',
      label: 'gwz.commit — DTO FORGES principal = owner',
      payload: { share: 'ws-alpha', gladeId: 'gwz.commit', shape: 'exchange', verb: 'commit', correlationId: 'rq-1', detail: { dto: 'CommitRequest DTO{ message: "…", principal: "gianni (owner)" } — a FORGED principal field', antiPattern: 'this is exactly the retired supplier.rs:146-147 shortcut (SR56-04): trusting a caller-supplied req.principal is FORGEABLE — Eve sets principal and the provider cannot tell her from the owner', ruling: 'the DTO carries NO authoritative principal; a DTO principal field MUST NOT override the context (§6)' } },
      note: 'eve tries the forgery: a DTO claiming to be the owner. Under the retired anti-pattern this would attribute the commit to gianni. Under B3 the field is inert.',
      docRef: `${GWZ} §6 (B3) · §13 (SR56-04)`,
      sets: { local1: { 'pending rq-1': 'guest1 → commit@ws-alpha (DTO claims principal=gianni)' } },
    },
    {
      state: 'C2', phase: 'RC', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'build the ProviderCallContext from the session',
      payload: { share: 'ws-alpha', gladeId: 'gwz.commit', detail: { ctx: 'ProviderCallContext{ requester: eve, session guest1, certified device fp:e11e, correlation rq-1 } — built from the AUTHENTICATED session', delivery: 'delivered BESIDE the DTO, never inside it (B3)', ignored: 'the DTO’s principal="gianni" is NOT read into the context' } },
      gate: { kind: 'routing', label: 'provider entry-map lookup', status: 'designed', note: 'The node constructs the context from the session it authenticated; the DTO is opaque data to this construction.' },
      note: 'The node builds the requester context from the session it authenticated — eve. The forged DTO field is not a source for the context. This is the whole seam: identity beside the request, not in it.',
      docRef: `${GWZ} §6 (B3)`,
      sets: { local1: { 'route ws-alpha/gwz.commit': 'peer1', 'requester rq-1': 'eve@fp:e11e via guest1' } },
    },
    {
      state: 'D2', phase: 'RC', kind: 'message', from: 'local1', to: 'peer1', frame: 'EXCHANGE',
      label: 'forward — context beside the DTO',
      payload: { share: 'ws-alpha', gladeId: 'gwz.commit', shape: 'exchange', verb: 'commit', correlationId: 'rq-1', detail: { ctx: 'requester=eve (authenticated)', dtoField: 'principal="gianni" still present in the body — but authoritatively inert' } },
      note: 'The exchange forwards with the authenticated context alongside. Forwarders preserve the context; local and forwarded paths use the same check (§6).',
      docRef: `${GWZ} §6 (B3)`,
      sets: { peer1: { 'pending rq-1': 'local1', 'requester rq-1': 'eve@fp:e11e via guest1' } },
    },

    // ---- Phase RI: attribution = context, forgery ignored ----------------
    {
      state: 'D3', phase: 'RI', kind: 'internal', from: 'peer1', frame: 'PROVIDE',
      label: 'gwz-core attributes to the CONTEXT principal',
      payload: { share: 'ws-alpha', detail: { execute: 'gwz-core commit on /srv/gwz/alpha', attribution: 'OperationAttribution.actor (525–532) filled from the ProviderCallContext principal = eve@fp:e11e (glade-users §1 fingerprint)', forgeryIgnored: 'the DTO principal="gianni" is IGNORED — there is no principal field to honor; check() evaluates against the context, not the body' } },
      note: 'The provider evaluates and attributes against the context principal. eve committed as eve; the forged owner field changed nothing. Any effectful follow-on uses the same authenticated principal unless an explicit delegation is verified.',
      docRef: `${GWZ} §6 (B3)`,
      sets: { peer1: { gwz: 'ws-alpha: commit by eve', 'attribution rq-1': 'actor eve@fp:e11e (from context; DTO principal=gianni IGNORED)' } },
    },
    {
      state: 'D4', phase: 'RI', kind: 'message', from: 'peer1', to: 'local1', frame: 'EXCHANGE-RESP', response: true,
      label: 'committed — attributed to eve',
      payload: { correlationId: 'rq-1', detail: { ok: 'true', attribution: 'eve@fp:e11e', notGianni: 'the forged owner attribution never took effect' } },
      note: 'The typed wrapper returns; the OperationAttribution names eve, the real caller.',
      sets: { peer1: { 'pending rq-1': null } },
    },
    {
      state: 'D5', phase: 'RI', kind: 'message', from: 'local1', to: 'guest1', frame: 'EXCHANGE-RESP', response: true,
      label: 'result (attributed honestly)',
      payload: { correlationId: 'rq-1', detail: { committed: 'by eve', lesson: 'attribution is the node-authenticated context, not a payload field' } },
      note: 'eve’s commit is recorded as eve’s. The forgery is inert because there is no principal field to honor — the SR56-04 anti-pattern is closed at the seam (B3).',
      docRef: `${GWZ} §6 (B3)`,
      sets: { local1: { 'pending rq-1': null }, guest1: { view: 'commit recorded (attributed to eve — forgery ignored)' } },
    },
  ],
};

// ---------------------------------------------------------------------------
// s-gwz-compose-readonly — a composition attaching ONLY the seven read members;
// the mutating/egress members have NO provider → their requests are absence as
// data. This is the allow-list’s heir: the read/mutate/egress wall is structural
// authenticated composition (B1), not a runtime DENIED_ARGS/ALLOWED_VERBS list.
// ---------------------------------------------------------------------------
export const S_GWZ_COMPOSE_READONLY: Scenario = {
  id: 's-gwz-compose-readonly',
  stage: 1,
  title: 'gwz read-only composition — mutating members are absent',
  summary:
    'A read-only deployment attaches ONLY the seven read members (status, ls, list-snapshots, diff, tag-list, stash-list, branch-list). A read (status) works. A local-mutate (commit) request finds NO attached provider → absence as data: the panel is structurally absent. The read/mutate/egress wall is authenticated composition (B1) — the retired exec.rs ALLOWED_VERBS/DENIED_ARGS allow-list’s heir, now a structural seam rather than a runtime string check.',

  actors: pick('gryth1', 'local1', 'peer1'),

  initial: {
    gryth1: { session: 'local1 (open, gianni)' },
    local1: { 'session gryth1': 'open', 'fold home': 'ws-alpha — serving: peer1 (epoch 1)', links: 'peer1 (iroh)' },
    peer1: { serving: 'ws-alpha via grazel', 'sub home': 'local1 (mesh)' },
  },

  phases: [
    { id: 'CA', label: 'Attach only the read members', summary: 'The composition attaches the seven read surfaces and no others — a structural, authenticated read-only deployment (B1).' },
    { id: 'CR', label: 'A read works', summary: 'A status exchange routes to its attached provider and answers.' },
    { id: 'CN', label: 'A mutating request has no provider', summary: 'A commit exchange finds no attached provider → absence as data; the mutating panel is structurally absent.' },
  ],

  steps: [
    // ---- Phase CA: attach the read set -----------------------------------
    {
      state: 'C4', phase: 'CA', kind: 'internal', from: 'peer1', frame: 'PROVIDE',
      label: 'attach the SEVEN read members only',
      payload: { share: 'ws-alpha', detail: { attached: 'gwz.status · gwz.ls · gwz.list-snapshots · gwz.diff · gwz.tag-list · gwz.stash-list · gwz.branch-list (the read surfaces)', absent: 'the 18 local-mutate / egress / create members are NOT attached', wall: 'the read/mutate/egress wall is STRUCTURAL authenticated composition (B1) — not a runtime allow-list' } },
      gate: { kind: 'security', label: 'authenticated provider attach (B1)', status: 'stub-allow-all', note: 'B1: each attach authenticates + presents an exact provider.attach grant; an unattached member has no provider at all. Stage 1 allow-all at the seam; the wall is the ABSENCE, always enforced.' },
      note: 'grazel composes the members it trusts — here the read set (§10). This is the allow-list’s heir: the exec.rs ALLOWED_VERBS/DENIED_ARGS list DIES; the wall is which surfaces exist, decided at composition time and authenticated (B1).',
      docRef: `${GWZ} §8 (B1) · §10`,
      sets: { peer1: { 'provider ws-alpha/gwz.status': 'gwz#1@peer1 attached — epoch 1', 'composition ws-alpha': 'READ-ONLY: 7 read members (no mutate/egress/create)' } },
    },

    // ---- Phase CR: a read works ------------------------------------------
    {
      state: 'D1', phase: 'CR', kind: 'message', from: 'gryth1', to: 'local1', frame: 'EXCHANGE',
      label: 'gwz.status (a read)',
      payload: { share: 'ws-alpha', gladeId: 'gwz.status', shape: 'exchange', verb: 'status', correlationId: 'ro-1' },
      note: 'A read member is attached, so it answers normally.',
      docRef: `${GWZ} §2`,
      sets: { local1: { 'pending ro-1': 'gryth1 → status@ws-alpha' } },
    },
    {
      state: 'C2', phase: 'CR', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'route to the status provider',
      payload: { share: 'ws-alpha', gladeId: 'gwz.status', detail: { answer: 'peer1 (gwz.status attached)' } },
      gate: { kind: 'routing', label: 'provider entry-map lookup', status: 'designed', note: 'The status surface is present in the composition; it routes.' },
      note: 'The read routes to its attached provider.',
      docRef: `${SM} §2.2`,
      sets: { local1: { 'route ws-alpha/gwz.status': 'peer1' } },
    },
    {
      state: 'D2', phase: 'CR', kind: 'message', from: 'local1', to: 'peer1', frame: 'EXCHANGE',
      label: 'forward status',
      payload: { share: 'ws-alpha', gladeId: 'gwz.status', shape: 'exchange', verb: 'status', correlationId: 'ro-1' },
      note: 'Directed to the provider.',
      sets: { peer1: { 'pending ro-1': 'local1' } },
    },
    {
      state: 'D3', phase: 'CR', kind: 'internal', from: 'peer1', frame: 'PROVIDE',
      label: 'gwz-core status',
      payload: { share: 'ws-alpha', detail: { engine: 'gwz-core status', result: '3 members, clean' } },
      note: 'The read op runs.',
      docRef: 'gwz-core v0.9.2',
      sets: { peer1: { gwz: 'ws-alpha status: 3 clean' } },
    },
    {
      state: 'D4', phase: 'CR', kind: 'message', from: 'peer1', to: 'local1', frame: 'EXCHANGE-RESP', response: true,
      label: 'StatusResponse', payload: { correlationId: 'ro-1', detail: { ok: 'true', members: '3 clean' } },
      note: 'Typed wrapper back.',
      sets: { peer1: { 'pending ro-1': null } },
    },
    {
      state: 'D5', phase: 'CR', kind: 'message', from: 'local1', to: 'gryth1', frame: 'EXCHANGE-RESP', response: true,
      label: 'status to UI', payload: { correlationId: 'ro-1' },
      note: 'The read panel renders.',
      sets: { local1: { 'pending ro-1': null }, gryth1: { view: 'ws-alpha status (3 clean)' } },
    },

    // ---- Phase CN: a mutating request has no provider --------------------
    {
      state: 'D1', phase: 'CN', kind: 'message', from: 'gryth1', to: 'local1', frame: 'EXCHANGE',
      label: 'gwz.commit (a local-mutate)',
      payload: { share: 'ws-alpha', gladeId: 'gwz.commit', shape: 'exchange', verb: 'commit', correlationId: 'ro-2' },
      note: 'A mutating member — never attached in this read-only composition.',
      docRef: `${GWZ} §2`,
      sets: { local1: { 'pending ro-2': 'gryth1 → commit@ws-alpha' } },
    },
    {
      state: 'C2', phase: 'CN', kind: 'internal', from: 'local1', frame: 'ROUTE', variant: 'a',
      variantNote: 'No provider is attached for gwz.commit in the read-only composition — the entry-map lookup finds nothing, so routing resolves to absence, not a denial.',
      label: 'no provider for commit → absence',
      payload: { share: 'ws-alpha', gladeId: 'gwz.commit', detail: { lookup: 'provider entry map has no gwz.commit', result: 'absence as data (ExchangeRes{ok:false}) — the mutating member is structurally absent (§8)', noAllowList: 'there is no DENIED_ARGS/ALLOWED_VERBS check to consult — the surface simply is not present (§10)' } },
      gate: { kind: 'routing', label: 'provider entry-map lookup', status: 'designed', note: 'The wall is the absence of the surface, not a runtime string check. B1 makes it structural + authenticated.' },
      note: 'The mutating request has no provider. This is precisely the allow-list’s replacement: not a verb the node refuses, but a surface the composition never offered.',
      docRef: `${GWZ} §8 (B1) · §10`,
      sets: { local1: { 'route ws-alpha/gwz.commit': 'NONE — no provider (absence as data)' } },
    },
    {
      state: 'D5', phase: 'CN', kind: 'message', from: 'local1', to: 'gryth1', frame: 'EXCHANGE-RESP', response: true,
      label: 'absence as data (ok:false)',
      payload: { correlationId: 'ro-2', detail: { ok: 'false', reason: 'no provider for gwz.commit in this composition', ui: 'a read-only deployment visibly lacks the mutating panels' } },
      note: 'The node answers absence as data. The read-only deployment visibly lacks its mutating members — the structural wall, made legible.',
      docRef: `${GWZ} §8 · ${SM} §2.4`,
      sets: { local1: { 'pending ro-2': null }, gryth1: { view: 'commit: unavailable (read-only composition)' } },
    },
  ],
};

// ---------------------------------------------------------------------------
// s-gwz-push-deny (STAGE 2) — push denied at the SURFACE by a MISSING gwz.push
// grant. Unlike compose-readonly (where the surface is absent), here the egress
// surface IS attached — the denial is an ordinary per-surface CapabilityGrant
// check (NOT an allow-list), and it answers failure as data. This is the stage-2
// leg: the identity these checks consume is already real from stage 1 (§8).
// ---------------------------------------------------------------------------
export const S_GWZ_PUSH_DENY: Scenario = {
  id: 's-gwz-push-deny',
  stage: 2,
  title: 'gwz push denied — a missing surface grant (failure as data)',
  summary:
    'Stage 2: the gwz.push egress surface IS attached and routable, but the requester holds NO gwz.push grant. The authority checks the ordinary per-surface CapabilityGrant (not an allow-list, not an ActionKind vocabulary) and DENIES — answering failure as data with a typed GwzError. The four-way tag split keeps tag-push a separate grant surface, so the egress wall holds at grant time too (§8). Contrast s-gwz-compose-readonly, where the surface is structurally absent; here it exists and the grant is the gate.',

  actors: pick('gryth1', 'local1', 'peer1'),

  initial: {
    gryth1: { session: 'local1 (open, gianni)' },
    local1: { 'session gryth1': 'open', 'fold home': 'ws-alpha — serving: peer1 (epoch 1)', links: 'peer1 (iroh)' },
    // The egress surface is attached; the requester holds read grants but NOT
    // the gwz.push surface grant — the per-member grant model (§8). No 'grant
    // gryth1 ws-alpha' (share-level) is emitted: gating is per-surface, and no
    // OPS is served in this trace, so INV-4 is inert by construction.
    peer1: {
      serving: 'ws-alpha via grazel',
      'provider ws-alpha/gwz.push': 'gwz#1@peer1 attached — epoch 1',
      'surface-grant gryth1 gwz.tag-list': 'read (has this)',
      'surface-grant gryth1 gwz.push': 'ABSENT — no egress grant',
      'sub home': 'local1 (mesh)',
    },
  },

  phases: [
    { id: 'PA', label: 'Push attempted; surface grant checked', summary: 'The egress surface is attached and routes; the authority evaluates the per-surface gwz.push grant against the context principal.' },
    { id: 'PD', label: 'Denied — no gwz.push grant (failure as data)', summary: 'The grant is absent; the authority denies and answers a typed GwzError — failure as data, not a crash, not an allow-list refusal.' },
  ],

  steps: [
    // ---- Phase PA: push attempted, grant checked -------------------------
    {
      state: 'D1', phase: 'PA', kind: 'message', from: 'gryth1', to: 'local1', frame: 'EXCHANGE',
      label: 'gwz.push (egress)',
      payload: { share: 'ws-alpha', gladeId: 'gwz.push', shape: 'exchange', verb: 'push', correlationId: 'pd-1', detail: { dto: 'PushRequest DTO (remote/refspec override)', class: 'egress — network write' } },
      note: 'A push to remotes. The surface is attached (contrast compose-readonly) — so the question is not existence but AUTHORIZATION.',
      docRef: `${GWZ} §1 (#19) · §8`,
      sets: { local1: { 'pending pd-1': 'gryth1 → push@ws-alpha' } },
    },
    {
      state: 'C2', phase: 'PA', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'route to the (attached) push provider',
      payload: { share: 'ws-alpha', gladeId: 'gwz.push', detail: { answer: 'peer1 (gwz.push IS attached)', ctx: 'ProviderCallContext{ requester: gianni, session gryth1 } delivered beside the DTO (B3)' } },
      gate: { kind: 'routing', label: 'provider entry-map lookup', status: 'enforced', note: 'The surface exists and routes; the grant check happens at the authority. Routing is not the wall here — the grant is.' },
      note: 'The egress surface routes normally. The authenticated context rides along; the denial is a grant decision, not a routing miss.',
      docRef: `${GWZ} §8 · §6 (B3)`,
      sets: { local1: { 'route ws-alpha/gwz.push': 'peer1', 'requester pd-1': 'gianni@fp:11a7 via gryth1' } },
    },
    {
      state: 'D2', phase: 'PA', kind: 'message', from: 'local1', to: 'peer1', frame: 'EXCHANGE',
      label: 'forward push (context beside DTO)',
      payload: { share: 'ws-alpha', gladeId: 'gwz.push', shape: 'exchange', verb: 'push', correlationId: 'pd-1' },
      note: 'Directed to the host; the surface grant is evaluated there.',
      sets: { peer1: { 'pending pd-1': 'local1', 'requester pd-1': 'gianni@fp:11a7 via gryth1' } },
    },

    // ---- Phase PD: denied — no grant -------------------------------------
    {
      state: 'S6', phase: 'PD', kind: 'internal', from: 'peer1', frame: 'ROUTE',
      label: 'surface-grant check: DENY (no gwz.push grant)',
      payload: { share: 'ws-alpha', gladeId: 'gwz.push', detail: { check: 'check() for the gwz.push surface against requester gianni', grant: 'gryth1 has NO gwz.push CapabilityGrant (per-surface, §8) — this is an ORDINARY surface grant, not an allow-list entry and not an ActionKind sub-vocabulary', splitHolds: 'the four-way tag split keeps tag-push a SEPARATE grant surface, so a read/local grant never confers egress-write (C-gwz-2)', verdict: 'DENY' } },
      gate: { kind: 'capability', label: 'per-surface grant check', status: 'enforced', note: 'Stage 2: each gwz.<member> exchange IS the grant unit (§8). Egress members are gated by their own grants + real credentials. The identity checked is already real from stage 1 (B3).' },
      note: 'The denial is a per-surface grant decision at the authority — the honest stage-2 gate. It is not a verb the node blacklists (the allow-list is retired, §10); it is a surface the requester was never granted.',
      docRef: `${GWZ} §8 · §2 (C-gwz-2)`,
      sets: { peer1: { 'denied pd-1': 'gryth1 → gwz.push (no surface grant)' } },
    },
    {
      state: 'D4', phase: 'PD', kind: 'message', from: 'peer1', to: 'local1', frame: 'EXCHANGE-RESP', response: true,
      label: 'denied (ok:false, typed GwzError)',
      payload: { correlationId: 'pd-1', detail: { ok: 'false', error: 'GwzError{ authz_denied }: no gwz.push grant', remedy: 'request a gwz.push grant from the workspace owner', dataNotException: 'failure is DATA (ExchangeRes.ok stays true; the wrapper carries the failure) — never a crash (B2)' } },
      note: 'The authority answers a well-formed denied wrapper. Egress events/results would ALSO be unreadable without the surface grant (commons + surface-grant check, C-gwz-5) — the wall is consistent across the exchange and its log.',
      docRef: `${GWZ} §8 · §4 (C-gwz-5, B2)`,
      sets: { peer1: { 'pending pd-1': null } },
    },
    {
      state: 'D5', phase: 'PD', kind: 'message', from: 'local1', to: 'gryth1', frame: 'EXCHANGE-RESP', response: true,
      label: 'denial surfaced to the UI',
      payload: { correlationId: 'pd-1', detail: { result: 'denied', reason: 'no gwz.push grant', remedy: 'ask the owner for a push grant' } },
      note: 'The push panel shows an honest denial with the remedy — failure as data. The surface exists; the grant is what is missing.',
      docRef: `${GWZ} §8 · ${SM} §2.4`,
      sets: { local1: { 'pending pd-1': null }, gryth1: { view: 'push denied: no grant (request one from the owner)' } },
    },
  ],
};
