// Zones — domain / zone / surface (GDL-039, GladeZones, implemented 2026-06-14).
// Two participants share one document domain. The commons zone (doc body)
// converges for both and is gated BY a grant. Each participant's private zone
// (their selection) stays their own — private by KEYING (self:<user>), no ACL,
// no capability. And each session's account-domain settings are visible in
// every document. Sharing is a grant; privacy is a key.
import type { Scenario } from './types';
import { pick } from './actors';

const ZN = 'GladeZones';
const AZ = 'GladeAuthzModel';

export const S_ZONES: Scenario = {
  id: 's-zones',
  stage: 2,
  title: 'Zones — commons by grant, private by key',
  summary:
    'alice owns a doc; bob is granted the commons join. The body converges for both, each one’s selection stays private with no grant involved, and each one’s account settings ride along into the document.',

  actors: pick('gryth1', 'guest1', 'local1'),

  initial: {
    gryth1: { session: 'local1 (open, alice)', domains: 'acct-alice + doc-1' },
    guest1: { device: 'cert chains to the GUEST (bob) root' },
    local1: {
      'session gryth1': 'open (alice)',
      'replica doc-1': 'doc.body (commons) + selections (private) — live',
      // alice owns the doc and her own account domain; bob owns his own account.
      'grant gryth1 doc-1': 'owner (all verbs)',
      // AZ-17 (ruled 2026-07-10): account domains serve their OWNER by
      // identity — no self-grant record exists; `account <share>` names the
      // owning session and INV-4 exempts exactly that receiver.
      'account acct-alice': 'gryth1',
      'account acct-bob': 'guest1',
      // alice, already in the doc, is subscribed to the commons body and her account settings.
      'sub doc-1/doc.body': 'gryth1',
      'sub acct-alice/app.settings': 'gryth1',
    },
  },

  phases: [
    { id: 'ZJ', label: 'Bob joins — sharing is a grant', summary: 'The owner grants the commons join; bob’s subscribe is gated BY that grant.' },
    { id: 'ZC', label: 'Commons converges for both', summary: 'The doc body is one world; every domain member folds the same ops.' },
    { id: 'ZP', label: 'Private zone — privacy is a key', summary: 'Each selection is keyed to a self; a foreign self never matches — no grant, no check.' },
    { id: 'ZA', label: 'Account domain in every doc', summary: 'A session joins several domains at once; its account settings read the same in every document.' },
  ],

  steps: [
    // ---- Phase ZJ: bob joins the commons ---------------------------------
    {
      state: 'J3', phase: 'ZJ', kind: 'message', from: 'gryth1', to: 'local1', frame: 'APPEND',
      label: 'owner grants the commons join',
      payload: { share: 'doc-1', detail: { op: 'CapabilityGrant{subject: bob-root, resource: (doc-1, commons), verbs: [read.subscribe]}', reading: '“share this document with bob” = “bob may join (doc-1, commons)” — that grant IS the whole sharing act' } },
      note: 'The read-grant resource canonically names (domain, commons). Commons is the only thing access-control gates.',
      docRef: `${ZN} · Privacy by construction vs sharing by grant · ${AZ} §4a`,
      sets: { gryth1: { 'origin log': '+CapabilityGrant(bob, doc-1 commons)' } },
    },
    {
      state: 'S1', phase: 'ZJ', kind: 'internal', from: 'local1', frame: 'APPEND',
      label: 'fold records the commons grant',
      payload: { share: 'doc-1', detail: { fold: 'grants(bob, (doc-1, commons)) → read.subscribe' } },
      note: 'The grant is data in the doc’s policy binding; the check that will gate bob’s join is a pure fold over it.',
      docRef: `${AZ} §4a`,
      sets: { local1: { 'grant guest1 doc-1': 'read.subscribe (commons join)' } },
    },
    {
      state: 'A1', phase: 'ZJ', kind: 'message', from: 'guest1', to: 'local1', frame: 'HELLO',
      label: 'bob’s session opens',
      payload: { detail: { session: 'sess-z07', principal: 'bob (GUEST root)', domains: 'joins acct-bob + doc-1' } },
      gate: { kind: 'security', label: 'HELLO principal seam', status: 'enforced', note: 'A different principal entirely — bob’s cert chains to his own user root. A session attaches to SEVERAL domains at once: always its account domain, plus each open document.' },
      note: 'Knowing who bob is grants nothing; his standing in this doc is exactly the grant records that name him.',
      docRef: `${ZN} · The model`,
      sets: { local1: { 'session guest1': 'open (bob root)' } },
    },
    {
      state: 'C1', phase: 'ZJ', kind: 'message', from: 'guest1', to: 'local1', frame: 'SUBSCRIBE',
      label: 'subscribe: doc body (commons)',
      payload: { share: 'doc-1', gladeId: 'doc.body', key: '"" (commons — empty key)', shape: 'log' },
      note: 'domain → share (doc-1), zone → key ("" = commons), surface → glade id (doc.body). A commons key is empty; everyone in the domain converges on it.',
      docRef: `${ZN} · Wire mapping`,
      sets: { guest1: { subs: 'doc-1/doc.body (commons)' } },
    },
    {
      state: 'S4', phase: 'ZJ', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'check(): ALLOW — commons join',
      payload: { share: 'doc-1', detail: { verdict: 'ALLOW', basis: 'read.subscribe ∈ grant(bob, (doc-1, commons))', note: 'this is the ONE gate zones has — a capability per (domain, commons)' } },
      gate: { kind: 'capability', label: 'commons-join capability check', status: 'enforced', note: 'grants gate commons-zone joins; encryption (if ever) protects private zones over untrusted hops; nothing in between. This is the exact granularity the security model operates at.' },
      note: 'The same pure check() every hop runs, here at the one place zones asks it: joining a commons.',
      docRef: `${AZ} §4a · ${ZN} · Where security acts`,
      sets: { local1: { 'sub doc-1/doc.body': 'gryth1, guest1' } },
    },

    // ---- Phase ZC: commons converges for both ----------------------------
    {
      state: 'A5', phase: 'ZC', kind: 'message', from: 'local1', to: 'guest1', frame: 'OPS',
      label: 'body to bob (commons)', response: true,
      payload: { share: 'doc-1', gladeId: 'doc.body', key: '""', shape: 'log', detail: { ops: 'doc.body history (origin-attributed)' } },
      note: 'bob folds the same body alice already sees. INV-4 holds: local1’s fold carries bob’s (doc-1, commons) grant.',
      sets: { guest1: { view: 'doc body (commons, live)' } },
    },
    {
      state: 'J3', phase: 'ZC', kind: 'message', from: 'gryth1', to: 'local1', frame: 'APPEND',
      label: 'alice edits the body',
      payload: { share: 'doc-1', gladeId: 'doc.body', key: '""', detail: { op: 'append line to doc.body (origin: alice)' } },
      note: 'A commons write from either participant is one op in the shared world.',
      sets: { local1: { 'fold doc-1/doc.body': '+1 op (alice)' } },
    },
    {
      state: 'B9', phase: 'ZC', kind: 'message', from: 'local1', to: 'guest1', frame: 'OPS',
      label: 'body fans out to bob', response: true,
      payload: { share: 'doc-1', gladeId: 'doc.body', key: '""', shape: 'log', detail: { ops: 'alice’s op' } },
      note: 'commons = everyone in the domain converges: alice originated it, bob receives it live, no re-request. The Google-Docs shape.',
      docRef: `${ZN} · The model`,
      sets: { guest1: { view: 'doc body +1 (converged with alice)' } },
    },

    // ---- Phase ZP: private zone — no grant, no check ---------------------
    {
      state: 'C1', phase: 'ZP', kind: 'message', from: 'gryth1', to: 'local1', frame: 'SUBSCRIBE',
      label: 'alice subscribes her selection (private)',
      payload: { share: 'doc-1', gladeId: 'doc.selection', key: 'self:alice (private)', shape: 'value' },
      note: 'Joining the doc auto-grants you your OWN private zone (self:me) — no collision, no leak, no setup.',
      docRef: `${ZN} · Privacy by construction · Zone keys`,
      sets: { gryth1: { subs: 'doc-1/doc.body + doc.selection{self:alice}' }, local1: { 'sub doc-1/doc.selection{self:alice}': 'gryth1' } },
    },
    {
      state: 'C1', phase: 'ZP', kind: 'message', from: 'guest1', to: 'local1', frame: 'SUBSCRIBE',
      label: 'bob subscribes his selection (private)',
      payload: { share: 'doc-1', gladeId: 'doc.selection', key: 'self:bob (private)', shape: 'value' },
      note: 'Same surface, same domain, different self. bob’s key includes bob; only bob’s sessions produce or subscribe to it.',
      docRef: `${ZN} · Zone keys`,
      sets: { guest1: { subs: 'doc-1/doc.body + doc.selection{self:bob}' }, local1: { 'sub doc-1/doc.selection{self:bob}': 'guest1' } },
    },
    {
      state: 'Z1', phase: 'ZP', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'keyed routing — privacy without a grant',
      payload: { share: 'doc-1', detail: { table: 'subscription table matches (share, glade id, key)', selfAlice: 'self:alice → {gryth1}', selfBob: 'self:bob → {guest1}', consequence: 'a foreign self NEVER matches — no capability is consulted, none exists', contrastS4: 'commons needed a grant (S4 above); private needs only the key' } },
      note: 'This is the whole private mechanism: private by KEYING, not permission. The D8 refinement makes each zone its own contiguous chain, so a private zone is filterable from what a peer receives without breaking chain verification.',
      docRef: `${ZN} · Wire mapping (chain axis) · ${AZ} §4a`,
      sets: { local1: { 'route doc.selection': 'per-self (self:alice≠self:bob)' } },
    },
    {
      state: 'J3', phase: 'ZP', kind: 'message', from: 'gryth1', to: 'local1', frame: 'APPEND',
      label: 'alice moves her cursor',
      payload: { share: 'doc-1', gladeId: 'doc.selection', key: 'self:alice', detail: { op: 'selection range → lines 4–6 (origin: alice, key self:alice)' } },
      note: 'A private write is keyed to self:alice; it enters only the self:alice chain.',
      sets: { local1: { 'fold doc-1/doc.selection{self:alice}': 'lines 4–6' } },
    },
    {
      state: 'A5', phase: 'ZP', kind: 'message', from: 'local1', to: 'gryth1', frame: 'OPS',
      label: 'selection to alice ONLY', response: true,
      payload: { share: 'doc-1', gladeId: 'doc.selection', key: 'self:alice', shape: 'value', detail: { deliveredTo: 'gryth1 (alice) only — bob’s self:bob interest never matched', noGrant: 'INV-4 is satisfied by alice’s doc membership; NO separate private-zone grant exists or was needed' } },
      note: 'bob is in the same commons body yet never receives alice’s selection — even inside a shared domain. No ACL was involved; the key did the work.',
      docRef: `${ZN} · Privacy by construction`,
      sets: { gryth1: { view: 'doc body + my selection (private)' } },
    },

    // ---- Phase ZA: account domain rides into the document ----------------
    {
      state: 'A5', phase: 'ZA', kind: 'message', from: 'local1', to: 'gryth1', frame: 'OPS',
      label: 'alice’s account settings', response: true,
      payload: { share: 'acct-alice', gladeId: 'app.settings', key: '"" (yours alone)', shape: 'value', detail: { domain: 'alice’s ACCOUNT domain — a different replicated world', reads: 'yours, in EVERY document' } },
      note: 'A session is attached to several domains at once: always its account domain, plus doc-1. app settings live in the account domain and read the same across every doc. “Universal vs document” is the DOMAIN choice, not the zone choice. The account domain serves its OWNER by identity — no grant record exists or is needed (AZ-17); a non-owner reading it WOULD need one.',
      docRef: `${ZN} · The model (the two axes)`,
      sets: { gryth1: { view: '… + app settings (from acct-alice)' } },
    },
    {
      state: 'C1', phase: 'ZA', kind: 'message', from: 'guest1', to: 'local1', frame: 'SUBSCRIBE',
      label: 'bob’s session reads his account',
      payload: { share: 'acct-bob', gladeId: 'app.settings', key: '"" (his alone)', shape: 'value' },
      note: 'bob’s session joined acct-bob at HELLO; his settings are a different domain from alice’s — the account domain is per principal.',
      docRef: `${ZN} · The model`,
      sets: { guest1: { subs: '… + acct-bob/app.settings' }, local1: { 'sub acct-bob/app.settings': 'guest1' } },
    },
    {
      state: 'A5', phase: 'ZA', kind: 'message', from: 'local1', to: 'guest1', frame: 'OPS',
      label: 'bob’s account settings', response: true,
      payload: { share: 'acct-bob', gladeId: 'app.settings', key: '""', shape: 'value' },
      note: 'Two people, one document, each with their own account settings AND their own private selection over one shared commons body — many domains, many people, a private layer over a shared commons.',
      docRef: `${ZN} · Privacy by construction vs sharing by grant`,
      sets: { guest1: { view: 'doc body + my selection + my app settings' } },
    },
  ],
};
