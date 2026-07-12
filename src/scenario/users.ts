// glade-users spine traces (GLP-0006), stage 1 — identity as DATA.
//
// The ruled core (glade-users §1): the principal IS the key. A principal's
// canonical id is the FINGERPRINT of its ed25519 public key; names/avatars/
// emails are attributes, none of them identity. Onboarding is a ceremony
// recorded as ordinary records (invite → key-present/mint → PrincipalRecord +
// IntroductionRecord); the principal fold is keyed by fingerprint, so the same
// key introduced by any path — in any order, on any node — converges to exactly
// one principal (§1.2, the u1/u2/u3 requirement). No central authority: trust
// derives from the introduction (sponsorship) path (§1.3).
//
// Stage-1 posture (§5): the FULL onboarding flow as data, nothing enforced;
// signatures are STRUCTURAL where the crypto seam is stubbed (ed25519 swaps in
// behind the same seam as the node). The glade-users supplier is the authority
// for the users.invites exchange (token validation) and serves the principal
// directory; principal/introduction records are ordinary appends any authorized
// session makes (§4, GDL-038 — no privileged plane).
import type { Scenario } from './types';
import { pick } from './actors';

const GU = 'glade-users';
const SM = 'GladeSupplierModel';

// ---------------------------------------------------------------------------
// s-invite — invite mint → key present/mint → records → converge; replay fails.
// ---------------------------------------------------------------------------
export const S_INVITE: Scenario = {
  id: 's-invite',
  stage: 1,
  title: 'Invite — onboard a new principal (the ceremony as data)',
  summary:
    'gianni mints an InviteRecord + a session-placement URL; a newcomer opens it, mints a browser device key, and the users supplier validates the token; a PrincipalRecord (keyed by FINGERPRINT) + an IntroductionRecord (the sponsorship edge) append; both sides’ folds converge on the same principal. A replayed invite fails as data and mints nothing.',

  actors: pick('users-sup', 'gryth1', 'guest1', 'local1'),

  initial: {
    gryth1: { session: 'local1 (open, gianni)', view: 'user list (me)' },
    // gianni is already a principal — his key is his identity.
    local1: {
      'session gryth1': 'open (gianni)',
      'principal gianni': 'fp:11a7 · signed profile (root key)',
    },
  },

  phases: [
    { id: 'IM', label: 'Mint the invite', summary: 'The supplier attaches + declares the identity surfaces; gianni mints an InviteRecord (token, expiry, grants-to-be) and the joinable URL — the record replicates, the token rides the URL out-of-band.' },
    { id: 'IA', label: 'Accept — present/mint a key', summary: 'The newcomer opens the URL, mints a browser device key, and the users supplier answers the accept exchange: token freshness + signature (structural in stage 1).' },
    { id: 'IR', label: 'Records + convergence', summary: 'A PrincipalRecord (fingerprint-keyed) + an IntroductionRecord (sponsorship) append; both sides’ folds converge on the same principal.' },
    { id: 'IX', label: 'Replay fails as data', summary: 'A second accept re-presenting the consumed token is rejected with a reason and mints NO records — a bad invite is data, not an exception.' },
  ],

  steps: [
    // ---- Phase IM: mint --------------------------------------------------
    {
      state: 'A1', phase: 'IM', kind: 'message', from: 'users-sup', to: 'local1', frame: 'HELLO',
      label: 'users supplier attaches (wire authority session)',
      payload: { detail: { session: 'sess-usup', principal: 'glade-users (supplier)', posture: 'wire-attached authority session (P00-a) — depends on the wire + a client lib only, no node internals' } },
      gate: { kind: 'security', label: 'HELLO principal seam', status: 'stub-allow-all', note: 'Stage 1 is allow-all: the supplier attaches like any session. The capability slot at HELLO is where stage-2 enforcement lands with no supplier rewrite.' },
      note: 'The glade-users supplier is the authority-side counterpart of a tap (GDL-040): it answers the users.invites exchange and serves the principal directory. It attaches as an ORDINARY session — no privileged plane.',
      docRef: `${SM} §1–2 · ${GU} §4`,
      sets: { local1: { 'session users-sup': 'open (supplier principal)' } },
    },
    {
      state: 'J3', phase: 'IM', kind: 'message', from: 'users-sup', to: 'local1', frame: 'APPEND',
      label: 'declare the identity surfaces (as records)',
      payload: { share: 'home', detail: { records: 'BindingDecls — dir.principals (log, fingerprint-keyed) + users.introductions (log) + users.invites (exchange)', mode: 'ordinary runtime records under the registrant chain (GDL-037) — the same records dynamic config writes' } },
      note: 'Registration = ordinary records: the supplier CONTRIBUTES declarations, never a side channel into the node. dir.principals is keyed by fingerprint — the fold key IS the identity.',
      docRef: `${SM} §3 · ${GU} §4`,
      sets: { local1: { 'binding home/dir.principals': 'log (fingerprint-keyed)', 'binding home/users.introductions': 'log', 'binding users.invites': 'exchange (users-sup)' }, 'users-sup': { declared: 'dir.principals · users.introductions · users.invites' } },
    },
    {
      state: 'C1', phase: 'IM', kind: 'message', from: 'gryth1', to: 'local1', frame: 'SUBSCRIBE',
      label: 'gianni subscribes the user directory',
      payload: { share: 'home', gladeId: 'dir.principals', key: '∅ (unkeyed)', shape: 'log' },
      note: 'The user list is a subscription to dir.principals; gianni will see the newcomer appear as an ordinary replicated op.',
      docRef: `${GU} §4`,
      sets: { gryth1: { subs: 'home/dir.principals' }, local1: { 'sub home/dir.principals': 'gryth1' } },
    },
    {
      state: 'U1', phase: 'IM', kind: 'internal', from: 'gryth1', frame: 'APPEND',
      label: 'gianni mints the invite',
      payload: { detail: { record: 'InviteRecord{token: inv-7k, inviter: fp:11a7, grants-to-be: [acme member], expiry: +48h}', url: 'https://…/bootstrap.json?invite=inv-7k — the session-placement bootstrap (GDL-032)', mints: 'an invite NEVER mints identity — it introduces an existing key or invites the recipient to mint one (§3.1)' } },
      note: 'The inviter mints an InviteRecord + a joinable URL. The RECORD replicates on glade; the token rides the URL out-of-band (email/chat). The optional grants-to-be become enforced grants only at stage 2.',
      docRef: `${GU} §3.1`,
      sets: { gryth1: { 'origin log': '+InviteRecord(inv-7k)', view: 'invite link ready' } },
    },
    {
      state: 'J3', phase: 'IM', kind: 'message', from: 'gryth1', to: 'local1', frame: 'APPEND',
      label: 'the InviteRecord reaches the node replica',
      payload: { share: 'home', gladeId: 'users.invites', detail: { op: 'InviteRecord(inv-7k) (origin: gianni)', path: 'gryth1↔local1 is the same machine — the op parks in the replica so the supplier can validate the token at accept' } },
      note: 'gianni and his node are the same machine; the invite op lands in the local replica. Only the RECORD is on glade — the token travelled in the URL.',
      docRef: `${SM} §2 (op-append)`,
      sets: { local1: { 'fold users.invites': 'InviteRecord(inv-7k, live)' } },
    },

    // ---- Phase IA: accept — present/mint a key ---------------------------
    {
      state: 'U2', phase: 'IA', kind: 'message', from: 'guest1', to: 'local1', frame: 'HELLO',
      label: 'newcomer opens the URL, mints a device key',
      payload: { detail: { session: 'sess-dana', principal: 'dana — fp:9c2e (freshly minted browser device key)', why: 'browsers cannot reach ssh-agent (§1.4): a browser session mints a device keypair; root certification can follow later from a CLI root' } },
      gate: { kind: 'security', label: 'HELLO principal seam (key presented)', status: 'stub-allow-all', note: 'The principal IS the key (§1.1); the fingerprint fp:9c2e is its canonical id. Stage 1 asserts it; ed25519 verification of the device-cert chain lands behind this same seam.' },
      note: 'The recipient presents an existing pubkey OR mints one. Here the browser mints a device key — the device-cert model already in the authz doc, inverted (root certifies the device later).',
      docRef: `${GU} §3.1 · §1.4`,
      sets: { local1: { 'session guest1': 'open (dana, fp:9c2e device key)' }, guest1: { key: 'minted device key fp:9c2e (root-cert to follow)' } },
    },
    {
      state: 'D1', phase: 'IA', kind: 'message', from: 'guest1', to: 'local1', frame: 'EXCHANGE',
      label: 'accept the invite',
      payload: { share: 'home', gladeId: 'users.invites', shape: 'exchange', verb: 'invite.accept', correlationId: 'inv-acc-1', detail: { token: 'inv-7k (from the URL)', pubkey: 'fp:9c2e (the presented device key)' } },
      note: 'Accept is an exchange the supplier answers (§4): the token proves the invite, the pubkey is the principal being introduced.',
      docRef: `${GU} §3.1 · ${SM} §2.3`,
      sets: { local1: { 'pending inv-acc-1': 'guest1 → invite.accept' } },
    },
    {
      state: 'C2', phase: 'IA', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'route the accept to the users supplier',
      payload: { detail: { question: 'who provides users.invites?', answer: 'users-sup (the attached provider)' } },
      gate: { kind: 'routing', label: 'provider lookup', status: 'designed', note: 'The keyed provider entry map IS the routing table (GladeSupplierModel §2.2). One provider per (share, glade id); stage 1 is stub-allow-all at Subscribe.' },
      note: 'The exchange routes to the attached provider — the same directed path as any exchange.',
      docRef: `${SM} §2.2`,
      sets: { local1: { 'route users.invites': 'users-sup' } },
    },
    {
      state: 'D2', phase: 'IA', kind: 'message', from: 'local1', to: 'users-sup', frame: 'EXCHANGE',
      label: 'forward the accept',
      payload: { gladeId: 'users.invites', shape: 'exchange', verb: 'invite.accept', correlationId: 'inv-acc-1' },
      note: 'Routed to the provider; correlation id preserved 1:1 (the supplier MUST echo corr — §2.3).',
      docRef: `${SM} §2.3`,
      sets: { 'users-sup': { 'pending inv-acc-1': 'local1' } },
    },
    {
      state: 'U3', phase: 'IA', kind: 'internal', from: 'users-sup', frame: 'PROVIDE',
      label: 'validate the invite (token + signature)',
      payload: { detail: { token: 'inv-7k — matches a live InviteRecord, not consumed, not expired', signature: 'device-key signature over the accept', verdict: 'VALID' } },
      gate: { kind: 'security', label: 'invite validation seam', status: 'designed', note: 'Token freshness (replay/expiry) is checked structurally in stage 1; ed25519 signature verification swaps in behind this seam (§5, the node’s crypto posture). Designed, not yet enforced end-to-end.' },
      note: 'The supplier answers the users.invites exchange: it validates the token against the folded InviteRecord and the presented signature. The crypto is stubbed structurally — the STRUCTURE is real, the check is future.',
      docRef: `${GU} §3.1 · §5`,
      sets: { 'users-sup': { 'invite inv-7k': 'validated (fresh) — consuming' } },
    },

    // ---- Phase IR: records + convergence ---------------------------------
    {
      state: 'U4', phase: 'IR', kind: 'internal', from: 'users-sup', frame: 'APPEND',
      label: 'PrincipalRecord appends (keyed by fingerprint)',
      payload: { share: 'home', gladeId: 'dir.principals', detail: { record: 'PrincipalRecord{fingerprint: fp:9c2e, profile: {name: "dana"}, sig}', key: 'the FOLD KEY is the fingerprint fp:9c2e — set-union dedup (§1.1/1.2)', origin: 'appended by the supplier as the accept completes; any authorized session could append it (GDL-038)' } },
      note: 'The principal record is keyed by FINGERPRINT, not by name or invite path. This is the whole convergence guarantee: the same key folds once, however many paths reach it.',
      docRef: `${GU} §1.1 · §3.1 · §4`,
      sets: { local1: { 'principal dana': 'fp:9c2e · signed profile (name "dana")', 'fold dir.principals': '+dana@fp:9c2e' }, 'users-sup': { serving: 'dir.principals (+dana)' } },
    },
    {
      state: 'U5', phase: 'IR', kind: 'internal', from: 'users-sup', frame: 'APPEND',
      label: 'IntroductionRecord appends (sponsorship edge)',
      payload: { share: 'home', gladeId: 'users.introductions', detail: { record: 'IntroductionRecord{sponsor: fp:11a7 (gianni), introduced: fp:9c2e (dana)}', why: 'trust derives from the introduction path — who sponsored whom — never a central authority (§1.3)' } },
      note: 'The sponsorship edge (gianni → dana) is the trust provenance. AZ-15’s enrollment model generalized to people: the community’s "who is here" is a fold over these signed records.',
      docRef: `${GU} §1.3 · §3.1`,
      sets: { local1: { 'edge gianni→dana': 'sponsorship', 'fold users.introductions': '+gianni→dana' } },
    },
    {
      state: 'D4', phase: 'IR', kind: 'message', from: 'users-sup', to: 'local1', frame: 'EXCHANGE-RESP',
      label: 'accept response (ok)', response: true,
      payload: { correlationId: 'inv-acc-1', detail: { ok: 'true', principal: 'fp:9c2e (dana)', consumed: 'inv-7k' } },
      note: 'The exchange completes; the invite is consumed. Directed response, corr 1:1.',
      docRef: `${SM} §2.3`,
      sets: { 'users-sup': { 'pending inv-acc-1': null, 'invite inv-7k': 'consumed' } },
    },
    {
      state: 'D5', phase: 'IR', kind: 'message', from: 'local1', to: 'guest1', frame: 'EXCHANGE-RESP',
      label: 'onboarded — response to the newcomer', response: true,
      payload: { correlationId: 'inv-acc-1' },
      note: 'dana is onboarded: her session now carries a principal whose id is her key’s fingerprint.',
      sets: { guest1: { view: 'onboarded — principal dana (fp:9c2e)', 'principal dana': 'fp:9c2e' }, local1: { 'pending inv-acc-1': null } },
    },
    {
      state: 'B9', phase: 'IR', kind: 'message', from: 'local1', to: 'gryth1', frame: 'OPS', response: true,
      label: 'the new principal replicates to gianni',
      payload: { share: 'home', gladeId: 'dir.principals', shape: 'log', detail: { ops: 'PrincipalRecord(dana@fp:9c2e) + IntroductionRecord(gianni→dana)' } },
      note: 'gianni’s A3 subscription delivers: the new principal + the sponsorship edge arrive as ordinary ops — the user list grows, no re-request.',
      docRef: `${GU} §4`,
      sets: { gryth1: { view: 'user list: me + dana (fp:9c2e), sponsored by me', 'principal dana': 'fp:9c2e' } },
    },
    {
      state: 'U6', phase: 'IR', kind: 'internal', from: 'local1', frame: 'FOLD',
      label: 'both views converge on one principal',
      payload: { detail: { fingerprint: 'fp:9c2e', views: 'gianni + dana both fold the SAME principal', dedup: 'any LATER invite of this key anywhere dedups by fingerprint (§1.2) — no duplicate identity is representable', invariant: 'INV-6: no two principal records share a fingerprint' } },
      note: 'Convergence is not coordinated — it is the fold keyed by fingerprint. This is the seed of the u1/u2/u3 guarantee (see s-converge-identity).',
      docRef: `${GU} §1.2`,
      sets: { local1: { 'converged fp:9c2e': 'one principal (dana) — every view agrees' } },
    },

    // ---- Phase IX: replay fails as data ----------------------------------
    {
      state: 'D1', phase: 'IX', kind: 'message', from: 'guest1', to: 'local1', frame: 'EXCHANGE',
      label: 're-present the consumed token (replay)',
      payload: { share: 'home', gladeId: 'users.invites', shape: 'exchange', verb: 'invite.accept', correlationId: 'inv-acc-2', detail: { token: 'inv-7k (already consumed)', note: 'a double-submit / replay of the same invite' } },
      note: 'The same token is presented again — the replay case §6 calls out. Failure must be DATA, not a crash.',
      docRef: `${GU} §6`,
      sets: { local1: { 'pending inv-acc-2': 'guest1 → invite.accept (replay)' } },
    },
    {
      state: 'D2', phase: 'IX', kind: 'message', from: 'local1', to: 'users-sup', frame: 'EXCHANGE',
      label: 'forward the replay',
      payload: { gladeId: 'users.invites', shape: 'exchange', verb: 'invite.accept', correlationId: 'inv-acc-2' },
      note: 'Routed to the same provider; corr inv-acc-2.',
      sets: { 'users-sup': { 'pending inv-acc-2': 'local1' } },
    },
    {
      state: 'U3', phase: 'IX', kind: 'internal', from: 'users-sup', frame: 'PROVIDE', variant: 'a',
      variantNote: 'The failure branch of validation: the token is already consumed (or expired), so the invite is INVALID — the same validation step, opposite verdict.',
      label: 'validate → invalid (consumed/expired)',
      payload: { detail: { token: 'inv-7k — already CONSUMED', verdict: 'INVALID', effect: 'mint NOTHING' } },
      gate: { kind: 'security', label: 'invite validation seam', status: 'designed', note: 'Replay/expiry is exactly the freshness check U3 performs; here it rejects. Structural in stage 1.' },
      note: 'The supplier rejects: a consumed or expired invite validates to INVALID. No PrincipalRecord, no IntroductionRecord — the fold is untouched.',
      docRef: `${GU} §6 · §3.1`,
      sets: { 'users-sup': { 'invite inv-7k': 'consumed — replay rejected' } },
    },
    {
      state: 'U7', phase: 'IX', kind: 'message', from: 'users-sup', to: 'local1', frame: 'EXCHANGE-RESP',
      label: 'invite rejected (ok:false) — no records minted', response: true,
      payload: { correlationId: 'inv-acc-2', detail: { ok: 'false', error: 'invite already consumed', minted: 'nothing — the fold is unchanged' } },
      note: 'A bad invite is a VALUE: ok:false + a reason, corr intact, the session stays usable (GladeSupplierModel §2.4). Absence is uniformly a value.',
      docRef: `${GU} §6 · ${SM} §2.4`,
      sets: { 'users-sup': { 'pending inv-acc-2': null } },
    },
    {
      state: 'D5', phase: 'IX', kind: 'message', from: 'local1', to: 'guest1', frame: 'EXCHANGE-RESP',
      label: 'rejection surfaced to the caller', response: true,
      payload: { correlationId: 'inv-acc-2', detail: { result: 'rejected', reason: 'invite already used' } },
      note: 'The caller sees an appropriate message, not a spinner and not a duplicate identity. The replay changed nothing.',
      sets: { guest1: { view: 'invite rejected (already used) — no identity minted' }, local1: { 'pending inv-acc-2': null } },
    },
  ],
};

// ---------------------------------------------------------------------------
// s-name-clash — two freds; render name·fp6; first-valid-claim-wins handle;
// viewer-local petname override.
// ---------------------------------------------------------------------------
export const S_NAME_CLASH: Scenario = {
  id: 's-name-clash',
  stage: 1,
  title: 'Name clash — two freds, discriminated by fingerprint',
  summary:
    'Two DISTINCT principals both self-assert the display name "fred"; the rendering rule shows name·fp6 wherever they collide. In the acme domain’s users.names registry the FIRST valid claim wins the bare handle "fred" (deterministic by chain order) and the second renders fred·b7c9. A viewer’s local petname — stored in their own account domain — overrides the display for that viewer alone.',

  actors: pick('users-sup', 'gryth1', 'guest1', 'gryth3', 'local1'),

  initial: {
    // the users supplier is already attached + serving the directory (see s-invite).
    local1: {
      'session users-sup': 'open (authority)',
      'binding home/dir.principals': 'log (fingerprint-keyed)',
      'binding acme/users.names': 'log (optional handle registry)',
    },
  },

  phases: [
    { id: 'NC', label: 'Two freds self-assert', summary: 'Two distinct keys each sign a profile asserting the display name "fred" — anyone can assert any name.' },
    { id: 'NR', label: 'Rendering rule (name·fp6)', summary: 'Where the principals collide, a bare name is never shown — the projection renders name·fp6.' },
    { id: 'NH', label: 'Domain handle — first-valid-claim-wins', summary: 'In acme’s users.names registry the earlier claim wins the bare handle; the later one renders fingerprint-suffixed.' },
    { id: 'NP', label: 'Petname override (viewer-local)', summary: 'A viewer aliases fred-2 in their OWN account domain; the petname wins in their UI alone and is never replicated.' },
  ],

  steps: [
    // ---- Phase NC: two freds self-assert ---------------------------------
    {
      state: 'A1', phase: 'NC', kind: 'message', from: 'gryth1', to: 'local1', frame: 'HELLO',
      label: 'fred-1’s session opens',
      payload: { detail: { session: 'sess-f1', principal: 'fp:a1b2 (a root key)' } },
      gate: { kind: 'security', label: 'HELLO principal seam', status: 'stub-allow-all', note: 'Identity is the key fp:a1b2; the name is an attribute asserted next. Nothing enforced in stage 1.' },
      note: 'The first principal — its identity is its fingerprint, whatever it later calls itself.',
      docRef: `${GU} §1.1`,
      sets: { local1: { 'session gryth1': 'open (fp:a1b2)', 'principal fred-1': 'fp:a1b2' } },
    },
    {
      state: 'U8', phase: 'NC', kind: 'internal', from: 'gryth1', frame: 'APPEND',
      label: 'fred-1 self-asserts the name "fred"',
      payload: { detail: { record: 'signed profile{name: "fred"} on fp:a1b2', kind: 'a display name is a SIGNED, self-asserted attribute (§2.1) — not identity' } },
      note: 'Anyone can assert any name; the key signs its own profile. This is why the rendering discipline below is normative, not cosmetic.',
      docRef: `${GU} §2.1`,
      sets: { local1: { 'principal fred-1': 'fp:a1b2 · name="fred" (self-asserted)' } },
    },
    {
      state: 'A1', phase: 'NC', kind: 'message', from: 'guest1', to: 'local1', frame: 'HELLO',
      label: 'fred-2’s session opens (a different key)',
      payload: { detail: { session: 'sess-f2', principal: 'fp:b7c9 (a DIFFERENT root key)' } },
      gate: { kind: 'security', label: 'HELLO principal seam', status: 'stub-allow-all', note: 'A different principal entirely — fp:b7c9 ≠ fp:a1b2. Two people, two keys; the shared name is coincidence.' },
      note: 'The second principal is a distinct key. Nothing stops it asserting the same name.',
      docRef: `${GU} §1.1`,
      sets: { local1: { 'session guest1': 'open (fp:b7c9)', 'principal fred-2': 'fp:b7c9' } },
    },
    {
      state: 'U8', phase: 'NC', kind: 'internal', from: 'guest1', frame: 'APPEND',
      label: 'fred-2 ALSO self-asserts "fred"',
      payload: { detail: { record: 'signed profile{name: "fred"} on fp:b7c9', collision: 'two principals now claim the same bare name — the two-freds problem (§2)' } },
      note: 'The collision is real and expected: names are not unique and were never promised to be (the honest Zooko trade, §2.4).',
      docRef: `${GU} §2.1`,
      sets: { local1: { 'principal fred-2': 'fp:b7c9 · name="fred" (self-asserted)' } },
    },

    // ---- Phase NR: rendering rule ----------------------------------------
    {
      state: 'U9', phase: 'NR', kind: 'internal', from: 'local1', frame: 'FOLD',
      label: 'render rule — never a bare colliding name',
      payload: { detail: { rule: 'a bare display name is NEVER shown where principals can collide — render name·fp6 (first 6 of the fingerprint)', fred1: 'fred·a1b2', fred2: 'fred·b7c9', unless: 'a petname or a scoped handle applies (below)' } },
      note: 'The rendering rule is the correctness discipline that makes self-asserted names safe: discrimination by fingerprint, always, wherever collision is possible.',
      docRef: `${GU} §2.2`,
      sets: { local1: { 'render fred-1': 'fred·a1b2', 'render fred-2': 'fred·b7c9' } },
    },

    // ---- Phase NH: domain handle — first-valid-claim-wins ----------------
    {
      state: 'U10', phase: 'NH', kind: 'internal', from: 'gryth1', frame: 'APPEND',
      label: 'fred-1 claims the handle "fred" in acme (first)',
      payload: { share: 'acme', gladeId: 'users.names', detail: { record: 'NameClaim{handle: "fred", principal: fp:a1b2, chain-order: t1}', registry: 'acme’s OPTIONAL users.names registry — signed append-only records, not consensus (§2.4)' } },
      note: 'A scoped handle is a signed claim in a domain’s registry. Glade already has every primitive this needs — signed chains, revocation-wins — so it is ordinary records + a fold.',
      docRef: `${GU} §2.4`,
      sets: { local1: { 'fold acme/users.names': 'claim(fred → fred-1@fp:a1b2, t1)' } },
    },
    {
      state: 'U10', phase: 'NH', kind: 'internal', from: 'guest1', frame: 'APPEND',
      label: 'fred-2 claims "fred" too (later)',
      payload: { share: 'acme', gladeId: 'users.names', detail: { record: 'NameClaim{handle: "fred", principal: fp:b7c9, chain-order: t2}', order: 't2 > t1 — this claim is second' } },
      note: 'The second claim for the same handle is valid data; it simply loses the fold below. No claim is rejected at write time.',
      docRef: `${GU} §2.4`,
      sets: { local1: { 'fold acme/users.names': '+claim(fred → fred-2@fp:b7c9, t2)' } },
    },
    {
      state: 'U11', phase: 'NH', kind: 'internal', from: 'local1', frame: 'FOLD',
      label: 'first-valid-claim-wins resolves the handle',
      payload: { detail: { winner: 'fred-1@fp:a1b2 (t1 — earliest by chain order)', loser: 'fred-2@fp:b7c9 renders fred·b7c9 in acme until it claims another handle', determinism: 'earliest by chain order; cross-origin ties resolve by the fold’s existing lamport/origin order (§2.4)', notGlobal: 'global uniqueness is deliberately NOT promised — cross-domain reference is petnames or handle@domain' } },
      note: 'The fold is deterministic and needs no consensus: the earliest valid claim gets the bare handle "fred" in acme; the second visibly loses and stays fingerprint-suffixed.',
      docRef: `${GU} §2.4`,
      sets: { local1: { 'handle acme/fred': 'fred-1@fp:a1b2 (first valid claim)', 'render fred-2 @acme': 'fred·b7c9 (handle lost)' } },
    },

    // ---- Phase NP: petname override --------------------------------------
    {
      state: 'A1', phase: 'NP', kind: 'message', from: 'gryth3', to: 'local1', frame: 'HELLO',
      label: 'a viewer’s session opens',
      payload: { detail: { session: 'sess-view', principal: 'fp:c3d3 (a third principal — the viewer)' } },
      gate: { kind: 'security', label: 'HELLO principal seam', status: 'stub-allow-all', note: 'The viewer is its own principal; it also joins its own account domain (AZ-17) at HELLO.' },
      note: 'A third party who knows fred-2 personally and wants a memorable alias for them.',
      docRef: `${GU} §2.3`,
      sets: { local1: { 'session gryth3': 'open (fp:c3d3)', 'principal viewer': 'fp:c3d3' } },
    },
    {
      state: 'J3', phase: 'NP', kind: 'message', from: 'gryth3', to: 'local1', frame: 'APPEND',
      label: 'viewer sets a petname for fred-2',
      payload: { share: 'acct-viewer', gladeId: 'petnames', key: 'fp:b7c9', shape: 'value', detail: { value: '"fred (work)"', where: 'the viewer’s OWN account domain (AZ-17 territory) — never replicated to anyone else' } },
      note: 'A petname is a local alias in the viewer’s account domain. It is not the users supplier’s data; it is documented here for the rendering rule.',
      docRef: `${GU} §2.3 · §4`,
      sets: { local1: { 'fold acct-viewer/petnames': 'fp:b7c9 → "fred (work)"' } },
    },
    {
      state: 'U12', phase: 'NP', kind: 'internal', from: 'local1', frame: 'FOLD',
      label: 'petname wins — for this viewer alone',
      payload: { detail: { render: 'in the viewer’s UI, fred-2 renders as "fred (work)" — the petname beats both the self-asserted name and the fingerprint suffix', scope: 'viewer-local ONLY: fred-1 and fred-2 never see it; it lives in acct-viewer and is never replicated', precedence: 'petname > scoped handle > self-asserted name·fp6 (§2.2/2.3)' } },
      note: 'The petname always wins in that user’s UI and nowhere else. Privacy + override without any coordination — the account-domain-local alias.',
      docRef: `${GU} §2.3`,
      sets: { local1: { 'render fred-2 @gryth3': 'fred (work) (petname wins, viewer-local)' } },
    },
  ],
};

// ---------------------------------------------------------------------------
// s-converge-identity — u1/u2/u3: different invite orders on different nodes
// converge to exactly one principal per fingerprint (the §1.2 requirement).
// ---------------------------------------------------------------------------
export const S_CONVERGE_IDENTITY: Scenario = {
  id: 's-converge-identity',
  stage: 1,
  title: 'Converge identity — one principal per fingerprint, any order',
  summary:
    'u1 invites u2, u3 invites u2, and u3 invites u1 — three introductions folded in DIFFERENT orders on two different nodes. Because the principal fold is keyed by fingerprint (set-union dedup), u2 (reached by two invite paths) folds to exactly ONE principal, u1 (self + an introduction) folds to one, and both nodes’ views are identical. INV-6 holds: no two principal records share a fingerprint.',

  actors: pick('users-sup', 'gryth1', 'guest1', 'gryth3', 'local1', 'local2'),

  initial: {
    // u1 and u3 are already onboarded; u2 is the key introduced by two paths.
    // The same InviteRecords/IntroductionRecords reach both nodes via ordinary
    // home-share anti-entropy (see s-offline) — this trace is about FOLD ORDER.
    local1: {
      'session users-sup': 'open (authority)',
      'principal u1': 'fp:1111 · onboarded (gianni)',
      'principal u3': 'fp:3333 · onboarded',
    },
    local2: {
      'session users-sup': 'open (authority)',
      'principal u3': 'fp:3333 · onboarded (this is u3’s node)',
    },
  },

  phases: [
    { id: 'CA', label: 'Node A folds order 1', summary: 'u1→u2, then u3→u2, then u3→u1: u2 is introduced by two paths; the second adds an edge, not a principal.' },
    { id: 'CB', label: 'Node B folds order 2', summary: 'The SAME records reach u3’s node and fold in a different order: u3→u1, u3→u2, u1→u2.' },
    { id: 'CC', label: 'Both converge', summary: 'Keyed by fingerprint, both nodes fold to exactly three principals — identical views, no duplicate identity representable.' },
  ],

  steps: [
    // ---- Phase CA: node A, fold order 1 ----------------------------------
    {
      state: 'U4', phase: 'CA', kind: 'internal', from: 'local1', frame: 'APPEND',
      label: 'node A folds u2 (via u1’s invite)',
      payload: { share: 'home', gladeId: 'dir.principals', detail: { record: 'PrincipalRecord{fingerprint: fp:2222 (u2)}', key: 'folded under the FINGERPRINT fp:2222' } },
      note: 'u1 invited u2; u2’s key folds into node A’s directory, keyed by fingerprint.',
      docRef: `${GU} §1.1 · §3.1`,
      sets: { local1: { 'principal u2': 'fp:2222 · introduced (via u1)' } },
    },
    {
      state: 'U5', phase: 'CA', kind: 'internal', from: 'local1', frame: 'APPEND',
      label: 'node A folds edge u1→u2',
      payload: { share: 'home', gladeId: 'users.introductions', detail: { record: 'IntroductionRecord{sponsor: fp:1111 (u1), introduced: fp:2222 (u2)}' } },
      note: 'The first sponsorship edge to u2.',
      docRef: `${GU} §1.3`,
      sets: { local1: { 'edge u1→u2': 'sponsorship' } },
    },
    {
      state: 'U5', phase: 'CA', kind: 'internal', from: 'local1', frame: 'APPEND',
      label: 'node A folds edge u3→u2 (SAME key, second path)',
      payload: { share: 'home', gladeId: 'users.introductions', detail: { record: 'IntroductionRecord{sponsor: fp:3333 (u3), introduced: fp:2222 (u2)}', dedup: 'u2’s key (fp:2222) is ALREADY folded — this adds a second sponsorship EDGE, never a second principal' } },
      note: 'u3 also invites u2. Because the principal fold is keyed by fingerprint, the second invite path does NOT mint a duplicate u2 — it records another sponsorship edge to the one principal.',
      docRef: `${GU} §1.2`,
      sets: { local1: { 'edge u3→u2': 'sponsorship (second path to fp:2222)' } },
    },
    {
      state: 'U5', phase: 'CA', kind: 'internal', from: 'local1', frame: 'APPEND',
      label: 'node A folds edge u3→u1 (introduction of an existing key)',
      payload: { share: 'home', gladeId: 'users.introductions', detail: { record: 'IntroductionRecord{sponsor: fp:3333 (u3), introduced: fp:1111 (u1)}', kind: 'introduction of an EXISTING principal (§3.2) — u1 already exists, so this is an edge, not a mint' } },
      note: 'u3 invites u1, who already exists. The invite of an existing key becomes an introduction edge rather than a duplicate — exactly the §3.2 case.',
      docRef: `${GU} §3.2`,
      sets: { local1: { 'edge u3→u1': 'sponsorship' } },
    },
    {
      state: 'U6', phase: 'CA', kind: 'internal', from: 'local1', frame: 'FOLD',
      label: 'node A converges: 3 principals',
      payload: { detail: { principals: 'u1@fp:1111 · u2@fp:2222 · u3@fp:3333', u2: 'ONE principal despite two invite paths', u1: 'ONE principal despite self + introduction' } },
      note: 'Node A’s directory holds exactly three principals — one per fingerprint. Two of them were reached by more than one path; neither duplicated.',
      docRef: `${GU} §1.2`,
      sets: { local1: { converged: '3 principals (u1@1111, u2@2222, u3@3333)' } },
    },

    // ---- Phase CB: node B, fold order 2 ----------------------------------
    {
      state: 'U5', phase: 'CB', kind: 'internal', from: 'local2', frame: 'APPEND',
      label: 'node B folds edge u3→u1 FIRST',
      payload: { share: 'home', gladeId: 'users.introductions', detail: { record: 'IntroductionRecord{sponsor: fp:3333, introduced: fp:1111}', order: 'this node sees the records in a DIFFERENT order — u3→u1 arrives first' } },
      note: 'Node B (u3’s node) folds the same op-set in a different arrival order. u1’s key folds here via the introduction.',
      docRef: `${GU} §3.2`,
      sets: { local2: { 'edge u3→u1': 'sponsorship', 'principal u1': 'fp:1111 · introduced (via u3)' } },
    },
    {
      state: 'U4', phase: 'CB', kind: 'internal', from: 'local2', frame: 'APPEND',
      label: 'node B folds u2 (via u3’s invite)',
      payload: { share: 'home', gladeId: 'dir.principals', detail: { record: 'PrincipalRecord{fingerprint: fp:2222 (u2)}', key: 'keyed by fingerprint — same key as node A folded, arriving by a different edge first' } },
      note: 'On this node u2 first appears via u3’s invite. Same fingerprint fp:2222, different path.',
      docRef: `${GU} §1.1`,
      sets: { local2: { 'principal u2': 'fp:2222 · introduced (via u3)' } },
    },
    {
      state: 'U5', phase: 'CB', kind: 'internal', from: 'local2', frame: 'APPEND',
      label: 'node B folds edge u3→u2 (the introducing edge)',
      payload: { share: 'home', gladeId: 'users.introductions', detail: { record: 'IntroductionRecord{sponsor: fp:3333 (u3), introduced: fp:2222 (u2)}', arrival: 'on node B this edge arrives WITH u2 — the first of u2’s two sponsorship edges to land here' } },
      note: 'The u3→u2 sponsorship edge — the same record node A folded, arriving in a different position in the stream.',
      docRef: `${GU} §1.3`,
      sets: { local2: { 'edge u3→u2': 'sponsorship' } },
    },
    {
      state: 'U5', phase: 'CB', kind: 'internal', from: 'local2', frame: 'APPEND',
      label: 'node B folds edge u1→u2 (SAME key, second path)',
      payload: { share: 'home', gladeId: 'users.introductions', detail: { record: 'IntroductionRecord{sponsor: fp:1111, introduced: fp:2222}', dedup: 'fp:2222 already folded on node B — again just a second edge, not a second principal' } },
      note: 'The other path to u2 arrives second here. Same dedup: one principal, a second sponsorship edge.',
      docRef: `${GU} §1.2`,
      sets: { local2: { 'edge u1→u2': 'sponsorship (second path to fp:2222)' } },
    },
    {
      state: 'U6', phase: 'CB', kind: 'internal', from: 'local2', frame: 'FOLD',
      label: 'node B converges: the SAME 3 principals',
      payload: { detail: { principals: 'u1@fp:1111 · u2@fp:2222 · u3@fp:3333', order: 'folded in a different order than node A — identical result' } },
      note: 'Different arrival order, identical fold: three principals, one per fingerprint. Convergence is a property of the fold, not of the order.',
      docRef: `${GU} §1.2`,
      sets: { local2: { converged: '3 principals (u1@1111, u2@2222, u3@3333)' } },
    },

    // ---- Phase CC: both converge -----------------------------------------
    {
      state: 'U6', phase: 'CC', kind: 'internal', from: 'local1', frame: 'FOLD',
      label: 'every view agrees — one principal per fingerprint',
      payload: { detail: { nodeA: 'u1@1111 · u2@2222 · u3@3333', nodeB: 'u1@1111 · u2@2222 · u3@3333', claim: 'both nodes (and every session’s view) resolve EXACTLY one principal per fingerprint — the u1/u2/u3 guarantee', invariant: 'INV-6: after fold, no two principal records share a fingerprint' } },
      note: 'This is the whole point of key-canonical identity: sequence-independent convergence. No consensus, no ordering agreement — just a fold keyed by the fingerprint.',
      docRef: `${GU} §1.2 · §6`,
      sets: { local1: { 'cross-view': 'node A ≡ node B (3 principals, one per fingerprint)' } },
    },
  ],
};
