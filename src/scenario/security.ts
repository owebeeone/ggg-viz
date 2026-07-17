// Stage 2: the SAME catalog states with gates ENFORCED. Variants (.a) declare
// exactly what flips when the security model lands on the retrofit seams.
import type { Scenario } from './types';
import { pick } from './actors';

const SEC = 'SecurityModelAnalysisPrompt';
const WD = 'GladeWorkspaceDirectory';
const SM = 'GladeSupplierModel';
const AZ = 'GladeAuthzModel';

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

// ---------------------------------------------------------------------------
// s-attach-authn — B1 (GladeSupplierModel §8): provider attachment is
// authenticated + grant-checked + epoch-fenced. A supplier attaches with an
// exact provider.attach grant and a monotonic epoch; an UNauthenticated attach
// is refused at the door; a second attach to a LIVE surface is NOT silently
// replaced; and a call bound to a stale epoch after an authorized handoff fails
// closed. B1 overturns §2's last-writer-wins attach — the composition, not a
// first-come Subscribe, controls which surfaces exist and who backs them.
// ---------------------------------------------------------------------------
export const S_ATTACH_AUTHN: Scenario = {
  id: 's-attach-authn',
  stage: 2,
  title: 'Provider attach enforced — authenticated, grant-checked, epoch-fenced',
  summary:
    'B1 makes the composition wall real: an authenticated provider attaches with an exact provider.attach grant and takes epoch 1; every call binds that epoch. An unauthenticated attach is refused; a second provider cannot silently replace the live attachment; and after an authorized handoff advances the epoch, a call still bound to the old epoch fails closed.',

  actors: pick('local1', 'peer1', 'peer2', 'peer3', 'gryth1'),

  initial: {
    local1: {
      // grazel-app.glade declared the surface + its provider class; the ACL
      // seed compiled to an exact provider.attach grant for peer1's key.
      'binding ws-razel/gwz.ops': 'exchange — provider class: grazel authority (declared, grazel-app.glade)',
      'grant peer1 ws-razel': 'provider.attach(gwz.ops) — exact surface',
      'trust device certs': 'peer1, peer3 (chained to the app root); peer2 UNKNOWN',
    },
    gryth1: { session: 'local1 (open)', view: 'workspace ws-razel' },
  },

  phases: [
    { id: 'AT', label: 'Authenticated attach + epoch bind', summary: 'peer1 authenticates, presents its exact provider.attach grant, and takes the surface at epoch 1; a call binds (principal, surface, epoch, glade id).' },
    { id: 'UN', label: 'Unauthenticated attach refused', summary: 'peer2 has no certified device — the attach is refused at the door; possessing an identifier is not authority.' },
    { id: 'NR', label: 'No silent replacement', summary: 'peer3 authenticates but cannot implicitly seize the LIVE surface — an existing attachment is never replaced by a racing Subscribe.' },
    { id: 'HO', label: 'Authorized handoff + stale epoch fails closed', summary: 'The owner authorizes a handoff (epoch++); a call still bound to the old epoch fails closed.' },
  ],

  steps: [
    // ---- Phase AT: authenticated attach ----------------------------------
    {
      state: 'A1', phase: 'AT', kind: 'message', from: 'peer1', to: 'local1', frame: 'HELLO',
      label: 'supplier authenticates (certified device)',
      payload: { detail: { session: 'sess-p1', principal: 'grazel@peer1', deviceCert: 'chained to app root — VALID' } },
      gate: { kind: 'security', label: 'HELLO principal seam', status: 'enforced', note: 'B1 stage-1: a provider MUST authenticate before it may attach — possessing a surface identifier is not authority. The Hello proves the provider principal.' },
      note: 'B1 (GladeSupplierModel §8): the attach is authenticated from day one. peer1’s device cert chains to the app root — the session is real.',
      docRef: `${SM} §8 (B1) · §2`,
      sets: { local1: { 'session peer1': 'open (certified device — grazel@peer1)' } },
    },
    {
      state: 'C3', phase: 'AT', kind: 'message', from: 'peer1', to: 'local1', frame: 'SUBSCRIBE',
      label: 'attach the declared surface → become THE authority',
      payload: { share: 'ws-razel', gladeId: 'gwz.ops', key: '∅ (exchange surface)', shape: 'exchange', detail: { check: 'exact provider.attach(ws-razel, gwz.ops) grant + declared provider class + NO existing attachment', epoch: '1 (fresh)' } },
      gate: { kind: 'capability', label: 'provider-attach check', status: 'enforced', note: 'B1: a Subscribe to a declared surface registers the session as THE provider ONLY if it presents the exact provider.attach grant AND the glade composition declares the provider class AND no attachment is live. This is the B1 check slot the old last-writer-wins Subscribe skipped — the shared attach-policy utility, same on local and forwarded paths.' },
      note: 'Attaching is a grant-checked, epoch-minting act — not a first-come Subscribe. peer1 has the exact grant, the class is declared, the surface is free → attach at monotonic epoch 1.',
      docRef: `${SM} §8 (B1) · §2 (attach paths)`,
      sets: { local1: { 'provider ws-razel/gwz.ops': 'sess-p1@peer1 attached — epoch 1' } },
    },
    {
      state: 'D1', phase: 'AT', kind: 'message', from: 'gryth1', to: 'local1', frame: 'EXCHANGE',
      label: 'client calls the surface',
      payload: { share: 'ws-razel', gladeId: 'gwz.ops', shape: 'exchange', verb: 'gwz.status', correlationId: 'call-1', detail: { ask: 'gwz.status' } },
      note: 'An ordinary exchange against the attached surface — the interesting part is what the node binds onto it.',
      docRef: `${SM} §2.3`,
      sets: { local1: { 'pending call-1': 'gryth1 → gwz.status' } },
    },
    {
      state: 'C2', phase: 'AT', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'bind the call to the attachment epoch',
      payload: { detail: { context: 'ProviderCallContext binds { provider: grazel@peer1, surface: ws-razel/gwz.ops, epoch: 1, glade id: gwz.ops }', rule: 'B1: every provider call MUST bind the provider principal, surface, attachment epoch, and glade id' } },
      gate: { kind: 'routing', label: 'provider lookup + epoch bind', status: 'enforced', note: 'The keyed provider entry map IS the routing table; B1 additionally stamps the current attachment epoch (1) onto the forwarded call so a later handoff can fence it.' },
      note: 'The call is bound to epoch 1 — the epoch that is live NOW. This binding is what makes the stale-epoch fence (phase HO) possible.',
      docRef: `${SM} §8 (B1) · §2.2`,
      sets: { local1: { 'call call-1': 'bound → peer1 ws-razel/gwz.ops epoch 1' } },
    },
    {
      state: 'D2', phase: 'AT', kind: 'message', from: 'local1', to: 'peer1', frame: 'EXCHANGE',
      label: 'forward to the attached provider',
      payload: { gladeId: 'gwz.ops', shape: 'exchange', verb: 'gwz.status', correlationId: 'call-1', detail: { epoch: '1 (bound)' } },
      note: 'Forwarded 1:1 by correlation to the epoch-1 provider; the context rides BESIDE the request (B3), the epoch inside it (B1).',
      docRef: `${SM} §2.3 · §8`,
      sets: { peer1: { 'pending call-1': 'local1 (epoch 1)' } },
    },
    {
      state: 'D4', phase: 'AT', kind: 'message', from: 'peer1', to: 'local1', frame: 'EXCHANGE-RESP',
      label: 'provider answers', response: true,
      payload: { correlationId: 'call-1', detail: { ok: 'true', result: 'clean' } },
      note: 'The epoch-1 provider answers; corr preserved.',
      docRef: `${SM} §2.3`,
      sets: { peer1: { 'pending call-1': null } },
    },
    {
      state: 'D5', phase: 'AT', kind: 'message', from: 'local1', to: 'gryth1', frame: 'EXCHANGE-RESP',
      label: 'result to the client', response: true,
      payload: { correlationId: 'call-1', detail: { ok: 'true' } },
      note: 'The call completes against the epoch-1 attachment — the positive baseline the stale case will contrast.',
      sets: { local1: { 'pending call-1': null }, gryth1: { view: 'gwz.status: clean' } },
    },

    // ---- Phase UN: unauthenticated attach refused ------------------------
    {
      state: 'A1', variant: 'a', phase: 'UN', kind: 'message', from: 'peer2', to: 'local1', frame: 'HELLO',
      variantNote: 'Same HELLO shape, no valid device cert: authentication FAILS — the negative of AT’s A1.',
      label: 'unknown device tries to open a session',
      payload: { detail: { session: 'sess-p2', principal: 'grazel@peer2 (asserted)', deviceCert: 'ABSENT / not chained to the app root' } },
      gate: { kind: 'security', label: 'HELLO principal seam', status: 'enforced', note: 'B1: a provider MUST authenticate. peer2 presents no certified device — there is no authenticated principal to attach, so nothing downstream is even considered.' },
      note: 'The B1 negative "attach without authentication": an asserted identifier is not authority. Refused before any attach logic runs.',
      docRef: `${SM} §8 (B1)`,
      sets: { local1: { 'denied peer2': 'unauthenticated — no certified device' } },
    },
    {
      state: 'S3', phase: 'UN', kind: 'message', from: 'local1', to: 'peer2', frame: 'STATUS',
      label: 'refused at the door — fail closed', response: true,
      payload: { detail: { result: 'denied', reason: 'device not certified for this composition', effect: 'no session, no attach' } },
      gate: { kind: 'security', label: 'enforcement cut', status: 'enforced', note: 'Fail closed: an unknown device gets a bounded denial, never a foothold. The live attachment (peer1 @ epoch 1) is untouched.' },
      note: 'The provider entry map still names peer1 @ epoch 1 — an unauthenticated attempt changed nothing.',
      docRef: `${SM} §8 (B1)`,
      sets: { local1: { 'denied peer2': 'unauthenticated attach refused (peer1 @ epoch 1 unchanged)' } },
    },

    // ---- Phase NR: no silent replacement ---------------------------------
    {
      state: 'A1', phase: 'NR', kind: 'message', from: 'peer3', to: 'local1', frame: 'HELLO',
      label: 'a second certified provider authenticates',
      payload: { detail: { session: 'sess-p3', principal: 'grazel@peer3', deviceCert: 'chained to app root — VALID' } },
      gate: { kind: 'security', label: 'HELLO principal seam', status: 'enforced', note: 'peer3’s device IS certified — authentication succeeds. The lesson of NR is that authenticating is not the same as being allowed to SEIZE a live surface.' },
      note: 'peer3 is a legitimate host — the point is that even a valid session cannot implicitly replace a live attachment.',
      docRef: `${SM} §8 (B1)`,
      sets: { local1: { 'session peer3': 'open (certified device — grazel@peer3)' } },
    },
    {
      state: 'C3', variant: 'a', phase: 'NR', kind: 'message', from: 'peer3', to: 'local1', frame: 'SUBSCRIBE',
      variantNote: 'The attach check finds the surface ALREADY attached (peer1 @ epoch 1): B1 forbids implicit replacement — rejected, not swapped.',
      label: 'attach the LIVE surface → refused (no silent replace)',
      payload: { share: 'ws-razel', gladeId: 'gwz.ops', key: '∅ (exchange surface)', shape: 'exchange', detail: { existing: 'sess-p1@peer1 — epoch 1 (LIVE)', verdict: 'REJECT — existing attachment MUST NOT be replaced implicitly' } },
      gate: { kind: 'capability', label: 'provider-attach check', status: 'enforced', note: 'THE B1 marquee: silent replacement is exactly what last-writer-wins attach allowed and what a racing or compromised provider would exploit. Replacing a live attachment requires an AUTHORIZED, recorded handoff (phase HO) — never a first-come Subscribe.' },
      note: 'B1 negative "silent replacement": peer3’s Subscribe does NOT seize the surface. The provider entry is unchanged; the racing attach is refused.',
      docRef: `${SM} §8 (B1)`,
      sets: { local1: { 'denied peer3': 'silent-replace refused — ws-razel/gwz.ops held by peer1 @ epoch 1' } },
    },
    {
      state: 'S3', variant: 'a', phase: 'NR', kind: 'message', from: 'local1', to: 'peer3', frame: 'STATUS',
      variantNote: 'Deny carrying the remedy: a takeover is possible, but only via an authorized handoff.',
      label: 'refused — surface already attached', response: true,
      payload: { detail: { result: 'denied', reason: 'ws-razel/gwz.ops already attached (peer1 @ epoch 1)', remedy: 'an authorized handoff/takeover — recorded, epoch-advancing (phase HO)' } },
      gate: { kind: 'security', label: 'enforcement cut', status: 'enforced', note: 'The wall holds: which surfaces exist and who backs them is the composition’s call, not a race.' },
      note: 'The attachment ledger still reads peer1 @ epoch 1 — the structural composition wall is real.',
      docRef: `${SM} §8 (B1)`,
    },

    // ---- Phase HO: authorized handoff + stale-epoch fail-closed ----------
    {
      state: 'S1', phase: 'HO', kind: 'internal', from: 'gryth1', frame: 'APPEND',
      label: 'owner authorizes the handoff (epoch++)',
      payload: { share: 'ws-razel', detail: { record: 'ProviderHandoff{surface: ws-razel/gwz.ops, from: peer1, to: peer3}', signedBy: 'owner chain (gryth1)', effect: 'grants peer3 provider.attach + authorizes detach of peer1; advances the monotonic epoch' } },
      note: 'B1: handoff, detach, or lease takeover MUST be authorized, recorded, and advance a monotonic provider epoch. Unlike NR’s silent race, THIS is a signed record from the owner — the only legitimate way to move the surface.',
      docRef: `${SM} §8 (B1)`,
      sets: { local1: { 'grant peer3 ws-razel': 'provider.attach(gwz.ops) — handoff-authorized', 'handoff ws-razel/gwz.ops': 'peer1→peer3 (authorized, recorded)' } },
    },
    {
      state: 'C3', phase: 'HO', kind: 'message', from: 'peer3', to: 'local1', frame: 'SUBSCRIBE',
      label: 'peer3 re-attaches under the handoff → epoch 2',
      payload: { share: 'ws-razel', gladeId: 'gwz.ops', key: '∅ (exchange surface)', shape: 'exchange', detail: { authorization: 'handoff record (recorded) + provider.attach grant', epoch: '2 (monotonic ++)' } },
      gate: { kind: 'capability', label: 'provider-attach check', status: 'enforced', note: 'Now the attach is authorized by a recorded handoff, so it is accepted — and it advances the epoch to 2. The epoch is observable in routing and traces exactly so stale calls can be fenced.' },
      note: 'The authorized path detaches peer1 and attaches peer3 at epoch 2. Same C3 check as AT — this time the authorization exists AND the epoch advances.',
      docRef: `${SM} §8 (B1)`,
      sets: { local1: { 'provider ws-razel/gwz.ops': 'sess-p3@peer3 attached — epoch 2 (handoff from peer1)' } },
    },
    {
      state: 'D1', phase: 'HO', kind: 'message', from: 'gryth1', to: 'local1', frame: 'EXCHANGE',
      label: 'a call still bound to epoch 1 arrives',
      payload: { share: 'ws-razel', gladeId: 'gwz.ops', shape: 'exchange', verb: 'gwz.status', correlationId: 'call-2', detail: { boundEpoch: '1 (issued/routed just before the handoff landed — now stale)' } },
      note: 'The B1 negative "stale-epoch call after handoff": this call was bound to peer1 @ epoch 1 (in flight across the handoff). Its bound epoch no longer matches the live attachment.',
      docRef: `${SM} §8 (B1)`,
      sets: { local1: { 'pending call-2': 'gryth1 → gwz.status (bound epoch 1)' } },
    },
    {
      state: 'S6', phase: 'HO', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'epoch fence: stale → fail closed',
      payload: { detail: { bound: 'epoch 1', current: 'epoch 2', verdict: 'STALE → FAIL CLOSED', rule: 'B1: stale epochs MUST fail closed' } },
      gate: { kind: 'capability', label: 'attachment-epoch fence', status: 'enforced', note: 'The pre-dispatch authority check binds (principal, surface, epoch, glade id); the bound epoch (1) is older than the live attachment (2), so the call is refused rather than delivered to the wrong — or a former — provider. This is what defeats detach/reattach spoofing of the former provider.' },
      note: 'Same enforcement seam that evaluates a call before execution; here the epoch mismatch alone fails it closed. No op reaches any provider.',
      docRef: `${SM} §8 (B1)`,
      sets: { local1: { 'fenced call-2': 'stale epoch 1 < current 2 — fail closed' } },
    },
    {
      state: 'D5', phase: 'HO', kind: 'message', from: 'local1', to: 'gryth1', frame: 'EXCHANGE-RESP',
      label: 'fail-closed answer (as data)', response: true,
      payload: { correlationId: 'call-2', detail: { ok: 'false', error: 'attachment epoch advanced (1 → 2) — stale call refused', remedy: 're-resolve the provider and retry against epoch 2' } },
      note: 'Failure is a value: the stale call returns ok:false with a reason and corr intact — never delivered to a detached provider, never a hang (GladeSupplierModel §6).',
      docRef: `${SM} §8 (B1) · §6`,
      sets: { local1: { 'pending call-2': null }, gryth1: { view: 'gwz.status: retry — provider epoch advanced' } },
    },
  ],
};

// ---------------------------------------------------------------------------
// s-self-key-bind — B4 (GladeAuthzModel §4a + §9 AZ-16): "privacy is a key" is
// sharpened to "privacy is an IDENTITY-BOUND key." `self` is a symbolic
// authorization expression, not a routable name: the node DERIVES the concrete
// zone key from the authenticated B3 principal and MUST REJECT a caller-supplied
// literal identity that does not match. Bob subscribing self:alice is refused;
// Bob subscribing his own self:bob succeeds by identity alone (no grant — AZ-17);
// and the derive-and-check applies to subscribe, append, AND replay/forwarding.
// ---------------------------------------------------------------------------
export const S_SELF_KEY_BIND: Scenario = {
  id: 's-self-key-bind',
  stage: 2,
  title: 'self is identity-bound — a foreign self never resolves',
  summary:
    'B4/AZ-16: the node derives each session’s private-zone key from its authenticated principal. Bob asking for self:alice is REJECTED — the literal does not match his derived self:bob — while his own self:bob resolves by identity alone (no grant). The same derive-and-check gates subscribe, append, and replay.',

  actors: pick('gryth1', 'guest1', 'local1'),

  initial: {
    // alice = gryth1, bob = guest1 — two DIFFERENT user roots.
    gryth1: { session: 'local1 (open, alice)' },
    guest1: { session: 'local1 (open, bob)' },
  },

  phases: [
    { id: 'KB', label: 'Key bind at HELLO', summary: 'The node derives each session’s self key from its authenticated B3 principal — self is never taken from the wire.' },
    { id: 'SD', label: 'Subscribe self:alice → rejected', summary: 'Bob’s derived self is self:bob; a caller-supplied self:alice does not match and is refused before any serve.' },
    { id: 'SO', label: 'Subscribe self:bob → served', summary: 'Bob’s own private zone resolves by identity alone — no grant record exists or is needed (AZ-17).' },
    { id: 'AR', label: 'Append + replay carry the same check', summary: 'Writing and replaying a foreign self are rejected identically; the derive-and-check rides every path, including forwarding.' },
  ],

  steps: [
    // ---- Phase KB: derive self keys from authenticated principals --------
    {
      state: 'A1', phase: 'KB', kind: 'message', from: 'gryth1', to: 'local1', frame: 'HELLO',
      label: 'alice’s session authenticates',
      payload: { detail: { session: 'sess-alice', principal: 'alice (fp:a11ce)', deviceCert: 'chained to alice’s root — VALID' } },
      gate: { kind: 'security', label: 'HELLO principal seam', status: 'enforced', note: 'B4: the node binds the session’s self zone key FROM the authenticated principal — the self key is derived, never asserted by the caller.' },
      note: 'alice authenticates; the node derives her private-zone key self:alice from her B3 principal.',
      docRef: `${AZ} §9 (AZ-16, B4) · §4a`,
      sets: { local1: { 'selfkey self:alice': 'sess-alice bound — fp:a11ce', 'account acct-alice': 'gryth1' } },
    },
    {
      state: 'A1', phase: 'KB', kind: 'message', from: 'guest1', to: 'local1', frame: 'HELLO',
      label: 'bob’s session authenticates (a different root)',
      payload: { detail: { session: 'sess-bob', principal: 'bob (fp:b0b1)', deviceCert: 'chained to bob’s root — VALID' } },
      gate: { kind: 'security', label: 'HELLO principal seam', status: 'enforced', note: 'bob is a distinct principal; his derived self key is self:bob — the derivation is per-session and identity-bound.' },
      note: 'bob authenticates; the node derives self:bob from HIS principal. Two sessions, two identity-bound self keys — neither taken from a wire field.',
      docRef: `${AZ} §9 (AZ-16, B4) · §4a`,
      sets: { local1: { 'selfkey self:bob': 'sess-bob bound — fp:b0b1', 'account acct-bob': 'guest1' } },
    },

    // ---- Phase SD: subscribe self:alice → rejected -----------------------
    {
      state: 'C1', phase: 'SD', kind: 'message', from: 'guest1', to: 'local1', frame: 'SUBSCRIBE',
      label: 'bob asks for self:alice (a foreign literal)',
      payload: { share: 'acct-alice', gladeId: 'notes', key: 'self:alice', shape: 'log', detail: { asserted: 'self:alice — a literal identity in the request' } },
      note: 'bob supplies the literal self:alice — the pre-B4 shape where self was a routable name. B4 makes this a symbolic expression the node must resolve against HIS identity.',
      docRef: `${AZ} §9 (AZ-16, B4)`,
      sets: { guest1: { subs: 'acct-alice/notes{self:alice} (requested)' } },
    },
    {
      state: 'Z1', phase: 'SD', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'derive from principal → self:bob ≠ self:alice → reject',
      payload: { detail: { derived: 'self:bob (from bob’s authenticated principal)', requested: 'self:alice (literal)', verdict: 'REJECT — caller-supplied identity does not match the derived self' } },
      gate: { kind: 'security', label: 'self-key resolver', status: 'enforced', note: 'B4/AZ-16: `self` resolves through the canonical resolver in the common security utilities — the node DERIVES the zone key from the authenticated B3 principal and MUST REJECT a literal that does not match. A foreign self never resolves; there is no membership question to even reach (privacy is a key, and the key is identity-bound).' },
      note: 'The rejection is structural, not a grant miss: self:alice is simply not bob’s to name. The check is the same resolver used at append, replay, and forwarding.',
      docRef: `${AZ} §9 (AZ-16, B4)`,
      sets: { local1: { 'denied guest1': 'self:alice ≠ derived self:bob — foreign self refused' } },
    },
    {
      state: 'S3', phase: 'SD', kind: 'message', from: 'local1', to: 'guest1', frame: 'STATUS',
      label: 'refused — that self is not your identity', response: true,
      payload: { detail: { result: 'denied', reason: 'self:alice does not match your authenticated principal (self:bob)' } },
      gate: { kind: 'security', label: 'enforcement cut', status: 'enforced', note: 'Fail closed: a foreign self is refused as data, with the reason. No ops of alice’s private zone are served.' },
      note: 'bob learns his ask was ill-formed for his identity — not that alice’s zone is empty. Nothing of alice’s private world leaked.',
      docRef: `${AZ} §9 (AZ-16, B4)`,
      sets: { guest1: { subs: null, view: 'self:alice: refused (not your identity)' } },
    },

    // ---- Phase SO: subscribe self:bob → served ---------------------------
    {
      state: 'C1', phase: 'SO', kind: 'message', from: 'guest1', to: 'local1', frame: 'SUBSCRIBE',
      label: 'bob asks for his own self:bob',
      payload: { share: 'acct-bob', gladeId: 'notes', key: 'self:bob', shape: 'log', detail: { asserted: 'self:bob' } },
      note: 'bob subscribes his OWN private zone. The literal matches what the node will derive from his identity.',
      docRef: `${AZ} §9 (AZ-16, B4)`,
      sets: { local1: { 'sub acct-bob/notes{self:bob}': 'guest1' }, guest1: { subs: 'acct-bob/notes{self:bob}' } },
    },
    {
      state: 'Z1', phase: 'SO', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'derive → self:bob = self:bob → authorized by identity',
      payload: { detail: { derived: 'self:bob', requested: 'self:bob', verdict: 'MATCH → authorized', grant: 'NONE — identity alone gates your own private zone (AZ-17); no zone-scoped grant exists' } },
      gate: { kind: 'security', label: 'self-key resolver', status: 'enforced', note: 'The same resolver: derived self:bob matches the request, so it resolves. Note there is NO grant record — private zones are private by keying, not permission. Membership grants gate other people’s commons; identity alone gates your own zone.' },
      note: 'Positive of the SD arm, same seam: a matching self resolves with no grant. This is why the serve below is owner-exempt, not grant-backed.',
      docRef: `${AZ} §9 (AZ-16, B4) · §4a`,
      sets: { local1: { 'authorized guest1': 'self:bob (own zone, by identity)' } },
    },
    {
      state: 'A5', phase: 'SO', kind: 'message', from: 'local1', to: 'guest1', frame: 'OPS',
      label: 'bob’s private zone streams to bob', response: true,
      payload: { share: 'acct-bob', gladeId: 'notes', key: 'self:bob', shape: 'log', detail: { ops: 'bob’s private notes' } },
      note: 'The private-zone log serves — owner-exempt (account acct-bob names bob), because self:bob is his own identity, not a granted commons.',
      docRef: `${AZ} §4a (AZ-17 owner-serve) · §9`,
      sets: { guest1: { view: 'self:bob notes (live)' } },
    },

    // ---- Phase AR: append + replay carry the same check ------------------
    {
      state: 'J3', phase: 'AR', kind: 'message', from: 'guest1', to: 'local1', frame: 'APPEND',
      label: 'bob writes his own self:bob (ok)',
      payload: { share: 'acct-bob', gladeId: 'notes', key: 'self:bob', detail: { op: 'append note "buy milk"' } },
      note: 'The write path resolves self the same way: bob writing self:bob matches his identity and is accepted.',
      docRef: `${AZ} §9 (AZ-16, B4)`,
      sets: { local1: { 'fold acct-bob/notes{self:bob}': '+"buy milk" (by bob)' } },
    },
    {
      state: 'J3', variant: 'a', phase: 'AR', kind: 'message', from: 'guest1', to: 'local1', frame: 'APPEND',
      variantNote: 'The write path, foreign self: bob tries to APPEND into self:alice — same identity-bound resolver, opposite verdict.',
      label: 'bob tries to write self:alice',
      payload: { share: 'acct-alice', gladeId: 'notes', key: 'self:alice', detail: { op: 'append into alice’s zone (foreign self)' } },
      note: 'B4 applies to APPEND: a write naming a foreign self is derive-and-checked exactly like a subscribe.',
      docRef: `${AZ} §9 (AZ-16, B4)`,
      sets: { guest1: { 'pending write': 'self:alice (foreign)' } },
    },
    {
      state: 'Z1', variant: 'a', phase: 'AR', kind: 'internal', from: 'local1', frame: 'ROUTE',
      variantNote: 'Same resolver on the write path: derived self:bob ≠ self:alice → the append is refused before it can fold.',
      label: 'derive → mismatch → write refused',
      payload: { detail: { derived: 'self:bob', target: 'self:alice', verdict: 'REJECT — cannot write another identity’s self zone', when: 'BEFORE fold (validate-before-fold, B2 discipline)' } },
      gate: { kind: 'security', label: 'self-key resolver', status: 'enforced', note: 'The resolver is the SAME one; only the operation differs. A foreign-self write never changes authoritative state — it is refused at ingest, not folded then reverted.' },
      note: 'The derive-and-check is not a subscribe-only gate: subscribe, append, replay, and forwarding all pass through this one resolver (AZ-16).',
      docRef: `${AZ} §9 (AZ-16, B4)`,
      sets: { local1: { 'denied guest1 write': 'self:alice ≠ derived self:bob — write refused' } },
    },
    {
      state: 'C1', variant: 'b', phase: 'AR', kind: 'message', from: 'guest1', to: 'local1', frame: 'SUBSCRIBE',
      variantNote: 'The replay path: bob asks to replay history (from 0) of self:alice — replay is derive-and-checked too.',
      label: 'bob tries to replay self:alice',
      payload: { share: 'acct-alice', gladeId: 'notes', key: 'self:alice', shape: 'log', detail: { replayFrom: 'seq 0 (full history)', note: 'replay, not a live subscribe' } },
      note: 'Replay could be the leak the live check misses — so B4 covers it: replaying a foreign self resolves through the same identity-bound resolver.',
      docRef: `${AZ} §9 (AZ-16, B4)`,
      sets: { guest1: { 'pending replay': 'self:alice (foreign)' } },
    },
    {
      state: 'Z1', variant: 'b', phase: 'AR', kind: 'internal', from: 'local1', frame: 'ROUTE',
      variantNote: 'Replay path, same resolver: derived self:bob ≠ self:alice → replay refused; forwarding to peers carries the identical check.',
      label: 'derive → mismatch → replay refused',
      payload: { detail: { derived: 'self:bob', requested: 'self:alice', verdict: 'REJECT — replay of a foreign self', forwarding: 'a peer forwarding this replay applies the SAME resolver — the check is not local-only' } },
      gate: { kind: 'security', label: 'self-key resolver', status: 'enforced', note: 'AZ-16 spells it out: derivation + check apply to subscribe, append, replay, AND forwarding — one canonical resolver replaces supplier-local parsing so no path can smuggle a foreign self past it.' },
      note: 'Replay, append, subscribe — the same rejection, the same seam. self is identity-bound everywhere, or it is not identity-bound at all.',
      docRef: `${AZ} §9 (AZ-16, B4)`,
      sets: { local1: { 'denied guest1 replay': 'self:alice ≠ derived self:bob — replay refused (forwarding checks too)' } },
    },
  ],
};

// ---------------------------------------------------------------------------
// s-signed-op — B5 (GladeAuthzModel §3b): governance ops (grant / revoke /
// name-claim / membership) MUST be signed by an authorized certified device,
// carry the strict predecessor their log requires, and be verified BEFORE
// persistence or fold. A forged signature, an uncertified device, and a
// missing predecessor each fail closed; a legacy UNSIGNED record is retained as
// unverified history but can never create, extend, or revoke authority.
// ---------------------------------------------------------------------------
export const S_SIGNED_OP: Scenario = {
  id: 's-signed-op',
  stage: 2,
  title: 'Signed governance ops — verify before fold, fail closed',
  summary:
    'B5: a grant signed by a certified device with the strict predecessor verifies as-ingest and creates authority; every replica re-verifies (carriers are untrusted). A forged signature, an uncertified device, and a missing predecessor each fail closed with the fold untouched; a legacy unsigned record is history, not authority — it never wins over the signed chain.',

  actors: pick('gryth1', 'guest1', 'local1', 'peer1'),

  initial: {
    gryth1: { session: 'local1 (open, owner)', device: 'certified by account root' },
    local1: {
      'device gryth1': 'certified by account root',
      'origin gryth1': 'head @6 (prev-hash chain)',
      links: 'peer1 (mesh)',
    },
    peer1: { serving: 'ws-x replica', 'device gryth1': 'certified by account root' },
  },

  phases: [
    { id: 'SG', label: 'Signed op accepted (verify-as-ingest)', summary: 'A grant signed by a certified device with the strict predecessor verifies and creates authority; the replica re-verifies independently.' },
    { id: 'FS', label: 'Forged signature fails closed', summary: 'A grant carrying a forged signature does not verify — rejected before fold, retained as evidence.' },
    { id: 'UD', label: 'Uncertified device fails closed', summary: 'A governance op from a device not certified by the account root is refused — revoked/unknown devices fail closed.' },
    { id: 'MP', label: 'Missing predecessor fails closed', summary: 'Even a certified device fails closed when its op omits the strict predecessor its log requires.' },
    { id: 'LU', label: 'Legacy unsigned = history, not authority', summary: 'An unsigned record is retained as unverified history but cannot revoke the signed grant — a signed chain always wins.' },
  ],

  steps: [
    // ---- Phase SG: signed op accepted ------------------------------------
    {
      state: 'A1', phase: 'SG', kind: 'message', from: 'gryth1', to: 'local1', frame: 'HELLO',
      label: 'owner session proves device possession',
      payload: { detail: { session: 'sess-owner', principal: 'gianni (owner root)', deviceProof: 'key-signed session — device certified by the account root' } },
      gate: { kind: 'security', label: 'HELLO principal seam', status: 'enforced', note: 'B5: session establishment MUST prove possession of a device key certified by the account root — §7b’s key-signed session, made MANDATORY for governance. A claimed device key is not proof of possession.' },
      note: 'B5 (GladeAuthzModel §3b): governance requires a proven, certified device at the session — the leg §3a’s "every admin action is a signed op" presumed.',
      docRef: `${AZ} §3b (B5)`,
      sets: { local1: { 'session gryth1': 'open (certified device — possession proved)' } },
    },
    {
      state: 'S1', phase: 'SG', kind: 'internal', from: 'gryth1', frame: 'APPEND',
      label: 'owner signs + appends a grant op (strict predecessor)',
      payload: { detail: { op: 'CapabilityGrant(bob → ws-x, read.subscribe)', signature: 'ed25519 over the canonical form (certified device key)', predecessor: 'prev-hash = origin gryth1 @6 (strict)' } },
      note: 'A security-sensitive op: it is signed by the certified device and carries the exact predecessor its origin log requires (seq 7, prev @6).',
      docRef: `${AZ} §3b (B5) · §3`,
      sets: { gryth1: { 'origin gryth1': 'head @7 (+CapabilityGrant, signed)' } },
    },
    {
      state: 'J3', phase: 'SG', kind: 'message', from: 'gryth1', to: 'local1', frame: 'APPEND',
      label: 'the signed op reaches the node',
      payload: { share: 'ws-x', detail: { op: 'CapabilityGrant(bob → ws-x) @gryth1:7', note: 'delivered for verify-then-fold' } },
      note: 'The op arrives at the node’s replica; it is NOT yet authoritative — B5 requires verification before persistence or fold.',
      docRef: `${AZ} §3b (B5)`,
      sets: { local1: { 'inbound gryth1@7': 'CapabilityGrant(bob ws-x) — awaiting verify' } },
    },
    {
      state: 'Y2', phase: 'SG', kind: 'internal', from: 'local1', frame: 'FOLD',
      label: 'verify-as-ingest → accept, create authority',
      payload: { detail: { checks: 'device certified ✓ · ed25519 signature ✓ · strict predecessor (prev-hash @6) ✓ · seq monotonic ✓', when: 'BEFORE fold (validate-and-authorize before fold — B2 discipline)', verdict: 'ACCEPT' } },
      gate: { kind: 'security', label: 'verify-as-ingest', status: 'enforced', note: 'B5: signatures on grant/revoke/name-claim/membership ops are verified BEFORE persistence or fold — the same O(1)-per-op check as chain sync (Y2), applied to the governance record kinds. Only now does the grant become authority.' },
      note: 'The grant verifies on all four axes and only THEN creates authority. Verify-before-fold: an unverified op never touches authoritative state.',
      docRef: `${AZ} §3b (B5) · ${SM} §8 (B2)`,
      sets: { local1: { 'signed gryth1@7': 'CapabilityGrant(bob ws-x read.subscribe) · sig ok', 'grant bob ws-x': 'read.subscribe (signed governance op @7)', 'inbound gryth1@7': null } },
    },
    {
      state: 'B8', phase: 'SG', kind: 'message', from: 'local1', to: 'peer1', frame: 'OPS',
      label: 'the signed op replicates to a peer',
      payload: { share: 'ws-x', detail: { ops: 'CapabilityGrant(bob ws-x) @gryth1:7 (signed)' } },
      note: 'The op ships to the replica the way all ops do — the signature travels WITH it, so the peer can verify independently.',
      docRef: `${AZ} §3b (B5)`,
    },
    {
      state: 'Y2', phase: 'SG', kind: 'internal', from: 'peer1', frame: 'FOLD',
      label: 'peer re-verifies (carriers are untrusted)',
      payload: { detail: { checks: 'signature ✓ · predecessor ✓', why: 'the carrier (local1) is untrusted by construction — the peer verifies the origin signature itself, not local1’s say-so' } },
      gate: { kind: 'security', label: 'verify-as-ingest', status: 'enforced', note: 'Every hop verifies from the origin signature; there is no trusted relay. The same check on the replica as at the node — a compromised carrier cannot inject authority.' },
      note: 'The peer independently verifies and folds the same authority. Verification is per-op and everywhere, exactly like Y2 in the sync trace.',
      docRef: `${AZ} §3b (B5)`,
      sets: { peer1: { 'signed gryth1@7': 'CapabilityGrant(bob ws-x) · sig ok', 'grant bob ws-x': 'read.subscribe (verified)' } },
    },

    // ---- Phase FS: forged signature fails closed -------------------------
    {
      state: 'J3', phase: 'FS', kind: 'message', from: 'guest1', to: 'local1', frame: 'APPEND',
      label: 'attacker submits a grant with a FORGED signature',
      payload: { share: 'ws-x', detail: { op: 'CapabilityGrant(mallory → ws-x, write.append)', signature: 'FORGED — claims to be the owner, does not verify against the owner key' } },
      note: 'An attacker fabricates a governance op and forges the owner’s signature — the classic "wrong signature" negative test.',
      docRef: `${AZ} §3b (B5)`,
      sets: { local1: { 'inbound guest1@1': 'CapabilityGrant(mallory ws-x) — awaiting verify' } },
    },
    {
      state: 'Y3', phase: 'FS', kind: 'internal', from: 'local1', frame: 'FOLD',
      label: 'signature does not verify → fail closed',
      payload: { detail: { check: 'ed25519 verify against the claimed origin key → FAILS', verdict: 'REJECT — op + suffix dropped from this origin', effect: 'fold untouched; retained as attributable evidence' } },
      gate: { kind: 'security', label: 'verify-as-ingest', status: 'enforced', note: 'B5: a forged signature fails the verify-as-ingest check and is rejected BEFORE fold. It creates no authority; the attempt is kept as bounded, attributable evidence (the equivocation/forgery posture).' },
      note: 'The forged grant changes nothing: mallory gets no authority. Fail closed — the fold still holds only the genuine grant @7.',
      docRef: `${AZ} §3b (B5) · ${SM} §8 (B2)`,
      sets: { local1: { 'signed guest1@1': 'forged CapabilityGrant(mallory ws-x) · sig bad — REJECTED (evidence)', 'inbound guest1@1': null } },
    },

    // ---- Phase UD: uncertified device fails closed -----------------------
    {
      state: 'A1', variant: 'a', phase: 'UD', kind: 'message', from: 'guest1', to: 'local1', frame: 'HELLO',
      variantNote: 'The device-certification negative: guest1’s device is not certified by the account root — a governance session it cannot have.',
      label: 'uncertified device opens a session',
      payload: { detail: { session: 'sess-uncert', principal: 'guest (asserted)', deviceProof: 'device NOT certified by the account root' } },
      gate: { kind: 'security', label: 'HELLO principal seam', status: 'enforced', note: 'B5: revoked or unknown devices MUST fail closed. The session may exist for reads under its own grants, but it carries NO certified device for governance.' },
      note: 'The session’s device is uncertified — flagged now so the governance op it attempts next is refused on those grounds.',
      docRef: `${AZ} §3b (B5)`,
      sets: { local1: { 'session guest1': 'open (device UNCERTIFIED — no governance authority)' } },
    },
    {
      state: 'J3', variant: 'a', phase: 'UD', kind: 'message', from: 'guest1', to: 'local1', frame: 'APPEND',
      variantNote: 'A governance op (revoke) from the uncertified device.',
      label: 'uncertified device attempts a revoke',
      payload: { share: 'ws-x', detail: { op: 'CapabilityRevocation(bob → ws-x)', device: 'uncertified' } },
      note: 'Even a syntactically valid revoke from an uncertified device is a governance op it has no standing to make.',
      docRef: `${AZ} §3b (B5)`,
      sets: { local1: { 'inbound guest1@2': 'CapabilityRevocation(bob ws-x) — device uncertified' } },
    },
    {
      state: 'Y3', variant: 'a', phase: 'UD', kind: 'internal', from: 'local1', frame: 'FOLD',
      variantNote: 'Fail-closed on device certification (not signature): an uncertified device cannot govern.',
      label: 'uncertified device → fail closed',
      payload: { detail: { check: 'signing device certified by account root? → NO', verdict: 'REJECT — governance op from an uncertified/unknown device', effect: 'fold untouched; bob’s grant @7 stands' } },
      gate: { kind: 'security', label: 'verify-as-ingest', status: 'enforced', note: 'B5: signatures on security-sensitive ops MUST be from an AUTHORIZED certified device; unknown/revoked devices fail closed. The revoke does not take — the signed grant it targeted is unaffected.' },
      note: 'The revoke is refused: an uncertified device has no authority to revoke. bob keeps his signed grant.',
      docRef: `${AZ} §3b (B5)`,
      sets: { local1: { 'signed guest1@2': 'CapabilityRevocation(bob ws-x) · uncertified device — REJECTED' } },
    },

    // ---- Phase MP: missing predecessor fails closed ----------------------
    {
      state: 'J3', variant: 'b', phase: 'MP', kind: 'message', from: 'gryth1', to: 'local1', frame: 'APPEND',
      variantNote: 'A certified device, correct signature — but the op omits the strict predecessor its log requires.',
      label: 'certified device submits an op missing its predecessor',
      payload: { share: 'ws-x', detail: { op: 'CapabilityGrant(carol → ws-x) @gryth1:9', signature: 'valid (certified device)', predecessor: 'prev-hash points at @8 — which the node has NOT seen (gap)' } },
      note: 'The device and signature are fine; the op claims seq 9 with a predecessor @8 that never arrived — the "missing/wrong predecessor" negative test.',
      docRef: `${AZ} §3b (B5)`,
      sets: { local1: { 'inbound gryth1@9': 'CapabilityGrant(carol ws-x) — predecessor @8 missing' } },
    },
    {
      state: 'Y3', variant: 'b', phase: 'MP', kind: 'internal', from: 'local1', frame: 'FOLD',
      variantNote: 'Fail-closed on predecessor continuity: even a valid signature cannot fold without its strict predecessor.',
      label: 'missing predecessor → fail closed',
      payload: { detail: { check: 'prev-hash continuity (@8 present?) → NO', verdict: 'REJECT — strict predecessor absent', effect: 'held / quarantined, NOT folded; cannot create authority until @8 lands' } },
      gate: { kind: 'security', label: 'verify-as-ingest', status: 'enforced', note: 'B5: a security-sensitive op MUST carry the strict predecessor its log requires; without prev-hash continuity it fails closed. A valid signature is necessary, not sufficient — position in the chain is part of the proof.' },
      note: 'Carol gets no grant: the op cannot fold out of order. Fail closed on continuity, not signature — the chain position IS part of the authority.',
      docRef: `${AZ} §3b (B5) · ${SM} §8 (B2)`,
      sets: { local1: { 'signed gryth1@9': 'CapabilityGrant(carol ws-x) · sig ok but predecessor @8 MISSING — held, not folded' } },
    },

    // ---- Phase LU: legacy unsigned = history, not authority --------------
    {
      state: 'J3', variant: 'c', phase: 'LU', kind: 'message', from: 'guest1', to: 'local1', frame: 'APPEND',
      variantNote: 'A legacy UNSIGNED record — pre-B5 history with no signature to verify.',
      label: 'a legacy unsigned revoke arrives',
      payload: { share: 'ws-x', detail: { op: 'CapabilityRevocation(bob → ws-x)', signature: 'NONE — legacy unsigned record', claim: 'attempts to revoke bob’s signed grant @7' } },
      note: 'An unsigned record from before the signed-op envelope existed. The negative test: an unsigned legacy record must not WIN governance.',
      docRef: `${AZ} §3b (B5)`,
      sets: { local1: { 'inbound legacy@2': 'unsigned CapabilityRevocation(bob ws-x)' } },
    },
    {
      state: 'Y3', variant: 'c', phase: 'LU', kind: 'internal', from: 'local1', frame: 'FOLD',
      variantNote: 'Classified as unverified history: retained, but powerless to create/extend/revoke authority.',
      label: 'unsigned → history, never authority',
      payload: { detail: { check: 'signature present? → NO', verdict: 'RETAIN as unverified history; MUST NOT create, extend, or revoke authority', outcome: 'bob’s SIGNED grant @7 stands — a signed chain always wins over an unsigned record' } },
      gate: { kind: 'security', label: 'verify-as-ingest', status: 'enforced', note: 'B5: a legacy unsigned record MAY be retained as unverified history but MUST NOT create, extend, or revoke governance authority; it never wins over a signed chain. History is not the same as authority.' },
      note: 'The unsigned revoke is kept for provenance but does not revoke: bob’s signed grant @7 is untouched. Unsigned history can be read, never obeyed as governance.',
      docRef: `${AZ} §3b (B5)`,
      sets: { local1: { 'legacy unsigned@2': 'CapabilityRevocation(bob ws-x) — UNSIGNED: retained as history, NOT authority (grant @7 stands)', 'inbound legacy@2': null } },
    },
  ],
};
