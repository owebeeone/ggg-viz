// Stage 2: the SAME catalog states with gates ENFORCED. Variants (.a) declare
// exactly what flips when the security model lands on the retrofit seams.
import type { Scenario } from './types';
import { pick } from './actors';

const SEC = 'SecurityModelAnalysisPrompt';
const WD = 'GladeWorkspaceDirectory';

export const S_SEC_HELLO: Scenario = {
  id: 's-sec-hello',
  stage: 2,
  title: 'HELLO enforced — unknown device denied',
  summary: 'The A1 seam stops being a stub: a session from a device whose cert does not chain to the user root is refused at the door.',

  actors: pick('gryth3', 'local1'),

  initial: {
    local1: { trust: 'device certs: mac-studio, laptop (chained to user root)' },
    gryth3: { device: 'new-tablet — NO cert yet' },
  },

  phases: [
    { id: 'S1', label: 'Denied at the door', summary: 'Same HELLO, enforced gate, honest refusal with the remedy named.' },
  ],

  steps: [
    {
      state: 'A1', variant: 'a',
      variantNote: 'Gate ENFORCED: the asserted principal must present a device cert chaining to the user root — this one cannot.',
      phase: 'S1', kind: 'message', from: 'gryth3', to: 'local1', frame: 'HELLO',
      label: 'session open (uncertified device)',
      payload: { detail: { session: 'sess-0f9', principal: 'gianni (asserted)', deviceCert: 'ABSENT' } },
      gate: { kind: 'security', label: 'HELLO principal seam', status: 'enforced', note: 'The seam shipped in v1 as a no-op hook (A1); stage 2 fills it: verify the device cert chain against the genesis trust root. Same frame, same slot — that was the point of shipping the seam early.' },
      note: 'Identical wire bytes to the golden path’s A1 — enforcement changes the OUTCOME, not the protocol.',
      docRef: `${SEC} §4 · ${WD} §2`,
    },
    {
      state: 'S3', phase: 'S1', kind: 'message', from: 'local1', to: 'gryth3', frame: 'STATUS',
      label: 'denied, with the remedy', response: true,
      payload: { detail: { result: 'denied', reason: 'device not certified for this user', remedy: 'add-a-device ceremony: mint an invite ticket from a certified device (WD §3)' } },
      gate: { kind: 'security', label: 'enforcement cut', status: 'enforced', note: 'Denials are data with a named remedy — the invite-ticket ceremony — not a dead end.' },
      note: 'Failure is a property of trust state, and it tells you how to fix it. Compare E5: same honesty, different gate.',
      docRef: `${WD} §3 (ladder 3: invite ticket)`,
      sets: { local1: { 'denied sess-0f9': 'uncertified device (remedy offered)' } },
    },
  ],
};

export const S_SEC_FANOUT: Scenario = {
  id: 's-sec-fanout',
  stage: 2,
  title: 'Cached ≠ allowed — capability at the fan-out point',
  summary: 'local1 already replicates ws-secret for gryth1. gryth2 (valid session, no grant) asks for it: the replica must NOT serve — enforcement at every hop.',

  actors: pick('gryth1', 'gryth2', 'local1', 'peer1'),

  initial: {
    local1: {
      'session gryth1': 'open (grant: ws-secret read)',
      'sub ws-secret/ws.tree': 'gryth1',
      replica: 'ws-secret/ws.tree (cached, LIVE)',
      'grant gryth1 ws-secret': 'read.subscribe',
    },
    peer1: {
      serving: 'ws-secret via grazel',
      'sub ws-secret/ws.tree': 'local1',
      'grant gryth1 ws-secret': 'read.subscribe (replicated)',
    },
    gryth1: { view: 'ws-secret tree (live)' },
  },

  phases: [
    { id: 'S1', label: 'Valid session, missing grant', summary: 'Authentication passed; authorization is a different gate.' },
    { id: 'S2', label: 'The replica refuses', summary: 'The bytes are RIGHT THERE — and that must not matter.' },
    { id: 'S3', label: 'The grantee is untouched', summary: 'Enforcement is per-session, not per-stream.' },
  ],

  steps: [
    {
      state: 'A1', phase: 'S1', kind: 'message', from: 'gryth2', to: 'local1', frame: 'HELLO',
      label: 'certified session opens',
      payload: { detail: { session: 'sess-9c1', principal: 'gianni (asserted)', deviceCert: 'valid (laptop)' } },
      gate: { kind: 'security', label: 'HELLO principal seam', status: 'enforced', note: 'This device IS certified — authentication succeeds. The lesson of this trace is that authn ≠ authz.' },
      note: 'A perfectly legitimate session. The interesting refusal comes later.',
      docRef: `${SEC} §4`,
      sets: { local1: { 'session gryth2': 'open (no grants for ws-secret)' } },
    },
    {
      state: 'C1', phase: 'S1', kind: 'message', from: 'gryth2', to: 'local1', frame: 'SUBSCRIBE',
      label: 'subscribe: the secret workspace',
      payload: { share: 'ws-secret', gladeId: 'ws.tree', key: '{root:"/"}', shape: 'value' },
      note: 'Same C1 shape as ever. The consumer cannot know it lacks a grant — that is the node’s call.',
      sets: { gryth2: { subs: 'ws-secret/ws.tree (requested)' } },
    },
    {
      state: 'F1', phase: 'S2', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'stream found locally',
      payload: { share: 'ws-secret', detail: { found: 'replica present, live upstream' } },
      gate: { kind: 'routing', label: 'replica-attach', status: 'designed', note: 'The fan-out decision from s-fanout F1 — found it, could attach in one map insert.' },
      note: 'Stage 1 would attach right here. Stage 2 inserts one more gate first.',
      docRef: 's-fanout F1 (contrast)',
    },
    {
      state: 'S4', phase: 'S2', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'capability check at fan-out: DENY',
      payload: { share: 'ws-secret', detail: { session: 'gryth2', grants: 'none for ws-secret', verdict: 'DENY' } },
      gate: { kind: 'capability', label: 'fan-out capability check', status: 'enforced', note: 'THE stage-2 lesson: possession of bytes is not permission to serve them. The check binds (session, share/binding/verb) at EVERY serving hop — origin, replica, fan-out alike. A model that only checks at the provider leaks through every cache.' },
      note: 'The marquee contentious scenario: cached ≠ allowed. This is why the enforcement points are per-frame seams, not a perimeter.',
      docRef: `${SEC} §3.4/§6.4 · GDL-009`,
      sets: { local1: { 'denied gryth2': 'ws-secret (no grant)' } },
    },
    {
      state: 'S3', phase: 'S2', kind: 'message', from: 'local1', to: 'gryth2', frame: 'STATUS',
      label: 'refused with reason', response: true,
      payload: { share: 'ws-secret', detail: { result: 'denied', reason: 'no capability for ws-secret', remedy: 'request a grant from the workspace owner' } },
      gate: { kind: 'security', label: 'enforcement cut', status: 'enforced', note: 'Deny is data; the UI renders it like any state.' },
      note: 'gryth2’s subscribe resolves to a refusal, not a timeout — honest and immediate.',
      docRef: `${SEC} §6.4`,
      sets: { gryth2: { subs: null, view: 'ws-secret: ACCESS DENIED (remedy shown)' } },
    },
    {
      state: 'C5', phase: 'S3', kind: 'message', from: 'peer1', to: 'local1', frame: 'OPS',
      label: 'live change still flows',
      payload: { share: 'ws-secret', gladeId: 'ws.tree', detail: { ops: 'file edited' } },
      note: 'The stream itself is unaffected by the denial.',
    },
    {
      state: 'B9', phase: 'S3', kind: 'message', from: 'local1', to: 'gryth1', frame: 'OPS',
      label: 'the grantee keeps streaming', response: true,
      payload: { share: 'ws-secret', gladeId: 'ws.tree' },
      note: 'Per-session enforcement: gryth1’s grant, gryth1’s stream. One replica, two sessions, two different answers — and that is correct.',
      sets: { gryth1: { view: 'ws-secret tree (updated)' } },
    },
  ],
};

export const S_SEC_REVOKE: Scenario = {
  id: 's-sec-revoke',
  stage: 2,
  title: 'Revocation mid-subscription — forward-only honesty',
  summary: 'A grant is revoked while its stream is live: the revocation op replicates, every hop cuts the stream, and history already replicated is honestly NOT clawed back.',

  actors: pick('gryth1', 'gryth2', 'local1', 'peer1'),

  initial: {
    gryth1: { session: 'local1 (open)', role: 'owner of ws-secret' },
    gryth2: { session: 'local1 (open)', view: 'ws-secret tree (live)', 'local cache': 'ws-secret history (replicated)' },
    local1: {
      'session gryth1': 'open (owner)',
      'session gryth2': 'open (grant: ws-secret read)',
      'sub ws-secret/ws.tree': 'gryth2',
      'sub home': 'peer1 (mesh)',
      'grant gryth2 ws-secret': 'read.subscribe',
      links: 'peer1 (iroh)',
    },
    peer1: {
      serving: 'ws-secret via grazel',
      'sub ws-secret/ws.tree': 'local1',
      'grant gryth2 ws-secret': 'read.subscribe (replicated)',
    },
  },

  phases: [
    { id: 'R1', label: 'Revoke is an op', summary: 'The owner appends a CapabilityRevocation — no service call, an op.' },
    { id: 'R2', label: 'Every hop cuts', summary: 'Each replica’s fold flips; each enforces locally.' },
    { id: 'R3', label: 'Honest residue', summary: 'What already replicated stays replicated — GDL-009, stated not hidden.' },
  ],

  steps: [
    {
      state: 'J3', phase: 'R1', kind: 'message', from: 'gryth1', to: 'local1', frame: 'APPEND',
      label: 'owner appends revocation',
      payload: { share: 'home', detail: { op: 'CapabilityRevocation(gryth2 → ws-secret)', signedBy: 'owner chain' } },
      note: 'Revocation is an op in the directory share, signed under the owner’s chain — the same write path as everything else.',
      docRef: `${WD} §2/§5`,
      sets: { gryth1: { 'origin log': '+CapabilityRevocation' } },
    },
    {
      state: 'S2', phase: 'R1', kind: 'internal', from: 'local1', frame: 'APPEND',
      label: 'fold flips: revocation wins',
      payload: { share: 'home', detail: { fold: 'grants(gryth2, ws-secret) → REVOKED' } },
      note: 'Revocation-wins is a FOLD rule (set-union with tombstone precedence) — no clock games, no races with renewal. The grant key DELETES from the fold: any later serve to gryth2 would now trip INV-4.',
      docRef: `${WD} §2 (fold semantics) · GladeAuthzModel §4`,
      sets: { local1: { 'grant gryth2 ws-secret': null, revoked: 'gryth2 → ws-secret' } },
    },
    {
      state: 'S3', phase: 'R2', kind: 'message', from: 'local1', to: 'gryth2', frame: 'STATUS',
      label: 'live stream CUT',
      payload: { share: 'ws-secret', detail: { result: 'subscription terminated', reason: 'capability revoked' } },
      gate: { kind: 'security', label: 'enforcement cut', status: 'enforced', note: 'Enforcement re-evaluates on grant-state change, not only at subscribe time — a live stream is a standing decision, revisited when its premise dies.' },
      note: 'Mid-subscription cut: the subscription table drops the session the moment the fold flips.',
      docRef: `${SEC} §6.5`,
      sets: { local1: { 'sub ws-secret/ws.tree': null }, gryth2: { view: 'ws-secret: stream ended (revoked)' } },
    },
    {
      state: 'B9', phase: 'R2', kind: 'message', from: 'local1', to: 'peer1', frame: 'OPS',
      label: 'revocation replicates',
      payload: { share: 'home', detail: { ops: 'CapabilityRevocation(gryth2 → ws-secret)' } },
      note: 'The op reaches every replica the way all ops do.',
    },
    {
      state: 'S2', phase: 'R2', kind: 'internal', from: 'peer1', frame: 'APPEND',
      label: 'peer enforces too',
      payload: { detail: { fold: 'grants flipped; any direct gryth2 session would now be refused HERE' } },
      note: 'Every hop enforces from its own fold — there is no single bouncer to route around. (The s-sec-fanout lesson, now under revocation.)',
      sets: { peer1: { 'grant gryth2 ws-secret': null, revoked: 'gryth2 → ws-secret' } },
    },
    {
      state: 'S3', phase: 'R3', kind: 'message', from: 'local1', to: 'gryth1', frame: 'STATUS', variant: 'a',
      variantNote: 'Not a cut — the owner’s confirmation view, carrying the honest residue statement.',
      label: 'owner sees it done — with the caveat', response: true,
      payload: { detail: { revoked: 'gryth2 → ws-secret', residue: 'ops already replicated to gryth2’s local cache are NOT clawed back' } },
      gate: { kind: 'security', label: 'forward-only honesty', status: 'designed', note: 'GDL-009 stated plainly: revocation stops NEW flow everywhere; it cannot reach into offline replicas. Anyone promising retroactive un-sharing of a replicated log is lying — the UI says so instead.' },
      note: 'The honest residue: gryth2 keeps the history it already had (see its `local cache` state — unchanged this whole trace). Design the sensitivity model around this truth, not against it.',
      docRef: 'GDL-009',
      sets: { gryth1: { view: 'revocation confirmed (residue caveat shown)' } },
    },
  ],
};
