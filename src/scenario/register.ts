// App registration — the <app>.glade file loaded as runtime DATA (GDL-037/038).
// grazel-app.glade is an application's declaration package: BindingDecls,
// ServiceDefinitions, ACL seeds, and a WorkspaceEntry. A node REGISTERS it as ordinary records
// (the same records dynamic config writes); the ACL seeds COMPILE TO grant
// records under the registrant's chain; and the management surface is
// ordinary bindings over system shares — never a privileged plane.
import type { Scenario } from './types';
import { pick } from './actors';

const GDS = 'GladeDeclSurface';
const AZ = 'GladeAuthzModel';

export const S_APP_REGISTER: Scenario = {
  id: 's-app-register',
  stage: 1,
  title: 'App registration — .glade loaded as data',
  summary:
    'grazel-app.glade is loaded (not compiled): its glade ids + shapes register as ordinary records, its ACL seeds compile to grant records under the registrant’s chain, and the management surface is plain bindings — reads are subscriptions, writes are appends.',

  actors: pick('local1', 'gryth1'),

  initial: {
    local1: { 'grant local1 home': 'operator (registrant chain)' },
  },

  phases: [
    { id: 'RL', label: 'Load + register the file', summary: 'Read <app>.glade as runtime data; register its declarations as ordinary records.' },
    { id: 'RC', label: 'ACL seeds → grant records', summary: 'Seeds compile to CapabilityGrants at registration; the fold stays the only runtime authority.' },
    { id: 'RM', label: 'Management surface = ordinary bindings', summary: 'A management UI reads via subscriptions and writes via appends over the system shares — no privileged plane.' },
  ],

  steps: [
    // ---- Phase RL: load + register ---------------------------------------
    {
      state: 'P1', phase: 'RL', kind: 'internal', from: 'local1', frame: 'FOLD',
      label: 'read grazel-app.glade',
      payload: { detail: { file: 'grazel-app.glade', contents: 'BindingDecls (4 workspace surfaces: ws.tree, ws.files, ws.diff, term.log + 3 composed supplier surfaces: gwz.output, chat.msgs, chat.groups) + ServiceDefinition + ACL seeds + WorkspaceEntry (ws-razel)', composed: 'the supplier surfaces are PRE-DECLARED (P1.S3): they exist node-side whether or not a supplier host is running — declaring is contributing records, not spawning a process', mode: 'LOADED, not compiled — runtime data, never a compiler front-end', xlang: 'ids/shapes are data; key TYPES reference taut messages (existing codegen), so TS/RS/PY agree by reading the same declarations' } },
      note: 'A gryth peer node = glade node + grazel authority sessions + this file. Base glade also loads its OWN app file, glade-sys.glade — grazel is just an application; base glade stays app-agnostic and operates on records whoever wrote them.',
      docRef: `${GDS} · The <app>.glade file · GDL-037`,
      sets: { local1: { 'app grazel': 'parsed (7 bindings, 1 service, 2 ACL seeds, 1 workspace)' } },
    },
    {
      state: 'P2', phase: 'RL', kind: 'internal', from: 'local1', frame: 'APPEND',
      label: 'register declarations as records',
      payload: { detail: { records: 'BindingDecl + ServiceDefinition + WorkspaceEntry records under the registrant chain', same: 'byte-identical to what dynamic configuration writes at runtime', diff: 're-registration DIFFS against existing records (GQ-6 pinning) — frozen-once-shared, renames are alias records' } },
      note: 'Declaration is inert data until a binder exists; registration is just appending records. There is no second, privileged “install” path — an app only ever CONTRIBUTES records.',
      docRef: `${GDS} · Contents · GDL-038`,
      sets: { local1: { 'records': '+7 BindingDecl, +1 ServiceDefinition (grazel), +1 WorkspaceEntry (ws-razel)' } },
    },

    // ---- Phase RC: ACL seeds compile to grants ---------------------------
    {
      state: 'S1', phase: 'RC', kind: 'internal', from: 'local1', frame: 'APPEND',
      label: 'ACL seed → CapabilityGrant',
      payload: { share: 'home', detail: { seed: 'ACL seeds: (grazel, read.*) + (grazel, gwz.*) for the owner principal', compiledTo: 'one CapabilityGrant{...} per seed, appended under the REGISTRANT’s chain', why: 'the file is a bootstrap SHORTCUT, not a parallel ACL system' } },
      note: 'The seeds become ordinary grant records — the same kind s-grant appends by hand. Nothing about them is special once written.',
      docRef: `${GDS} · The <app>.glade file (ACL seeds) · ${AZ} §3`,
      sets: { local1: { 'grant owner grazel': 'read.*, gwz.* (from ACL seeds)', 'records': '+2 CapabilityGrant (seeds)' } },
    },
    {
      state: 'A4', phase: 'RC', kind: 'internal', from: 'local1', frame: 'FOLD',
      label: 'the fold is the only authority',
      payload: { detail: { rule: 'runtime ACL updates WIN by ordinary fold rules (LWW / revocation-wins)', reReg: 're-registering the file diffs against records — it cannot clobber a later runtime revocation', authority: 'the fold, not the file' } },
      note: 'A seed that was later revoked at runtime stays revoked: the file seeds once, the fold rules forever. This is what keeps “.glade is data” honest.',
      docRef: `${GDS} · The <app>.glade file · ${AZ} §4`,
      sets: { local1: { 'authority': 'fold (seeds + runtime updates merged)' } },
    },

    // ---- Phase RM: management surface = ordinary bindings ----------------
    {
      state: 'A1', phase: 'RM', kind: 'message', from: 'gryth1', to: 'local1', frame: 'HELLO',
      label: 'management UI session',
      payload: { detail: { session: 'sess-m01', principal: 'gianni (admin)', app: 'an ORDINARY grip app over glade-sys.glade bindings' } },
      gate: { kind: 'security', label: 'HELLO principal seam', status: 'stub-allow-all', note: 'The management UI opens the same session every client opens — there is no admin socket, no privileged plane (GDL-023’s console collapsed to user scale).' },
      note: 'Management is a grip app like any other; its power is only the grants its principal holds.',
      docRef: `${GDS} · The <app>.glade file (glade-sys.glade) · GDL-038`,
      sets: { local1: { 'session gryth1': 'open (admin principal)' } },
    },
    {
      state: 'A3', phase: 'RM', kind: 'message', from: 'gryth1', to: 'local1', frame: 'SUBSCRIBE',
      label: 'read = subscribe (dir.grants)',
      payload: { share: 'home', gladeId: 'dir.grants', key: '∅ (unkeyed)', shape: 'log' },
      note: 'A management READ is an ordinary subscription to a system share — dir.grants is a binding declared by glade-sys.glade, no different in kind from dir.workspaces or node.status.',
      docRef: `${GDS} · The <app>.glade file (glade-sys.glade)`,
      sets: { local1: { 'sub home/dir.grants': 'gryth1' }, gryth1: { subs: 'home/dir.grants' } },
    },
    {
      state: 'A5', phase: 'RM', kind: 'message', from: 'local1', to: 'gryth1', frame: 'OPS',
      label: 'grants appear as data', response: true,
      payload: { share: 'home', gladeId: 'dir.grants', shape: 'log', detail: { ops: 'CapabilityGrant records — including the ACL-seed grant from phase RC' } },
      note: 'The seeded grant shows up in the management view as an ordinary record. The console does not query a config object; it subscribes to a share.',
      docRef: `${GDS} · The <app>.glade file (glade-sys.glade)`,
      sets: { gryth1: { view: 'grants: owner→grazel read.*, gwz.* (+ others)' } },
    },
    {
      state: 'J3', phase: 'RM', kind: 'message', from: 'gryth1', to: 'local1', frame: 'APPEND',
      label: 'write = append (revoke a grant)',
      payload: { share: 'home', detail: { op: 'CapabilityRevocation{...} appended by the admin principal', effect: 'effects are VERBS, all gated by the same check() — no back door', symmetry: 'reads = subscriptions, writes = record appends: the whole management surface' } },
      note: 'A management WRITE is the same append any client makes — gated by the same check() as everything else. There is no privileged plane anywhere in the story; power is grants, not sockets.',
      docRef: `${GDS} · The <app>.glade file (glade-sys.glade) · ${AZ} §6`,
      sets: { local1: { 'records': '+1 CapabilityRevocation (via management surface)' }, gryth1: { view: 'grant revoked (append accepted)' } },
    },
  ],
};
