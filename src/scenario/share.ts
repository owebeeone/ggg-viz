// glade-share spine traces (GLP-0006 §VI, RULED 2026-07-12) — links, direct
// membership ceremonies, and the grant-request lifecycle.
//
// The ruled core (glade-share §1): DIRECT membership (E-share-1) is the
// normative flow — `share.create/invite/grant/revoke/status` are a first-class
// ceremony the share family OWNS, expressed over ORDINARY grant records (AZ §4
// — policy rides the share; GDL-038 — no privileged plane). Links (E-share-2)
// layer ON TOP: a capture/restore path that ultimately mints the SAME grant
// records. v1 link capture admits only portable commons grants + inline
// share/glade IDs; a private/account ref (self:alice) is REJECTED at capture.
// The knock (D11) is a DIRECTED, authenticated request to the target authority
// (requester = the B3 principal, never caller-asserted) with a durable offline
// queue; read access never implies append. The knock user-test runs at the
// first GATED stage and proves revocation + wrong-principal denial (E-share-3).
//
// Stage split (§7): the direct-membership exchanges, capture/restore, closure +
// membership-snapshot grants are buildable NOW as data (stage 1); the denial
// that triggers the knock, the cut of `share.revoke`, and the load-bearing
// directed-request path live at the first gated stage (stage 2).
import type { Scenario } from './types';
import { pick } from './actors';

const SH = 'glade-share';
const AZ = 'GladeAuthzModel';
const SM = 'GladeSupplierModel';

// ---------------------------------------------------------------------------
// s-share-create (stage 1, E-share-1) — the direct membership ceremony:
// share.create mints a share (commons + policy binding) and seeds its ACL over
// ORDINARY grant records (not a link); share.status reads exactly one member.
// ---------------------------------------------------------------------------
export const S_SHARE_CREATE: Scenario = {
  id: 's-share-create',
  stage: 1,
  title: 'Share create — direct membership, ordinary grant records',
  summary:
    'gianni runs the share.create ceremony (E-share-1): the authority mints a new share — its commons + a policy binding — and SEEDS the ACL as an ordinary CapabilityGrant record (the creator’s owner membership), never a link and never a privileged plane. share.status then reads exactly one member. Links layer on top of this; they are not how a share is born.',

  actors: pick('gryth1', 'local1'),

  initial: {
    gryth1: { session: 'local1 (open, gianni)', view: 'no shares yet' },
    local1: { 'session gryth1': 'open (gianni)' },
  },

  phases: [
    { id: 'SC1', label: 'Mint the share', summary: 'share.create is a submitted intent; the authority materializes the new share (commons + policy binding) — self-routed, because it MAKES the thing grants will be about.' },
    { id: 'SC2', label: 'Seed the ACL (ordinary grant records)', summary: 'The creator’s membership is an ordinary CapabilityGrant appended into the new share’s policy binding — the .glade ACL seed COMPILES TO grant records at registration; no link, no privileged store.' },
    { id: 'SC3', label: 'Status reads exactly one member', summary: 'share.status folds the membership + pending-request fold: exactly one member (the creator, owner), zero pending.' },
  ],

  steps: [
    // ---- Phase SC1: mint the share ---------------------------------------
    {
      state: 'D1', phase: 'SC1', kind: 'message', from: 'gryth1', to: 'local1', frame: 'EXCHANGE',
      label: 'share.create (a submitted intent)',
      payload: { gladeId: 'share.ops', shape: 'exchange', verb: 'share.create', correlationId: 'sc-1', detail: { name: 'ws-team', commons: 'the shared zone the members converge on', policy: 'a policy binding where grant records will live (AZ §4 — policy rides the share)', notALink: 'this is the direct-membership ceremony (E-share-1) — creation is NOT a by-product of a link' } },
      note: 'share.create is a first-class ceremony the share family OWNS (E-share-1). Each share.* is a submitted intent (H-R3): the client asks, the authority validates + appends the canonical record.',
      docRef: `${SH} §1/§6 (E-share-1)`,
      sets: { local1: { 'pending sc-1': 'gryth1 → share.create ws-team' } },
    },
    {
      state: 'C2', phase: 'SC1', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'route to self — creation makes the thing grants are about',
      payload: { detail: { target: 'self (the creator’s own node materializes the new share)', why: 'like workspace.create, share.create is the one routed op that cannot consult an existing claim — it MAKES the share' } },
      gate: { kind: 'routing', label: 'create-target routing', status: 'designed', note: 'Stage-1 routes the create to the materializing node; stage 2 asks which principals may create shares where (GDL-016). Routing is unchanged by the membership model.' },
      note: 'The create materializes on the authority node. No prior ServeClaim exists — the ceremony brings the share into being.',
      docRef: `${SM} §2 · GDL-016`,
      sets: { local1: { 'route create': 'self (share materialize)' } },
    },
    {
      state: 'K1', phase: 'SC1', kind: 'internal', from: 'local1', frame: 'APPEND',
      label: 'mint the share: commons + policy binding',
      payload: { share: 'home', detail: { op: 'ShareEntry(ws-team) — commons zone + policy binding', policyBinding: 'ws-team/policy = a log where grant-instances (incl. disposition lifecycle) live (§4)', substance: 'a share is its commons + the ACL policy that rides it — no dedicated link-share, no privileged plane (GDL-038)' } },
      note: 'The new share is an ordinary directory record: its commons and the policy binding that will hold every grant. The policy binding IS the database of record for membership + requests (§4).',
      docRef: `${SH} §1/§4 · GDL-038`,
      sets: { local1: { 'origin log': '+ShareEntry(ws-team)', 'binding ws-team/policy': 'log (grant-instances live here)' } },
    },

    // ---- Phase SC2: seed the ACL over ordinary grant records -------------
    {
      state: 'S1', phase: 'SC2', kind: 'internal', from: 'local1', frame: 'APPEND',
      label: 'seed the ACL: the creator’s owner grant (ordinary record)',
      payload: { share: 'ws-team', detail: { op: 'CapabilityGrant{subject: gianni, resource: (ws-team, commons), verbs: [owner/all], disposition: granted}', seed: 'the .glade ACL seed COMPILES TO grant records at registration — the fold is the only runtime authority', notALink: 'membership is minted as an ordinary grant record here, NOT captured/restored from a link (links layer on top, §1)' } },
      note: 'The whole ACL is ordinary grant records: the creator’s membership is one CapabilityGrant in the share’s own policy binding. Same shape + same place as every later invite/grant (§4). No side channel, no owner-plane.',
      docRef: `${SH} §1/§4 (E-share-1) · ${AZ} §4`,
      sets: { local1: { 'grant gryth1 ws-team': 'owner (all verbs)' } },
    },
    {
      state: 'D5', phase: 'SC2', kind: 'message', from: 'local1', to: 'gryth1', frame: 'EXCHANGE-RESP',
      label: 'share.create ok — creator holds membership', response: true,
      payload: { correlationId: 'sc-1', detail: { ok: 'true', share: 'ws-team', member: 'gianni (owner)', seededVia: 'ordinary grant record (not a link)' } },
      note: 'The ceremony completes: the share exists and the creator is its first member — as data in the policy binding.',
      docRef: `${SM} §2.3 · ${SH} §1`,
      sets: { local1: { 'pending sc-1': null }, gryth1: { view: 'created ws-team (owner)' } },
    },

    // ---- Phase SC3: status reads exactly one member ----------------------
    {
      state: 'D1', phase: 'SC3', kind: 'message', from: 'gryth1', to: 'local1', frame: 'EXCHANGE',
      label: 'share.status ws-team',
      payload: { share: 'ws-team', gladeId: 'share.ops', shape: 'exchange', verb: 'share.status', correlationId: 'ss-1' },
      note: 'share.status reads a share’s membership + pending-request fold (§6) — the fifth direct-membership exchange.',
      docRef: `${SH} §6`,
      sets: { local1: { 'pending ss-1': 'gryth1 → share.status ws-team' } },
    },
    {
      state: 'A4', phase: 'SC3', kind: 'internal', from: 'local1', frame: 'FOLD',
      label: 'fold the membership + pending fold',
      payload: { share: 'ws-team', detail: { members: '1 — gianni (owner)', pending: '0', source: 'the fold over the policy binding’s grant-instances yields the current disposition per instance (§4)' } },
      note: 'Membership is a fold over ordinary grant records; the pending queue is the fold over disposition: requested. Right now: exactly one member, zero pending.',
      docRef: `${SH} §4/§6`,
      sets: { local1: { 'fold ws-team/policy': '1 member (gianni owner) · 0 pending' } },
    },
    {
      state: 'D5', phase: 'SC3', kind: 'message', from: 'local1', to: 'gryth1', frame: 'EXCHANGE-RESP',
      label: 'status: exactly one member', response: true,
      payload: { correlationId: 'ss-1', detail: { members: 'gianni (owner) — exactly 1', pending: 'none' } },
      note: 'A freshly created share has exactly one member: its creator. Everything past this is invite/grant layering more grant records onto the same policy binding.',
      docRef: `${SH} §1/§6`,
      sets: { gryth1: { view: 'ws-team members: gianni (owner) — exactly 1' } },
    },
  ],
};

// ---------------------------------------------------------------------------
// s-share-invite (stage 1, E-share-1 · AZ-16) — share.invite files a pending
// grant; share.grant mints the membership unit (commons + the member’s own
// private zone); the grant appears on BOTH sides; the admitted principal mounts
// the commons.
// ---------------------------------------------------------------------------
export const S_SHARE_INVITE: Scenario = {
  id: 's-share-invite',
  stage: 1,
  title: 'Share invite/grant — the AZ-16 membership unit, on both sides',
  summary:
    'gianni share.invite’s dana — a pending grant (disposition: requested, §4). share.grant then admits her: the authority mints ONE membership grant per domain — the AZ-16 unit = commons + dana’s OWN private zone (self:dana), never fiddled individually. The grant appears on BOTH sides (authority node + replica), share.status shows two members, and dana mounts the commons.',

  actors: pick('gryth1', 'guest1', 'local1', 'peer1'),

  initial: {
    gryth1: { session: 'local1 (open, owner of ws-team)', view: 'ws-team (owner)' },
    guest1: { device: 'cert chains to dana root (fp:d4a2)' },
    local1: {
      'session gryth1': 'open (owner)',
      'grant gryth1 ws-team': 'owner (all verbs)',
      'sub home': 'peer1 (mesh)',
      links: 'peer1 (iroh)',
    },
    peer1: {
      serving: 'ws-team via grazel (authority replica)',
      'grant gryth1 ws-team': 'owner (all verbs, replicated)',
      'sub home': 'local1 (mesh)',
    },
  },

  phases: [
    { id: 'SI1', label: 'Invite — a pending grant', summary: 'share.invite offers membership: the authority appends a CapabilityGrant-shaped record with disposition: requested (§4). A request IS a pending grant — same shape, same place.' },
    { id: 'SI2', label: 'Grant — the AZ-16 unit', summary: 'share.grant admits dana: ONE membership grant per domain = commons + her own private zone (self:dana). The disposition flips requested → granted as a new record.' },
    { id: 'SI3', label: 'Appears on both sides + status', summary: 'The grant replicates: it now appears on the authority node AND the replica. share.status shows two members.' },
    { id: 'SI4', label: 'The member mounts the commons', summary: 'dana’s session opens and subscribes the commons — the normative direct path (E-share-1): invited directly, she appears as a member and mounts.' },
  ],

  steps: [
    // ---- Phase SI1: invite — a pending grant -----------------------------
    {
      state: 'D1', phase: 'SI1', kind: 'message', from: 'gryth1', to: 'local1', frame: 'EXCHANGE',
      label: 'share.invite dana',
      payload: { share: 'ws-team', gladeId: 'share.ops', shape: 'exchange', verb: 'share.invite', correlationId: 'iv-1', detail: { principal: 'dana (fp:d4a2)', resource: '(ws-team, commons)' } },
      note: 'share.invite offers membership to a principal — a submitted intent the authority answers by filing a pending grant (§1/§4).',
      docRef: `${SH} §1/§6`,
      sets: { local1: { 'pending iv-1': 'gryth1 → share.invite dana' } },
    },
    {
      state: 'S1', phase: 'SI1', kind: 'internal', from: 'local1', frame: 'APPEND',
      label: 'file the pending grant (disposition: requested)',
      payload: { share: 'ws-team', detail: { op: 'CapabilityGrant{subject: dana, resource: (ws-team, commons), disposition: requested}', model: 'a request IS a pending grant — CapabilityGrant-shaped, stored where the ACLs live (§4). The disposition lifecycle is: requested → granted → revoked.' } },
      note: 'The invite appends a requested-disposition record into the share’s OWN policy binding — no separate request store (§4). The fold surfaces it as a pending member.',
      docRef: `${SH} §4`,
      sets: { local1: { 'request guest1 ws-team': 'disposition: requested (invited)' } },
    },
    {
      state: 'D5', phase: 'SI1', kind: 'message', from: 'local1', to: 'gryth1', frame: 'EXCHANGE-RESP',
      label: 'invited — pending', response: true,
      payload: { correlationId: 'iv-1', detail: { disposition: 'requested', member: 'dana (pending)' } },
      note: 'The invite is filed; dana is a pending member until admitted.',
      docRef: `${SM} §2.3`,
      sets: { local1: { 'pending iv-1': null }, gryth1: { view: 'invited dana — pending grant' } },
    },

    // ---- Phase SI2: grant — the AZ-16 unit -------------------------------
    {
      state: 'D1', phase: 'SI2', kind: 'message', from: 'gryth1', to: 'local1', frame: 'EXCHANGE',
      label: 'share.grant dana (admit)',
      payload: { share: 'ws-team', gladeId: 'share.ops', shape: 'exchange', verb: 'share.grant', correlationId: 'gr-1', detail: { principal: 'dana (fp:d4a2)', effect: 'privileged — mint the membership grant(s); NEVER a direct client append (§1)' } },
      note: 'share.grant admits a principal. It carries privileged effect, so the AUTHORITY appends the canonical grant — the client only submits the intent.',
      docRef: `${SH} §1/§6`,
      sets: { local1: { 'pending gr-1': 'gryth1 → share.grant dana' } },
    },
    {
      state: 'S1', phase: 'SI2', kind: 'internal', from: 'local1', frame: 'APPEND',
      label: 'mint the membership grant — the AZ-16 unit',
      payload: { share: 'ws-team', detail: { op: 'CapabilityGrant{subject: dana, resource: (ws-team), verbs: [read.subscribe], disposition: granted}', az16: 'ONE membership grant per domain = commons + dana’s OWN private zone (self:dana), TOGETHER — zones are never fiddled individually (AZ-16)', instance: 'the disposition flips requested → granted as a NEW record (§4) — the chain is the history' } },
      note: 'AZ-16 keeps the unit honest: admitting dana grants her the commons AND her own private zone in a single grant. The requested instance folds to granted.',
      docRef: `${SH} §3/§4 (AZ-16) · ${AZ} §4a`,
      sets: {
        local1: {
          'grant guest1 ws-team': 'read.subscribe (member)',
          'request guest1 ws-team': 'disposition: granted',
          'membership guest1 ws-team': 'commons + private zone self:dana (AZ-16 unit)',
        },
      },
    },
    {
      state: 'D5', phase: 'SI2', kind: 'message', from: 'local1', to: 'gryth1', frame: 'EXCHANGE-RESP',
      label: 'dana admitted', response: true,
      payload: { correlationId: 'gr-1', detail: { member: 'dana', unit: 'commons + her private zone (AZ-16)' } },
      note: 'dana is now a member: one grant record, one membership unit.',
      docRef: `${SM} §2.3`,
      sets: { local1: { 'pending gr-1': null }, gryth1: { view: 'dana is a member (commons + her private zone)' } },
    },

    // ---- Phase SI3: appears on both sides + status -----------------------
    {
      state: 'B9', phase: 'SI3', kind: 'message', from: 'local1', to: 'peer1', frame: 'OPS',
      label: 'the grant replicates — appears on the OTHER side',
      payload: { share: 'home', detail: { ops: 'CapabilityGrant(dana → ws-team, AZ-16 unit)', reading: 'grants ride the share’s policy binding — any node holding the bytes holds the policy (§4). The grant now appears on BOTH sides.' } },
      note: 'Replication IS the control plane: the membership grant reaches the replica and folds identically. The grant is visible on the authority node (minted) AND on peer1 (replicated) — the s-grant beat.',
      docRef: `${SH} §4 · ${AZ} §4`,
      sets: { peer1: { 'grant guest1 ws-team': 'read.subscribe (member, replicated)' } },
    },
    {
      state: 'D1', phase: 'SI3', kind: 'message', from: 'gryth1', to: 'local1', frame: 'EXCHANGE',
      label: 'share.status ws-team',
      payload: { share: 'ws-team', gladeId: 'share.ops', shape: 'exchange', verb: 'share.status', correlationId: 'st-1' },
      note: 'Read back the membership + pending fold after the admit.',
      docRef: `${SH} §6`,
      sets: { local1: { 'pending st-1': 'gryth1 → share.status' } },
    },
    {
      state: 'A4', phase: 'SI3', kind: 'internal', from: 'local1', frame: 'FOLD',
      label: 'fold: two members, zero pending',
      payload: { share: 'ws-team', detail: { members: '2 — gianni (owner) · dana (member)', pending: '0', instances: 'dana’s (requested → granted) chain folds to the current disposition: granted (§4)' } },
      note: 'The fold over the policy binding now yields two members. dana’s pending request folded to granted — the chain shows the transition.',
      docRef: `${SH} §4/§6`,
      sets: { local1: { 'fold ws-team/policy': '2 members (gianni owner · dana member) · 0 pending' } },
    },
    {
      state: 'D5', phase: 'SI3', kind: 'message', from: 'local1', to: 'gryth1', frame: 'EXCHANGE-RESP',
      label: 'status: both members', response: true,
      payload: { correlationId: 'st-1', detail: { members: 'gianni (owner), dana (member) — 2' } },
      note: 'share.status shows both members — the grant appears on both the authority and the replica, and in the read-back fold.',
      docRef: `${SH} §6`,
      sets: { gryth1: { view: 'ws-team members: gianni (owner), dana (member) — 2' } },
    },

    // ---- Phase SI4: the member mounts the commons ------------------------
    {
      state: 'A1', phase: 'SI4', kind: 'message', from: 'guest1', to: 'local1', frame: 'HELLO',
      label: 'dana’s session opens',
      payload: { detail: { session: 'sess-dana', principal: 'dana (fp:d4a2)' } },
      gate: { kind: 'security', label: 'HELLO principal seam', status: 'stub-allow-all', note: 'Stage 1 asserts the principal (identity as data); nothing enforced. Her membership is the grant record that names her, which stage 2 will gate the commons join on.' },
      note: 'dana opens a session. Knowing who she is grants nothing on its own — her standing in ws-team is exactly the grant record that names her.',
      docRef: `${SM} §4`,
      sets: { local1: { 'session guest1': 'open (dana)' } },
    },
    {
      state: 'C1', phase: 'SI4', kind: 'message', from: 'guest1', to: 'local1', frame: 'SUBSCRIBE',
      label: 'dana subscribes the commons',
      payload: { share: 'ws-team', gladeId: 'ws.body', key: '"" (commons)', shape: 'log' },
      note: 'The admitted principal joins the commons zone (empty key). This is the normative direct path (E-share-1): invited directly, she mounts.',
      docRef: `${SH} §1/§9 (E-share-1)`,
      sets: { guest1: { subs: 'ws-team/ws.body (commons)' }, local1: { 'sub ws-team/ws.body': 'guest1' } },
    },
    {
      state: 'A5', phase: 'SI4', kind: 'message', from: 'local1', to: 'guest1', frame: 'OPS', response: true,
      label: 'commons served — dana mounts',
      payload: { share: 'ws-team', gladeId: 'ws.body', shape: 'log', detail: { ops: 'ws-team commons history (origin-attributed)' } },
      note: 'dana mounts the commons — the whole point of membership. INV-2 holds: local1’s subscription table names guest1 for ws-team/ws.body.',
      docRef: `${SH} §9`,
      sets: { guest1: { view: 'ws-team commons (live) — mounted as a member' } },
    },
  ],
};

// ---------------------------------------------------------------------------
// s-share-revoke (stage 2, AZ-16) — share.revoke cuts a member’s AZ-16 unit in
// ONE act: the commons AND the member’s own private zone, together, forward-
// only. A later re-share.grant mints a fresh instance and re-admits (§4).
// ---------------------------------------------------------------------------
export const S_SHARE_REVOKE: Scenario = {
  id: 's-share-revoke',
  stage: 2,
  title: 'Share revoke — one act cuts commons AND the private zone',
  summary:
    'gianni share.revoke’s dana. Because AZ-16 made membership ONE grant per domain, revocation-wins deletes that single unit — so the commons stream AND dana’s own private zone (self:dana) are both cut in one act, never fiddled individually. It is forward-only (history already replicated is honestly not clawed back). A later re-share.grant mints a FRESH instance and re-admits (§4).',

  actors: pick('gryth1', 'guest1', 'local1', 'peer1'),

  initial: {
    gryth1: { session: 'local1 (open, owner)', role: 'owner of ws-team' },
    guest1: { session: 'local1 (open)', view: 'ws-team commons + my private zone (live)', 'local cache': 'ws-team history (replicated)' },
    local1: {
      'session gryth1': 'open (owner)',
      'session guest1': 'open (member)',
      'grant guest1 ws-team': 'read.subscribe (member — AZ-16 unit: commons + private zone self:dana)',
      'membership guest1 ws-team': 'commons + private zone self:dana',
      'sub ws-team/ws.body': 'guest1',
      'sub ws-team/ws.selection{self:dana}': 'guest1',
      'sub home': 'peer1 (mesh)',
      links: 'peer1 (iroh)',
    },
    peer1: {
      serving: 'ws-team via grazel',
      'sub ws-team/ws.body': 'local1',
      'grant guest1 ws-team': 'read.subscribe (member, replicated)',
    },
  },

  phases: [
    { id: 'RV1', label: 'Revoke is one act', summary: 'The owner appends a CapabilityRevocation over the AZ-16 unit; revocation-wins deletes the single membership grant from the fold.' },
    { id: 'RV2', label: 'Both cut, together', summary: 'One fold flip cuts BOTH the commons stream and the private-zone routing — proof that revoke operates on one unit, not two. Every hop enforces.' },
    { id: 'RV3', label: 'Forward-only + re-admit', summary: 'History already replicated is not clawed back; a later share.grant mints a fresh instance N+1 and re-admits.' },
  ],

  steps: [
    // ---- Phase RV1: revoke is one act ------------------------------------
    {
      state: 'J3', phase: 'RV1', kind: 'message', from: 'gryth1', to: 'local1', frame: 'APPEND',
      label: 'owner invokes share.revoke(dana)',
      payload: { share: 'ws-team', detail: { op: 'CapabilityRevocation(dana → ws-team membership)', unit: 'the AZ-16 unit — one revocation cuts the WHOLE membership (commons + private zone), never a per-zone op', signedBy: 'owner chain' } },
      note: 'share.revoke cuts a principal’s membership. It is the revocation-wins op over dana’s single AZ-16 grant — the same write path as everything else, the owner acting as the authority.',
      docRef: `${SH} §1/§3 (AZ-16) · ${AZ} §4`,
      sets: { gryth1: { 'origin log': '+CapabilityRevocation(dana, ws-team)' } },
    },
    {
      state: 'S2', phase: 'RV1', kind: 'internal', from: 'local1', frame: 'APPEND',
      label: 'fold flips: revocation-wins deletes the unit',
      payload: { share: 'ws-team', detail: { fold: 'grants(dana, ws-team) → REVOKED', consequence: 'the ONE membership grant deletes — so BOTH the commons and the private-zone routing lose their enabling grant in a SINGLE fold flip' } },
      note: 'Revocation-wins is a FOLD rule (tombstone precedence) — no clock games. Deleting the AZ-16 unit is what makes “cut commons AND private zone” one act. Any later serve to dana now trips INV-4.',
      docRef: `${SH} §4 · ${AZ} §4`,
      sets: { local1: { 'grant guest1 ws-team': null, 'membership guest1 ws-team': null, 'revoked guest1 ws-team': 'AZ-16 unit (commons + private zone self:dana)' } },
    },

    // ---- Phase RV2: both cut, together -----------------------------------
    {
      state: 'S3', phase: 'RV2', kind: 'message', from: 'local1', to: 'guest1', frame: 'STATUS',
      label: 'commons stream CUT',
      payload: { share: 'ws-team', gladeId: 'ws.body', detail: { result: 'subscription terminated', reason: 'membership revoked' } },
      gate: { kind: 'security', label: 'enforcement cut', status: 'enforced', note: 'Enforcement re-evaluates on grant-state change, not only at subscribe time: a live stream is a standing decision, revisited when its premise dies.' },
      note: 'The commons subscription drops the moment the fold flips.',
      docRef: `${SH} §7 (gated stage)`,
      sets: { local1: { 'sub ws-team/ws.body': null }, guest1: { view: 'ws-team commons: stream ended (revoked)' } },
    },
    {
      state: 'S3', phase: 'RV2', kind: 'message', from: 'local1', to: 'guest1', frame: 'STATUS', variant: 'a',
      variantNote: 'Not a second, separate revoke: the SAME membership revocation ALSO cuts dana’s private zone (self:dana). One AZ-16 unit revoked → both zones gone.',
      label: 'private zone ALSO cut — by the same act',
      payload: { share: 'ws-team', gladeId: 'ws.selection', key: 'self:dana', detail: { result: 'private-zone routing removed', proof: 'the private zone rode the membership grant (AZ-16/AZ-17: no zone-scoped grant ever existed) — so revoking membership cuts it too, in the SAME act' } },
      note: 'This is the claim, mechanically: dana’s private zone is cut by the identical revocation — because AZ-16 revoked ONE unit, not two. Zones are never fiddled individually.',
      docRef: `${SH} §3 (AZ-16) · ${AZ} §4a`,
      sets: { local1: { 'sub ws-team/ws.selection{self:dana}': null }, guest1: { view: 'ws-team commons + private zone: BOTH ended (one revoke)' } },
    },
    {
      state: 'B9', phase: 'RV2', kind: 'message', from: 'local1', to: 'peer1', frame: 'OPS',
      label: 'revocation replicates',
      payload: { share: 'home', detail: { ops: 'CapabilityRevocation(dana → ws-team)' } },
      note: 'The revocation op reaches every replica the way all ops do.',
      docRef: `${SH} §4`,
      sets: { peer1: { inbox: '+CapabilityRevocation(dana)' } },
    },
    {
      state: 'S2', phase: 'RV2', kind: 'internal', from: 'peer1', frame: 'APPEND',
      label: 'peer enforces too',
      payload: { share: 'ws-team', detail: { fold: 'grants(dana, ws-team) → REVOKED here as well', reach: 'a direct dana session at peer1 would now be refused HERE — no single bouncer to route around' } },
      note: 'Every hop enforces from its own fold. Revocation-wins converges everywhere the share replicates.',
      docRef: `${SH} §7 · ${AZ} §4`,
      sets: { peer1: { 'grant guest1 ws-team': null, 'revoked guest1 ws-team': 'AZ-16 unit (replicated)' } },
    },

    // ---- Phase RV3: forward-only + re-admit ------------------------------
    {
      state: 'S3', phase: 'RV3', kind: 'message', from: 'local1', to: 'gryth1', frame: 'STATUS', variant: 'b',
      variantNote: 'The owner’s confirmation view — not a cut — carrying the forward-only honesty statement.',
      label: 'owner sees it done — with the residue caveat', response: true,
      payload: { detail: { revoked: 'dana → ws-team (commons + private, one act)', residue: 'ops already replicated to dana’s local cache are NOT clawed back — forward-only (§4 revocation-wins is forward-only)' } },
      gate: { kind: 'security', label: 'forward-only honesty', status: 'designed', note: 'Revocation stops NEW flow everywhere; it cannot reach into offline replicas. The UI states the residue instead of pretending retroactive un-sharing.' },
      note: 'The honest residue: dana keeps the history she already had (see her `local cache`, unchanged this whole trace). Revocation is forward-only.',
      docRef: `${SH} §4 · GDL-009`,
      sets: { gryth1: { view: 'revocation confirmed — dana cut (commons + private); residue caveat shown' } },
    },
    {
      state: 'J3', phase: 'RV3', kind: 'message', from: 'gryth1', to: 'local1', frame: 'APPEND',
      label: 'owner re-grants dana (share.grant again)',
      payload: { share: 'ws-team', detail: { op: 'CapabilityGrant{subject: dana, resource: (ws-team), disposition: granted}', instance: 'a NEW instance N+1 referencing the same (principal, resource); the revoked instance stays DEAD (§4 — approve↔revoke flipping is instance-mint, not mutation)' } },
      note: 'Re-approval mints a fresh grant instance — the revocation-wins fold rule is preserved (the old instance is still revoked), while the approver gets a change-my-mind UI; the chain shows every flip.',
      docRef: `${SH} §4`,
      sets: { gryth1: { 'origin log': '+CapabilityGrant(dana, ws-team) instance 2' } },
    },
    {
      state: 'S1', phase: 'RV3', kind: 'internal', from: 'local1', frame: 'APPEND',
      label: 'fold flips: dana re-admitted (fresh instance)',
      payload: { share: 'ws-team', detail: { fold: 'grants(dana, ws-team) → read.subscribe (instance 2)', restored: 'the AZ-16 unit is back — commons + private zone self:dana' } },
      note: 'The fold ACROSS instances yields the current disposition: instance 2 is granted, so dana is a member again — the same one-unit membership.',
      docRef: `${SH} §4 (§4 instances)`,
      sets: { local1: { 'grant guest1 ws-team': 'read.subscribe (member) — instance 2', 'membership guest1 ws-team': 'commons + private zone self:dana (re-admitted)' } },
    },
    {
      state: 'C1', phase: 'RV3', kind: 'message', from: 'guest1', to: 'local1', frame: 'SUBSCRIBE',
      label: 'dana re-subscribes the commons',
      payload: { share: 'ws-team', gladeId: 'ws.body', key: '"" (commons)', shape: 'log' },
      note: 'Same subscribe as ever — the request never changed; the fold did.',
      docRef: `${SH} §9`,
      sets: { guest1: { subs: 'ws-team/ws.body (commons)' }, local1: { 'sub ws-team/ws.body': 'guest1' } },
    },
    {
      state: 'S4', phase: 'RV3', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'check(): ALLOW — instance 2 grant',
      payload: { share: 'ws-team', detail: { verdict: 'ALLOW', basis: 'read.subscribe ∈ grant(dana, ws-team) instance 2' } },
      gate: { kind: 'capability', label: 'commons-join capability check', status: 'enforced', note: 'Same pure check(), different fold (instance 2 present), different verdict — re-admitted.' },
      note: 'Deterministic: any replica with the same op-set reaches the same verdict — dana is allowed again.',
      docRef: `${AZ} §6`,
    },
    {
      state: 'A5', phase: 'RV3', kind: 'message', from: 'local1', to: 'guest1', frame: 'OPS', response: true,
      label: 'commons re-served — dana re-admitted',
      payload: { share: 'ws-team', gladeId: 'ws.body', shape: 'log', detail: { ops: 'ws-team commons (live again)' } },
      note: 'Re-approving mints a new grant and works again. INV-4 holds: local1’s fold carries dana’s instance-2 grant; INV-2 holds: the sub table names guest1.',
      docRef: `${SH} §4/§9`,
      sets: { guest1: { view: 'ws-team commons (live again — re-admitted, instance 2)' } },
    },
  ],
};

// ---------------------------------------------------------------------------
// s-knock-directed (stage 2, D11 · E-share-3) — a late-comer clicks a link,
// is denied, and knocks: a DIRECTED, authenticated request to the target
// authority (requester = the B3 principal, supplied by context — never caller-
// asserted) through a durable offline queue. Read does NOT imply append. A
// forged / wrong-principal request is denied.
// ---------------------------------------------------------------------------
export const S_KNOCK_DIRECTED: Scenario = {
  id: 's-knock-directed',
  stage: 2,
  title: 'Knock — a directed, authenticated access request (D11)',
  summary:
    'bob clicks gianni’s link into ws-secret → the mount is DENIED (the gated stage) → glade-share offers the knock. The knock is a DIRECTED request to the target authority (the grantor of ws-secret), never a write into the carrying share; the requester-fp is the B3 authenticated principal from the caller CONTEXT, never caller-asserted; and a durable offline queue holds it until the sleeping grantor attaches. Read never implies append (a direct policy append is refused). Ingestion → notify → approve → the mount unblocks. A forged requester (mallory asserting bob’s fp) is stamped as mallory by B3 and denied as a wrong principal.',

  actors: pick('guest1', 'gryth3', 'gryth1', 'local1', 'peer1'),

  initial: {
    guest1: { session: 'local1 (open)', device: 'cert chains to bob root (fp:b0b1)', view: 'clicked gianni’s link into ws-secret' },
    gryth3: { session: 'local1 (open)', device: 'cert chains to mallory root (fp:m4110)' },
    gryth1: { session: 'local1 (open, owner)' },
    local1: {
      'session guest1': 'open (bob, fp:b0b1)',
      'session gryth3': 'open (mallory, fp:m4110)',
      'session gryth1': 'open (gianni, owner)',
      'grant gryth1 ws-secret': 'owner (all verbs)',
      'sub ws-secret/policy': 'gryth1',
      'sub home': 'peer1 (mesh)',
      links: 'peer1 (iroh) — grantor authority currently ASLEEP',
    },
    peer1: {
      serving: 'ws-secret via grazel — the TARGET AUTHORITY (holds the policy binding)',
      'grant gryth1 ws-secret': 'owner (all verbs, replicated)',
      'sub home': 'local1 (mesh)',
      status: 'OFFLINE (asleep) — a durable queue will hold the knock (D11)',
    },
  },

  phases: [
    { id: 'KN1', label: 'Denied → knock offered', summary: 'A late-comer clicks the link; the gated stage denies the mount; glade-share intercepts the denial for link-carried refs and offers “request access”.' },
    { id: 'KN2', label: 'Directed + B3 + durable queue', summary: 'The knock is a directed request to the target authority; the requester-fp is stamped from the AUTHENTICATED session (B3), never the payload; the offline grantor’s queue holds it.' },
    { id: 'KN3', label: 'Read ≠ append (deny)', summary: 'bob tries to append the request record directly (he can READ the carrying share). Denied: read access to a share never confers append to its policy binding.' },
    { id: 'KN4', label: 'Ingest → approve → unblock', summary: 'The grantor attaches; the queue delivers; the authority validates the B3 requester and appends disposition: requested; the grantor is notified, approves, and the mount unblocks.' },
    { id: 'KN5', label: 'Wrong-principal / forged denied', summary: 'mallory knocks, forging bob’s fp in the payload. B3 stamps the true requester (mallory); the authority finds no valid path to the closure and denies.' },
  ],

  steps: [
    // ---- Phase KN1: denied → knock offered -------------------------------
    {
      state: 'C1', phase: 'KN1', kind: 'message', from: 'guest1', to: 'local1', frame: 'SUBSCRIBE',
      label: 'bob clicks the link → mounts the ref',
      payload: { share: 'ws-secret', gladeId: 'ws.tree', key: '{root:"/"}', shape: 'value', detail: { link: 'lh-7a2 (a portable commons ref, from gianni’s link)', bob: 'a late-comer with NO grant for ws-secret' } },
      note: 'A link is a restorable slice; clicking mounts its refs. bob has no membership — this mount is where the knock ceremony begins.',
      docRef: `${SH} §5.1`,
      sets: { guest1: { subs: 'ws-secret/ws.tree (requested via link)' } },
    },
    {
      state: 'S4', phase: 'KN1', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'check(): DENY — no grant',
      payload: { share: 'ws-secret', detail: { principal: 'bob@fp:b0b1', grants: 'none for ws-secret', verdict: 'DENY' } },
      gate: { kind: 'capability', label: 'fan-out capability check', status: 'enforced', note: 'The FIRST gated stage: allow-all can never fire a denial-triggered knock (§7). Here the deny is real, so the knock user-test can run honestly (E-share-3).' },
      note: 'The gated denial glade-share’s tap intercepts — specifically for link-carried refs — to offer the knock.',
      docRef: `${SH} §5.1/§7 (E-share-3)`,
      sets: { local1: { 'denied guest1': 'ws-secret (no grant) — knock offered' } },
    },
    {
      state: 'S3', phase: 'KN1', kind: 'message', from: 'local1', to: 'guest1', frame: 'STATUS', response: true,
      label: 'denied → offer “request access”',
      payload: { share: 'ws-secret', detail: { result: 'denied', remedy: 'request access (knock) — a DIRECTED request to the target authority, not a write into the carrying share' } },
      note: 'The tap intercepts the denial for the link-carried ref and offers the knock. Denial is data with a remedy.',
      docRef: `${SH} §5.1`,
      sets: { guest1: { view: 'ws-secret: denied — [Request access]' } },
    },

    // ---- Phase KN2: directed + B3 + durable queue ------------------------
    {
      state: 'D1', phase: 'KN2', kind: 'message', from: 'guest1', to: 'local1', frame: 'EXCHANGE',
      label: 'bob knocks: AccessRequest{link-hash, target}',
      payload: { share: 'ws-secret', gladeId: 'share.request', shape: 'exchange', verb: 'share.request', correlationId: 'kn-1', detail: { linkHash: 'lh-7a2', target: '(ws-secret, ws.tree)', requesterAsserted: 'NONE — the requester-fp is NOT a payload field (D11: never caller-asserted)' } },
      note: 'The knock is a DIRECTED request to the target authority (the grantor of ws-secret), NOT a write into whatever share the link was found in. The requester identity comes from the caller CONTEXT, never the payload.',
      docRef: `${SH} §5.2 (D11)`,
      sets: { local1: { 'pending kn-1': 'guest1 (bob) → share.request ws-secret' } },
    },
    {
      state: 'S7', phase: 'KN2', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'stamp the requester from the B3 authenticated session',
      payload: { detail: { requester: 'bob@fp:b0b1', source: 'the AUTHENTICATED session context (B3) — never a payload field', dropped: 'any payload-asserted requester-fp is IGNORED' } },
      gate: { kind: 'security', label: 'B3 requester binding', status: 'enforced', note: 'The requester-fp is bound from the authenticated caller context, never accepted from the request body. This is what kills the confused-deputy hole at its root.' },
      note: 'D11: the requester’s identity is the B3 authenticated principal. Filing a request is a directed, authenticated act — the requester context rides the exchange as the ProviderCallContext requester.',
      docRef: `${SH} §4/§5.2 (D11)`,
      sets: { local1: { 'requester kn-1': 'bob@fp:b0b1 via guest1' } },
    },
    {
      state: 'J1', phase: 'KN2', kind: 'internal', from: 'local1', frame: 'APPEND',
      label: 'queue the directed request (grantor offline)',
      payload: { detail: { queue: 'durable offline queue — the grantor peer1 is asleep', durability: 'nothing is dropped; the offline grantor ingests on NEXT ATTACH (D11)', supersedes: 'the old “does ingestion require the grantor online” open — resolved: no' } },
      note: 'D11’s durable offline queue: the directed request is parked and delivered when the target authority next attaches — not the write path, not lossy.',
      docRef: `${SH} §5.2 (D11)`,
      sets: { local1: { 'queue kn-1': 'AccessRequest(bob, ws-secret) → peer1 (durable, awaiting attach)' } },
    },

    // ---- Phase KN3: read ≠ append (deny) ---------------------------------
    {
      state: 'J3', phase: 'KN3', kind: 'message', from: 'guest1', to: 'local1', frame: 'APPEND',
      label: 'bob tries to append the request directly',
      payload: { share: 'ws-secret', gladeId: 'policy', detail: { op: 'AccessRequest as a DIRECT policy append', reasoning: 'the retracted confused-deputy assumption — “where you can read commons, you can append” — bob can read the carrying share, so he tries' } },
      note: 'The tempting shortcut: bob attempts to self-file the request into the policy binding because he can read the carrying share. This is exactly the hole D11 closes.',
      docRef: `${SH} §5.2`,
      sets: { local1: { 'pending append-1': 'guest1 → direct policy append (ws-secret)' } },
    },
    {
      state: 'S4', phase: 'KN3', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'check(): DENY — read does not imply append',
      payload: { share: 'ws-secret', detail: { verdict: 'DENY', rule: 'read access to a share does NOT confer append access to its policy binding (D11)', onlyPath: 'the directed authenticated request (already queued) is the ONLY way in' } },
      gate: { kind: 'capability', label: 'append capability check', status: 'enforced', note: 'The confused-deputy hole killed: appending a grant/request record into a policy binding is a privileged, authenticated act, never implied by read. Retracted: “where you can read commons, you can append”.' },
      note: 'Read ≠ append, mechanically. bob cannot self-file; the directed request path is the only channel.',
      docRef: `${SH} §5.2 (D11)`,
      sets: { local1: { 'denied append-1': 'ws-secret policy (read ≠ append)', 'pending append-1': null } },
    },
    {
      state: 'S3', phase: 'KN3', kind: 'message', from: 'local1', to: 'guest1', frame: 'STATUS', response: true,
      label: 'direct append refused',
      payload: { share: 'ws-secret', detail: { result: 'denied', reason: 'read ≠ append', note: 'your request is queued to the authority — it will be ingested when the grantor attaches' } },
      note: 'bob learns his direct append is refused and that the directed request is already on its way.',
      docRef: `${SH} §5.2`,
      sets: { guest1: { view: 'direct append DENIED (read ≠ append) — request queued to the authority' } },
    },

    // ---- Phase KN4: ingest → approve → unblock ---------------------------
    {
      state: 'B6', phase: 'KN4', kind: 'message', from: 'peer1', to: 'local1', frame: 'DIAL',
      label: 'the grantor authority wakes + attaches',
      payload: { detail: { transport: 'iroh QUIC', effect: 'the durable queue can now deliver' } },
      gate: { kind: 'security', label: 'node↔node HELLO seam', status: 'enforced', note: 'The offline grantor comes online; operator chains verify. Nothing was dropped while it slept.' },
      note: 'D11’s durable queue pays off on attach: the offline grantor ingests the queued request now.',
      docRef: `${SH} §5.2`,
      sets: { peer1: { status: 'ONLINE (attached)' }, local1: { links: 'peer1 (iroh, live)' } },
    },
    {
      state: 'D2', phase: 'KN4', kind: 'message', from: 'local1', to: 'peer1', frame: 'EXCHANGE',
      label: 'deliver the queued request (with the B3 requester)',
      payload: { share: 'ws-secret', gladeId: 'share.request', shape: 'exchange', verb: 'share.request', correlationId: 'kn-1', detail: { requester: 'bob@fp:b0b1 (B3 — from context, not the payload)', linkHash: 'lh-7a2', target: '(ws-secret, ws.tree)' } },
      note: 'The queue delivers on attach; the authenticated requester context rides the exchange into the authority.',
      docRef: `${SH} §5.3`,
      sets: { local1: { 'queue kn-1': null }, peer1: { 'pending kn-1': 'local1 (delivering bob’s directed request)', 'requester kn-1': 'bob@fp:b0b1 via guest1' } },
    },
    {
      state: 'S1', phase: 'KN4', kind: 'internal', from: 'peer1', frame: 'APPEND',
      label: 'ingest: validate B3 requester → append disposition: requested',
      payload: { share: 'ws-secret', detail: { validated: 'the B3 requester bob@fp:b0b1 is authority-checkable', append: 'AccessRequest → disposition: requested into ws-secret’s OWN policy binding (§4 — the database of record)', model: 'requests ARE pending grants — same shape, same place' } },
      note: 'Ingestion (§5.3): the grantor’s glade-share authority, on a directed request it has authority over, validates the B3 requester and appends the canonical requested record.',
      docRef: `${SH} §4/§5.3`,
      sets: { peer1: { 'request guest1 ws-secret': 'disposition: requested (requester bob@fp:b0b1)', 'pending kn-1': null, 'sub ws-secret/policy': 'local1' } },
    },
    {
      state: 'B9', phase: 'KN4', kind: 'message', from: 'peer1', to: 'local1', frame: 'OPS',
      label: 'the pending fold replicates to the grantor’s node',
      payload: { share: 'ws-secret', gladeId: 'policy', shape: 'log', detail: { ops: 'AccessRequest(bob → ws-secret, disposition: requested)' } },
      note: 'The pending-requests fold surfaces where the grantor watches. INV-2 holds: peer1’s sub table names local1.',
      docRef: `${SH} §5.4`,
      sets: { local1: { 'fold ws-secret/policy': 'pending: bob requests access (via gianni’s link)' } },
    },
    {
      state: 'A5', phase: 'KN4', kind: 'message', from: 'local1', to: 'gryth1', frame: 'OPS', response: true,
      label: 'notify the grantor',
      payload: { share: 'ws-secret', gladeId: 'policy', shape: 'log', detail: { notice: 'bob requests access to workspace ws-secret (via your link)', action: 'approve / deny' } },
      note: '§5.4 notification: the grantor’s glade-share tap surfaces the pending fold. INV-2 holds (local1’s sub table names gryth1); INV-4 holds (gianni owns ws-secret).',
      docRef: `${SH} §5.4`,
      sets: { gryth1: { view: 'notification: bob requests access to ws-secret (via my link)' } },
    },
    {
      state: 'J3', phase: 'KN4', kind: 'message', from: 'gryth1', to: 'local1', frame: 'APPEND',
      label: 'gianni approves — appends the grant (the s-grant beat)',
      payload: { share: 'ws-secret', detail: { op: 'CapabilityGrant{subject: bob@fp:b0b1, resource: (ws-secret, ws.tree), verbs: [read.subscribe], disposition: granted}', instance: 'the disposition flips requested → granted as a NEW record (§4 — the chain is the history)' } },
      note: 'Approve = the s-grant beat exactly: the grant record appends and the fold flips at every hop.',
      docRef: `${SH} §5.5 · ${AZ} §4`,
      sets: { gryth1: { 'origin log': '+CapabilityGrant(bob, ws-secret)' } },
    },
    {
      state: 'S1', phase: 'KN4', kind: 'internal', from: 'local1', frame: 'APPEND',
      label: 'fold flips: bob granted → mount admitted',
      payload: { share: 'ws-secret', detail: { fold: 'grants(bob, ws-secret) → read.subscribe', pending: 'disposition folds requested → granted' } },
      note: 'The grant appends; bob’s pending mount is admitted. The subscription table now names bob for ws-secret/ws.tree.',
      docRef: `${SH} §4/§5.5`,
      sets: { local1: { 'grant guest1 ws-secret': 'read.subscribe', 'request guest1 ws-secret': 'disposition: granted', 'denied guest1': null, 'sub ws-secret/ws.tree': 'guest1' } },
    },
    {
      state: 'A5', phase: 'KN4', kind: 'message', from: 'local1', to: 'guest1', frame: 'OPS', response: true,
      label: 'bob’s pending mount UNBLOCKS',
      payload: { share: 'ws-secret', gladeId: 'ws.tree', shape: 'value', detail: { ops: 'ws-secret tree (live)' } },
      note: 'The knock completes: the requester’s pending mounts unblock (§5.5). INV-4 holds (local1’s fold now carries bob’s grant); INV-2 holds (the sub table names bob).',
      docRef: `${SH} §5.5/§9`,
      sets: { guest1: { view: 'ws-secret tree (live) — access granted, mount unblocked' } },
    },

    // ---- Phase KN5: wrong-principal / forged denied ----------------------
    {
      state: 'D1', phase: 'KN5', kind: 'message', from: 'gryth3', to: 'local1', frame: 'EXCHANGE',
      label: 'mallory knocks — forging bob’s fp in the payload',
      payload: { share: 'ws-secret', gladeId: 'share.request', shape: 'exchange', verb: 'share.request', correlationId: 'kn-2', detail: { requesterAsserted: 'bob@fp:b0b1 (FORGED in the payload)', actualSession: 'mallory@fp:m4110', target: '(ws-secret, ws.tree)' } },
      note: 'The forged-requester arm (E-share-3): mallory asserts bob’s fingerprint in the payload, hoping to ride bob’s standing.',
      docRef: `${SH} §5 (E-share-3)`,
      sets: { local1: { 'pending kn-2': 'gryth3 (mallory) → share.request (forged bob fp)' } },
    },
    {
      state: 'S7', phase: 'KN5', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'B3 stamps the TRUE requester — forgery ignored',
      payload: { detail: { payloadClaims: 'bob@fp:b0b1', b3Actual: 'mallory@fp:m4110 (from the authenticated session)', result: 'the payload fp is DISCARDED — requester = mallory' } },
      gate: { kind: 'security', label: 'B3 requester binding', status: 'enforced', note: 'requester-fp comes from the caller context, never caller-asserted — so the forgery is structurally impossible to land. The identity is what it is.' },
      note: 'D11 at work: the caller-asserted fp is ignored; the real requester is the authenticated session principal, mallory.',
      docRef: `${SH} §5.2 (D11)`,
      sets: { local1: { 'requester kn-2': 'mallory@fp:m4110 via gryth3 (payload forgery ignored)' } },
    },
    {
      state: 'D2', phase: 'KN5', kind: 'message', from: 'local1', to: 'peer1', frame: 'EXCHANGE',
      label: 'deliver to the authority (true requester = mallory)',
      payload: { share: 'ws-secret', gladeId: 'share.request', shape: 'exchange', verb: 'share.request', correlationId: 'kn-2', detail: { requester: 'mallory@fp:m4110 (B3)', target: '(ws-secret, ws.tree)' } },
      note: 'The authority receives the TRUE requester, not the forged one.',
      docRef: `${SH} §5.2/§5.3`,
      sets: { peer1: { 'pending kn-2': 'local1 (requester mallory@fp:m4110)' } },
    },
    {
      state: 'S6', phase: 'KN5', kind: 'internal', from: 'peer1', frame: 'ROUTE',
      label: 'authority: no valid path to the closure → DENY',
      payload: { share: 'ws-secret', detail: { requester: 'mallory@fp:m4110', closure: 'ws-secret — mallory holds NO valid path', verdict: 'DENY (wrong principal)' } },
      gate: { kind: 'capability', label: 'requester validation', status: 'enforced', note: 'A wrong-principal request (whose B3 identity holds no valid path to the closure) is denied (E-share-3). The forged fp never mattered — the real identity has no standing.' },
      note: 'The authority validates the B3 requester against the target closure and refuses: mallory has no path in.',
      docRef: `${SH} §5.5 (E-share-3)`,
      sets: { peer1: { 'denied kn-2': 'mallory: no path to ws-secret closure (wrong principal)', 'pending kn-2': null } },
    },
    {
      state: 'S3', phase: 'KN5', kind: 'message', from: 'peer1', to: 'local1', frame: 'STATUS', response: true,
      label: 'deny travels back',
      payload: { detail: { result: 'denied', reason: 'wrong principal — no valid path to closure; forged fp ignored' } },
      note: 'Deny is data with a reason. corr resolves as a refusal, not a timeout.',
      docRef: `${SH} §5.5`,
      sets: { local1: { 'pending kn-2': null } },
    },
    {
      state: 'S3', phase: 'KN5', kind: 'message', from: 'local1', to: 'gryth3', frame: 'STATUS', response: true,
      label: 'mallory sees the refusal',
      payload: { detail: { result: 'denied', reason: 'wrong principal (forged requester-fp had no effect)' } },
      note: 'The forger’s world is exactly its own standing — no more. The knock’s authentication guarantee held.',
      docRef: `${SH} §5.2/§5.5`,
      sets: { gryth3: { view: 'ws-secret request DENIED (wrong principal; forged fp ignored)' } },
    },
  ],
};

// ---------------------------------------------------------------------------
// s-link-share (stage 1, E-share-2) — v1 link capture admits ONLY portable
// commons grants + inline share/glade IDs; a private/account ref (self:alice)
// is REJECTED at capture. Share into a chat → closure confirm → membership-
// snapshot grants → a member restores; a later joiner holds no grants.
// ---------------------------------------------------------------------------
export const S_LINK_SHARE: Scenario = {
  id: 's-link-share',
  stage: 1,
  title: 'Link share — portable commons only; private refs rejected at capture',
  summary:
    'alice drags a link out of a live page. v1 capture admits ONLY portable commons refs + inline share/glade IDs (E-share-2); her self:alice private selection ref and an account ref are REJECTED at capture — closing the private-ref leak. Shared into #dev, share-time closure IS the confirm dialog; membership-snapshot grants mint to the members present NOW; dana (a current member) restores the page; carol (a later joiner) holds none of the grants.',

  actors: pick('gryth1', 'guest1', 'gryth3', 'local1'),

  initial: {
    gryth1: { session: 'local1 (open, alice)', view: 'live page: ws-razel tree · doc-7 · my selection' },
    guest1: { session: 'local1 (open, dana)', device: 'member of #dev at share time' },
    gryth3: { device: 'will join #dev AFTER the share' },
    local1: {
      'session gryth1': 'open (alice)',
      'session guest1': 'open (dana)',
      'fold chat-dev/members': 'alice, dana (current #dev members)',
      'grant gryth1 ws-razel': 'owner (all verbs)',
      'grant gryth1 doc-7': 'owner (all verbs)',
    },
  },

  phases: [
    { id: 'LK1', label: 'Capture (admissible only)', summary: 'Capture walks the shared context’s mounts and emits ONLY portable commons refs + inline share/glade IDs + local atom values — no new introspection needed.' },
    { id: 'LK2', label: 'Reject a private/account ref', summary: 'A ref into a private or account zone (self:alice) is refused at capture: it is not portable and cannot be validly rebound for another principal (E-share-2).' },
    { id: 'LK3', label: 'Share → closure → snapshot grants', summary: 'The link rides the #dev commons; share-time closure IS the confirm dialog; membership-snapshot grants mint to the members present now.' },
    { id: 'LK4', label: 'Restore + later joiner', summary: 'A current member (dana) restores the page from the link; a later joiner (carol) reads the link but holds none of its closure grants.' },
  ],

  steps: [
    // ---- Phase LK1: capture (admissible only) ----------------------------
    {
      state: 'J1', phase: 'LK1', kind: 'internal', from: 'gryth1', frame: 'APPEND',
      label: 'capture: walk mounts → admissible refs + atoms',
      payload: { detail: { walk: 'every mounted GlialTap already knows its (decl, fill) — capture needs NO new introspection', admittedRefs: '(ws-razel, ws.tree, commons) + (doc-7, doc.body, commons) — portable commons + inline share/glade IDs (E-share-2)', values: 'inline (grip→value) for local-only atoms — e.g. zoom=1.5 (the grip-lab move)', record: 'LinkRecord = {refs, values, meta}, content-addressed (hash lh-9f)' } },
      note: 'v1 capture admits ONLY portable commons grants + inline share/glade IDs, plus explicit local atom values (E-share-2, RULED). Capture = walk the shared context’s mounts, emit the admissible instance identities + atoms.',
      docRef: `${SH} §1 (E-share-2)`,
      sets: { gryth1: { 'link lh-9f': 'refs: [ws-razel/ws.tree commons, doc-7/doc.body commons] · values: [zoom=1.5] — content-addressed' } },
    },

    // ---- Phase LK2: reject a private/account ref -------------------------
    {
      state: 'J1', phase: 'LK2', kind: 'internal', from: 'gryth1', frame: 'APPEND', variant: 'a',
      variantNote: 'The capture-discipline REJECTION branch: a private/account-zone ref is refused at capture and minted into NOTHING — the same capture activity, the disallowed input.',
      label: 'private/account ref → REJECTED at capture',
      payload: { detail: { attemptedPrivate: 'ref (doc-7, doc.selection, key self:alice) — a PRIVATE zone ref', attemptedAccount: 'ref (acct-alice, app.settings) — an ACCOUNT zone ref', verdict: 'REJECTED at capture — not portable, cannot be validly rebound for another principal (E-share-2)', effect: 'the self:alice private ref + the account ref are DROPPED; only the commons refs remain in lh-9f' } },
      note: 'E-share-2, RULED: a ref into a private or account zone (self:alice) is REJECTED at capture. This closes the self:alice private-ref leak — an emailed or chat-pasted link never carries a reference only its author could resolve.',
      docRef: `${SH} §1 (E-share-2, capture discipline)`,
      sets: { gryth1: { 'capture-reject lh-9f': 'self:alice (private) + acct-alice (account) — refused, not portable' } },
    },

    // ---- Phase LK3: share → closure → snapshot grants --------------------
    {
      state: 'J3', phase: 'LK3', kind: 'message', from: 'gryth1', to: 'local1', frame: 'APPEND',
      label: 'share the link into #dev (rides the commons)',
      payload: { share: 'chat-dev', gladeId: 'chat.msgs', key: '{group:dev}', detail: { op: 'ChatLine + LinkRecord(lh-9f) attachment', where: 'a link is a record in the medium that carries it (§2) — no dedicated link-share; it rides #dev’s commons beside the ChatLine' } },
      note: '§2 — a link lives as a record in the carrying share. Shared into #dev it rides that group’s commons; the knock it can later trigger is a directed request to the target authority, not a write-back here.',
      docRef: `${SH} §2`,
      sets: { local1: { 'fold chat-dev/chat.msgs{dev}': '+LinkRecord(lh-9f) (from alice)' } },
    },
    {
      state: 'A4', phase: 'LK3', kind: 'internal', from: 'local1', frame: 'FOLD',
      label: 'compute the access closure = the confirm dialog',
      payload: { share: 'chat-dev', detail: { closure: '(ws-razel, commons) + (doc-7, commons) — the memberships the refs require', minus: 'deduped, minus what the audience already holds, minus the carrying #dev share itself (§3)', dialog: '“Sharing this link will grant the members of #dev access to: workspace ws-razel · doc doc-7”' } },
      note: '§3 — share-time closure IS the confirmation dialog, verbatim. AZ-16 keeps the unit honest: one membership grant per domain (commons + each recipient’s own private zone).',
      docRef: `${SH} §3`,
      sets: { local1: { 'closure lh-9f': '(ws-razel commons) + (doc-7 commons) — the confirm dialog' } },
    },
    {
      state: 'A4', phase: 'LK3', kind: 'internal', from: 'local1', frame: 'FOLD', variant: 'a',
      variantNote: 'The membership-SNAPSHOT resolution: “the users attached to that chat” = the group’s members AT SHARE TIME, enumerated now.',
      label: 'membership snapshot — #dev members NOW',
      payload: { share: 'chat-dev', detail: { snapshot: '#dev members now = {alice, dana}', mechanism: 'grants are per-principal records; sharing enumerates the membership fold NOW and mints N grants to those fingerprints (§3)', future: 'later joiners were NEVER granted — the snapshot is the DEFAULT behavior of principal-scoped grants, not an expiry mechanism' } },
      note: '§3 membership snapshot (RULED): sharing mints grants to the members present at share time. Future joiners are outside the snapshot by construction.',
      docRef: `${SH} §3`,
      sets: { local1: { 'snapshot lh-9f': '#dev members at share time: alice, dana' } },
    },
    {
      state: 'S1', phase: 'LK3', kind: 'internal', from: 'local1', frame: 'APPEND',
      label: 'mint the membership-snapshot grants',
      payload: { detail: { mint: 'CapabilityGrant(dana → (ws-razel, commons)) + CapabilityGrant(dana → (doc-7, commons))', minus: 'the closure minus what dana already holds', sameRecords: 'these are ORDINARY grant records — the same records share.grant mints (§1). Links layer ON TOP of direct membership; the closure resolves to share.grant.' } },
      note: '§3 — the closure grants mint to the snapshot members (alice already holds it as owner). A link ultimately mints the same policy-binding grant records as the direct ceremony.',
      docRef: `${SH} §1/§3`,
      sets: { local1: { 'grant guest1 ws-razel': 'read.subscribe (via link snapshot)', 'grant guest1 doc-7': 'read.subscribe (via link snapshot)' } },
    },

    // ---- Phase LK4: restore + later joiner -------------------------------
    {
      state: 'C1', phase: 'LK4', kind: 'message', from: 'guest1', to: 'local1', frame: 'SUBSCRIBE',
      label: 'dana clicks the link → restore (mount refs)',
      payload: { share: 'ws-razel', gladeId: 'ws.tree', key: '{root:"/"}', shape: 'value', detail: { restore: 'mount the admissible refs + set the inline atoms (§1)', member: 'dana is a snapshot member — the mount is admissible' } },
      note: 'Restore = mount refs, set atoms. dana was granted at share time, so her mount resolves.',
      docRef: `${SH} §1/§9`,
      sets: { guest1: { subs: 'ws-razel/ws.tree (commons, restoring link)' }, local1: { 'sub ws-razel/ws.tree': 'guest1' } },
    },
    {
      state: 'A5', phase: 'LK4', kind: 'message', from: 'local1', to: 'guest1', frame: 'OPS', response: true,
      label: 'dana lands in the restored page state',
      payload: { share: 'ws-razel', gladeId: 'ws.tree', shape: 'value', detail: { ops: 'ws-razel tree + doc-7 (restored)', notCarried: 'alice’s private self:alice selection was REJECTED at capture — dana never receives it' } },
      note: 'The user-testable win (§9): a current member clicks and lands in restored page state — commons only. The rejected private ref means alice’s selection is not in the link at all. INV-2 holds (local1’s sub table names dana).',
      docRef: `${SH} §9`,
      sets: { guest1: { view: 'ws-razel tree + doc-7 (restored from link) — NOT alice’s private selection' } },
    },
    {
      state: 'A1', phase: 'LK4', kind: 'message', from: 'gryth3', to: 'local1', frame: 'HELLO',
      label: 'carol joins #dev LATER (after the share)',
      payload: { detail: { session: 'sess-carol', principal: 'carol', when: 'after the membership snapshot was taken' } },
      gate: { kind: 'security', label: 'HELLO principal seam', status: 'stub-allow-all', note: 'Stage 1 asserts the principal; nothing enforced. Her later arrival is exactly the membership-snapshot test.' },
      note: 'carol joins #dev after alice shared the link — the late-joiner case (§3/§5).',
      docRef: `${SH} §3`,
      sets: { local1: { 'session gryth3': 'open (carol) — joined #dev AFTER the share' } },
    },
    {
      state: 'C1', phase: 'LK4', kind: 'message', from: 'gryth3', to: 'local1', frame: 'SUBSCRIBE',
      label: 'carol reads the link in #dev history + clicks it',
      payload: { share: 'ws-razel', gladeId: 'ws.tree', key: '{root:"/"}', shape: 'value', detail: { readsLink: 'carol folds the #dev history, so she can READ the LinkRecord', but: 'reading the link ≠ holding its closure grants' } },
      note: 'carol can read the link (it is in the chat history she now folds) — but the closure grants were snapshot to {alice, dana} only.',
      docRef: `${SH} §3/§5`,
      sets: { gryth3: { subs: 'ws-razel/ws.tree (requested via link)' } },
    },
    {
      state: 'A4', phase: 'LK4', kind: 'internal', from: 'local1', frame: 'FOLD',
      label: 'carol holds NO snapshot grant',
      payload: { detail: { carolGrants: 'NONE for ws-razel / doc-7 — she joined #dev after the snapshot', proof: 'no `grant gryth3 …` record exists — the snapshot minted to alice + dana only', gatedStage: 'in stage-1 allow-all this mounts; at the first gated stage carol is DENIED and must KNOCK (s-knock-directed) — a directed authenticated request (§5)' } },
      note: '§3 snapshot semantic, as folded state: future joiners were never granted. carol reading the link does not confer its closure — the membership snapshot is the default behavior of principal-scoped grants, not an expiry.',
      docRef: `${SH} §3/§5`,
      sets: { local1: { 'no-grant gryth3': 'ws-razel / doc-7 — later joiner, outside the snapshot (would knock at the gated stage)' } },
    },
  ],
};
