// s-chat — the glade-chat supplier (GLP-0006 P1.S1), stage 1.
//
// The HONEST stage-1 shape (GladeSupplierModel §2, the OP-APPEND mechanism):
// the supplier is a wire-attached authority session (P00-a) that DECLARES the
// chat surfaces as ordinary records (§3) and SERVES the chat.groups metadata
// value — and then it is OUT of the message hot path. Posting a line is a
// CLIENT append into the group's keyed commons log; the node folds + replicates
// it to every subscriber (the ws.tree leg). Attribution rides EACH line (the
// ChatLine principal field), never the connection.
//
// A group = one keyed commons surface: glade id `chat.msgs`, the group id as the
// key. Groups are PRE-DECLARED config in stage 1 (SupplierRequirements §glade-
// chat); dynamic creation is a create-a-share ceremony that rides F2 + P2.
import type { Scenario } from './types';
import { pick } from './actors';

const SM = 'GladeSupplierModel';
const SR = 'SupplierRequirements §glade-chat';
const ZN = 'GladeZones';
// The upgrade traces (GLP-0006 E-chat-1..5, glade-chat.md §3–§8) reference the
// chat spec + its sibling suppliers.
const CH = 'glade-chat';
const GS = 'glade-share';
const GU = 'glade-users';

export const S_CHAT: Scenario = {
  id: 's-chat',
  stage: 1,
  title: 'Chat — a supplier declares, clients post',
  summary:
    'The glade-chat supplier declares one keyed commons log per pre-declared group and serves the group list; alice and bob then post attributed lines into #general (client appends the node folds + replicates), #dev stays isolated by keying, and a late joiner folds the full history.',

  actors: pick('chat-sup', 'gryth1', 'guest1', 'gryth2', 'local1'),

  initial: {
    'chat-sup': { role: 'glade-chat supplier — authority-side, not in the message path' },
    local1: { 'grant chat-sup home': 'registrant chain (may declare chat surfaces)' },
  },

  phases: [
    { id: 'CD', label: 'Supplier declares + serves groups', summary: 'The supplier attaches over the wire, declares the chat surfaces as records, and serves the pre-declared group list — then steps out of the message path.' },
    { id: 'CG', label: 'A client reads the group list', summary: 'The group selector subscribes chat.groups; the supplier-served metadata is the only thing the supplier is asked for.' },
    { id: 'CP', label: 'Two principals post into #general', summary: 'Posting is a CLIENT append into the group’s keyed commons log; the node folds + replicates to both, attribution stamped per line.' },
    { id: 'CI', label: '#dev stays isolated', summary: 'A different group is a different key on the same surface; a #general subscriber never receives #dev — isolation by keying.' },
    { id: 'CL', label: 'Late joiner folds the history', summary: 'A late session joins #general and folds the entire log — the history IS the log, no supplier hop.' },
  ],

  steps: [
    // ---- Phase CD: the supplier declares surfaces + serves the group list ----
    {
      state: 'A1', phase: 'CD', kind: 'message', from: 'chat-sup', to: 'local1', frame: 'HELLO',
      label: 'supplier attaches (wire authority session)',
      payload: { detail: { session: 'sess-sup', principal: 'glade-chat (supplier)', posture: 'wire-attached authority session (P00-a) — depends on the wire + a client lib only, no node internals' } },
      gate: { kind: 'security', label: 'HELLO principal seam', status: 'stub-allow-all', note: 'Stage 1 is allow-all: the supplier attaches like any session. The capability slot at HELLO is where stage-2 enforcement lands with no supplier rewrite.' },
      note: 'A supplier is the authority-side counterpart of a tap (GDL-040): it stands behind the declared surfaces. It attaches as an ORDINARY session — being the supplier here is declaring surfaces + serving metadata, not a privileged plane.',
      docRef: `${SM} §1–2`,
      sets: { local1: { 'session chat-sup': 'open (supplier principal)' } },
    },
    {
      state: 'J3', phase: 'CD', kind: 'message', from: 'chat-sup', to: 'local1', frame: 'APPEND',
      label: 'declare the chat surfaces (as records)',
      payload: { share: 'chat', detail: { records: '2 BindingDecls — chat.msgs (log, keyed commons: group id = key) + chat.groups (value, the group list)', mode: 'ordinary runtime records under the registrant chain (§3) — the same records dynamic config writes', scope: 'stage-1: the group SET is pre-declared config; a group is a KEY on chat.msgs, not a new glade id' } },
      note: 'Registration = ordinary records (GDL-037): a supplier CONTRIBUTES declarations, never a side channel into the node. Declaring the surface is the whole opt-in to sharing.',
      docRef: `${SM} §3 · ${SR}`,
      sets: { local1: { records: '+2 BindingDecl (chat.msgs, chat.groups)' }, 'chat-sup': { declared: 'chat.msgs (log) · chat.groups (value)' } },
    },
    {
      state: 'P2', phase: 'CD', kind: 'internal', from: 'local1', frame: 'APPEND',
      label: 'register chat declarations (fold)',
      payload: { share: 'chat', detail: { fold: 'chat.msgs + chat.groups registered; chat.msgs routes per-group by KEY', authority: 'the fold is the only authority — a declaration is routable the moment its records replicate' } },
      note: 'The node folds the declarations into its registry; nothing about the file/registrant is privileged. chat.msgs is now a keyed commons surface — one shared log per group key.',
      docRef: `${SM} §3 · GDL-037`,
      sets: { local1: { 'route chat/chat.msgs': 'per-group key', 'binding chat/chat.groups': 'value' } },
    },
    {
      state: 'J3', phase: 'CD', kind: 'message', from: 'chat-sup', to: 'local1', frame: 'APPEND',
      label: 'serve the group list (op-append)',
      payload: { share: 'chat', gladeId: 'chat.groups', key: '"" (commons)', shape: 'value', detail: { value: 'chat.groups = [{id:general, label:General}, {id:dev, label:Dev}]', mechanism: 'serving a value/log surface IS appending ops (§2 op-append) — the supplier’s node holds the ServeClaim; this op folds + replicates to subscribers', outOfPath: 'this is the ONLY thing the supplier serves — messages never pass through it' } },
      note: 'The supplier MAY serve group metadata (the pre-declared list) — the value surface’s content is its op-appends. After this it is out of the hot path: posting is a client append, folded + replicated by the node.',
      docRef: `${SM} §2 (op-append) · ${SR}`,
      sets: { local1: { 'fold chat/chat.groups': '[#general, #dev]' }, 'chat-sup': { serving: 'chat.groups (value)' } },
    },

    // ---- Phase CG: a client reads the group list -----------------------------
    {
      state: 'A1', phase: 'CG', kind: 'message', from: 'gryth1', to: 'local1', frame: 'HELLO',
      label: 'alice’s session opens',
      payload: { detail: { session: 'sess-a01', principal: 'alice' } },
      gate: { kind: 'security', label: 'HELLO principal seam', status: 'stub-allow-all', note: 'A client session, same seam as the supplier’s — the principal is asserted (identity as data), nothing enforced in stage 1.' },
      note: 'The demo passes the participant as the principal (P0.S7 replaces the ?user= stub). Attribution flows from here onto every line alice posts.',
      docRef: `${SM} §4 (attribution)`,
      sets: { local1: { 'session gryth1': 'open (alice)' } },
    },
    {
      state: 'C1', phase: 'CG', kind: 'message', from: 'gryth1', to: 'local1', frame: 'SUBSCRIBE',
      label: 'subscribe: the group list',
      payload: { share: 'chat', gladeId: 'chat.groups', key: '"" (commons)', shape: 'value' },
      note: 'The group selector reads the supplier-served list. This is the client’s ONE interaction with the supplier’s surface — everything after is the commons log.',
      docRef: `${SM} §2`,
      sets: { gryth1: { subs: 'chat/chat.groups' }, local1: { 'sub chat/chat.groups': 'gryth1' } },
    },
    {
      state: 'A5', phase: 'CG', kind: 'message', from: 'local1', to: 'gryth1', frame: 'OPS', response: true,
      label: 'group list served',
      payload: { share: 'chat', gladeId: 'chat.groups', shape: 'value', detail: { value: '[#general, #dev]', origin: 'chat-sup (the supplier’s op)' } },
      note: 'alice’s UI renders the group selector from the supplier’s metadata value. The supplier appended it once; the node serves it from the replica — the supplier is not consulted per read.',
      docRef: `${SM} §2`,
      sets: { gryth1: { view: 'groups: #general, #dev' } },
    },

    // ---- Phase CP: two principals post into #general (client appends) ---------
    {
      state: 'C1', phase: 'CP', kind: 'message', from: 'gryth1', to: 'local1', frame: 'SUBSCRIBE',
      label: 'alice joins #general (keyed commons log)',
      payload: { share: 'chat', gladeId: 'chat.msgs', key: '{group:general} (commons)', shape: 'log' },
      note: 'A group = one keyed commons surface: same glade id (chat.msgs), the group id is the key. Joining #general subscribes exactly that key.',
      docRef: `${SR} · ${ZN} · keyed commons`,
      sets: { gryth1: { subs: 'chat/chat.groups + chat.msgs{general}' }, local1: { 'sub chat/chat.msgs{general}': 'gryth1' } },
    },
    {
      state: 'A1', phase: 'CP', kind: 'message', from: 'guest1', to: 'local1', frame: 'HELLO',
      label: 'bob’s session opens',
      payload: { detail: { session: 'sess-b07', principal: 'bob (a different principal)' } },
      gate: { kind: 'security', label: 'HELLO principal seam', status: 'stub-allow-all', note: 'A second, distinct principal. Knowing who bob is grants nothing in stage 1; it stamps his lines.' },
      note: 'Two principals will post into ONE group’s commons log — the multi-principal attribution case chat is the first consumer of.',
      docRef: `${SM} §4`,
      sets: { local1: { 'session guest1': 'open (bob)' } },
    },
    {
      state: 'C1', phase: 'CP', kind: 'message', from: 'guest1', to: 'local1', frame: 'SUBSCRIBE',
      label: 'bob joins #general (same key)',
      payload: { share: 'chat', gladeId: 'chat.msgs', key: '{group:general} (commons)', shape: 'log' },
      note: 'Same surface, same key: bob and alice converge on the one #general log. A commons key is shared by everyone in the group.',
      docRef: `${ZN} · keyed commons`,
      sets: { guest1: { subs: 'chat/chat.msgs{general}' }, local1: { 'sub chat/chat.msgs{general}': 'gryth1, guest1' } },
    },
    {
      state: 'J3', phase: 'CP', kind: 'message', from: 'gryth1', to: 'local1', frame: 'APPEND',
      label: 'alice posts to #general (client append)',
      payload: { share: 'chat', gladeId: 'chat.msgs', key: '{group:general}', detail: { op: 'ChatLine{ts, user: alice, principal: alice, text: "hi #general"} (origin: alice)', path: 'CLIENT append — the supplier is NOT involved; the node folds + replicates', attribution: 'the principal field carries the author ON the line' } },
      note: 'Stage-1 chat is client appends + node fold/replicate (the supplier is out of the hot path). The new ChatLine.principal field is the attribution seam — additive beside `user`, never a reinterpretation.',
      docRef: `${SM} §2 · §4`,
      sets: { local1: { 'fold chat/chat.msgs{general}': '+1 (alice: hi #general)' } },
    },
    {
      state: 'B9', phase: 'CP', kind: 'message', from: 'local1', to: 'guest1', frame: 'OPS', response: true,
      label: 'alice’s line fans out to bob',
      payload: { share: 'chat', gladeId: 'chat.msgs', key: '{group:general}', shape: 'log', detail: { line: 'ChatLine attributed to alice (principal: alice)' } },
      note: 'commons = everyone in the group converges: alice originated it, bob folds it live, attribution intact — no re-request, no supplier hop.',
      docRef: `${ZN} · The model`,
      sets: { guest1: { view: '#general: alice: hi #general' } },
    },
    {
      state: 'J3', phase: 'CP', kind: 'message', from: 'guest1', to: 'local1', frame: 'APPEND',
      label: 'bob replies in #general (client append)',
      payload: { share: 'chat', gladeId: 'chat.msgs', key: '{group:general}', detail: { op: 'ChatLine{ts, user: bob, principal: bob, text: "hey alice"} (origin: bob)' } },
      note: 'The second principal posts into the same commons log. Two authors, one group, one shared log — each line self-attributes.',
      docRef: `${SM} §4`,
      sets: { local1: { 'fold chat/chat.msgs{general}': '+1 (bob: hey alice)' } },
    },
    {
      state: 'B9', phase: 'CP', kind: 'message', from: 'local1', to: 'gryth1', frame: 'OPS', response: true,
      label: 'bob’s line fans out to alice',
      payload: { share: 'chat', gladeId: 'chat.msgs', key: '{group:general}', shape: 'log', detail: { line: 'ChatLine attributed to bob (principal: bob)' } },
      note: 'alice folds bob’s line. Attribution is PER LINE (the principal field), never per connection — the two-principal commons reads correctly for both.',
      docRef: `${SM} §4`,
      sets: { gryth1: { view: '#general: alice: hi #general | bob: hey alice' } },
    },

    // ---- Phase CI: #dev stays isolated (keying, not permission) ---------------
    {
      state: 'C1', phase: 'CI', kind: 'message', from: 'guest1', to: 'local1', frame: 'SUBSCRIBE',
      label: 'bob also joins #dev (different key)',
      payload: { share: 'chat', gladeId: 'chat.msgs', key: '{group:dev} (commons)', shape: 'log' },
      note: 'A second group is a DIFFERENT key on the SAME surface. bob is now in both; alice is only in #general.',
      docRef: `${SR} · ${ZN} · keyed commons`,
      sets: { guest1: { subs: 'chat/chat.msgs{general} + chat.msgs{dev}' }, local1: { 'sub chat/chat.msgs{dev}': 'guest1' } },
    },
    {
      state: 'J3', phase: 'CI', kind: 'message', from: 'guest1', to: 'local1', frame: 'APPEND',
      label: 'bob posts to #dev',
      payload: { share: 'chat', gladeId: 'chat.msgs', key: '{group:dev}', detail: { op: 'ChatLine{ts, user: bob, principal: bob, text: "deploy at 5"} (origin: bob)' } },
      note: 'A line keyed to #dev enters only the {group:dev} log — a different shared world from #general on the same glade id.',
      sets: { local1: { 'fold chat/chat.msgs{dev}': '+1 (bob: deploy at 5)' } },
    },
    {
      state: 'Z2', phase: 'CI', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'keyed isolation — #dev never reaches #general',
      payload: { share: 'chat', detail: { table: 'subscription table matches (share, glade id, key)', dev: '{group:dev} → {guest1}', general: '{group:general} → {gryth1, guest1}', consequence: 'alice’s #general interest NEVER matches the #dev op — no capability consulted, none exists in stage 1', contrastZ1: 'same keyed-routing mechanism as private zones (Z1), but a shared commons per key' } },
      note: 'This is the whole isolation mechanism: subscribing #general never delivers #dev. Group isolation is KEYING. Stage 2 will additionally gate each group join with a membership grant (AZ-16) — routing stays the same.',
      docRef: `${ZN} · Wire mapping · ${SM} §4`,
      sets: { local1: { 'route chat.msgs': 'per-group (dev ≠ general)' } },
    },
    {
      state: 'B9', phase: 'CI', kind: 'message', from: 'local1', to: 'guest1', frame: 'OPS', response: true,
      label: '#dev line to bob ONLY',
      payload: { share: 'chat', gladeId: 'chat.msgs', key: '{group:dev}', shape: 'log', detail: { deliveredTo: 'guest1 only — gryth1’s {group:general} interest never matched', line: 'ChatLine attributed to bob' } },
      note: 'bob receives his own #dev line; alice — in the same chat share, on the same glade id, at the same node — never sees it. The key did the work, no ACL involved.',
      docRef: `${ZN} · Privacy/isolation by construction`,
      sets: { guest1: { view: '#general: alice: hi #general | bob: hey alice · #dev: bob: deploy at 5' } },
    },

    // ---- Phase CL: a late joiner folds the whole #general history -------------
    {
      state: 'A1', phase: 'CL', kind: 'message', from: 'gryth2', to: 'local1', frame: 'HELLO',
      label: 'carol’s session opens (late)',
      payload: { detail: { session: 'sess-c11', principal: 'carol' } },
      gate: { kind: 'security', label: 'HELLO principal seam', status: 'stub-allow-all', note: 'A third principal arriving after the conversation — the late-join case.' },
      note: 'carol joins after alice and bob have already talked; the substrate owes her the full history.',
      docRef: `${SM} §4`,
      sets: { local1: { 'session gryth2': 'open (carol)' } },
    },
    {
      state: 'C1', phase: 'CL', kind: 'message', from: 'gryth2', to: 'local1', frame: 'SUBSCRIBE',
      label: 'carol joins #general (late)',
      payload: { share: 'chat', gladeId: 'chat.msgs', key: '{group:general} (commons)', shape: 'log' },
      note: 'Same key as alice and bob — carol attaches to the existing #general replica.',
      docRef: `${SR}`,
      sets: { gryth2: { subs: 'chat/chat.msgs{general}' }, local1: { 'sub chat/chat.msgs{general}': 'gryth1, guest1, gryth2' } },
    },
    {
      state: 'A4', phase: 'CL', kind: 'internal', from: 'local1', frame: 'FOLD',
      label: 'fold #general history for the late joiner',
      payload: { share: 'chat', gladeId: 'chat.msgs', key: '{group:general}', detail: { serve: 'cached fold + tail: (alice: hi #general | bob: hey alice)', storage: 'the history IS the log — no store beyond the share (SupplierRequirements: none beyond the share itself)' } },
      note: 'Late-join hydration is the ordinary log replay: the node serves the full backlog from its replica. No supplier involvement — the log carries its own history.',
      docRef: `${SM} §5 (app data seam) · ${SR}`,
      sets: { local1: { 'replica chat/chat.msgs{general}': 'full history cached' } },
    },
    {
      state: 'A5', phase: 'CL', kind: 'message', from: 'local1', to: 'gryth2', frame: 'OPS', response: true,
      label: 'full #general history to carol',
      payload: { share: 'chat', gladeId: 'chat.msgs', key: '{group:general}', shape: 'log', detail: { ops: 'both prior lines, each origin-attributed (alice, bob)', attribution: 'the principal field survives replay — carol sees WHO said what' } },
      note: 'carol folds the entire group history with attribution intact — the log is the catch-up. INV-2 holds: local1’s subscription table names carol for {group:general}.',
      docRef: `${SM} §5`,
      sets: { gryth2: { view: '#general: alice: hi #general | bob: hey alice' } },
    },
  ],
};

// ===========================================================================
// The stage-2 upgrade traces (GLP-0006 — E-chat-1..5 RATIFIED). Stage-1's
// pre-declared keyed-commons config is the stopgap; a REAL group is created,
// declared, quota-bounded, edited, and unified on one codec, reusing the
// ceremonies glade-share + glade-users already own. Each trace proves EXACTLY
// its ruling — and its deny arm where the ruling has one.
// ===========================================================================

// ---------------------------------------------------------------------------
// s-chat-create (E-chat-1 §3.1) — a group is created via the glade-share
// share.create ceremony as its OWN share (not a key in one chat share); it
// appears + is routable the moment its records fold. Keyed-commons is retired
// to the stage-1 migration source. Stage 2: the owner is the B3 principal, and
// the created group is a per-share AZ-16 membership surface.
// ---------------------------------------------------------------------------
export const S_CHAT_CREATE: Scenario = {
  id: 's-chat-create',
  stage: 2,
  title: 'Chat — create a group as its own share (share.create)',
  summary:
    'alice (an authenticated B3 principal) creates #standup via the glade-share share.create ceremony — the group owns its OWN share (E-chat-1), declared by a typed HOME dir.bindings record, not a key in one chat share. It becomes routable the moment its create records fold; bob is admitted by an AZ-16 membership grant on the group share and posts.',

  actors: pick('chat-sup', 'gryth1', 'guest1', 'local1'),

  initial: {
    'chat-sup': { role: 'glade-chat + share-family authority (E-share-1) — validates share.create against the target policy' },
    local1: { 'session chat-sup': 'open (share authority)', 'binding chat/chat.groups': 'value (seed list — a seed, not a ceiling)' },
  },

  phases: [
    { id: 'GC', label: 'Create = the share.create ceremony', summary: 'An authenticated principal asks; the exchange routes to the share authority, which admits the verb and stamps the B3 principal as owner (a caller owner field is ignored).' },
    { id: 'GD', label: 'A group owns its OWN share', summary: 'The ceremony mints the group share (commons + policy binding) and declares it as a typed HOME dir.bindings record — not a key in one chat share, not a boot-time config replay.' },
    { id: 'GF', label: 'Routable the moment it folds', summary: 'The node registers the group binding from the fold — the fold is the only authority — and serves the owner its new (empty) commons.' },
    { id: 'GJ', label: 'A member joins the group share', summary: 'The owner admits bob with an AZ-16 membership grant on the group share; bob posts a client-appended line the owner folds.' },
  ],

  steps: [
    // ---- Phase GC: the share.create ceremony -----------------------------
    {
      state: 'A1', phase: 'GC', kind: 'message', from: 'gryth1', to: 'local1', frame: 'HELLO',
      label: 'alice’s authenticated session opens',
      payload: { detail: { session: 'sess-a01', principal: 'alice — fp:a1b2 (device-certified, B3)' } },
      gate: { kind: 'security', label: 'HELLO principal seam', status: 'enforced', note: 'Stage 2: the principal is the B3 node-authenticated identity (the device-certified fingerprint) — the identity substrate is a stage-1 prerequisite (RulingWorksheet §B), and creation is bounded to authenticated principals.' },
      note: 'Any AUTHENTICATED principal MAY create a group and becomes its owner (E-chat-4 §3.3) — the B3 principal, never a caller-supplied owner field.',
      docRef: `${CH} §3.3 (E-chat-4) · ${GU} §1.1`,
      sets: { local1: { 'session gryth1': 'open (alice, fp:a1b2)', 'principal alice': 'fp:a1b2 · device-certified (B3)' } },
    },
    {
      state: 'D1', phase: 'GC', kind: 'message', from: 'gryth1', to: 'local1', frame: 'EXCHANGE',
      label: 'share.create — mint the group’s share',
      payload: { share: 'chat', gladeId: 'share.create', shape: 'exchange', verb: 'share.create', correlationId: 'grp-create-1', detail: { name: '#standup → share grp-standup', ownerField: 'IGNORED — ownership is the B3 principal, never a caller field (E-chat-4 §3.3)' } },
      note: 'Creating a group is EXACTLY the glade-share share.create ceremony (E-chat-1 §3.1) — the share family owns share.create/invite/grant/revoke/status. NOT a bespoke chat verb; NOT a key in one chat share.',
      docRef: `${CH} §3.1 (E-chat-1) · ${GS} §1`,
      sets: { local1: { 'pending grp-create-1': 'gryth1 → share.create(#standup)' } },
    },
    {
      state: 'C2', phase: 'GC', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'route the ceremony to the share authority',
      payload: { detail: { question: 'who provides share.create?', answer: 'chat-sup (the share-family authority — embedding is a composition optimization, SM §2)' } },
      gate: { kind: 'routing', label: 'provider lookup', status: 'designed', note: 'The keyed provider entry map IS the routing table (SM §2.2): one authority per (share, glade id). The directed exchange path any exchange takes.' },
      note: 'The share.create exchange routes to the attached share authority — the same directed path as any exchange.',
      docRef: `${GS} §1 · ${SM} §2.2`,
      sets: { local1: { 'route share.create': 'chat-sup' } },
    },
    {
      state: 'D2', phase: 'GC', kind: 'message', from: 'local1', to: 'chat-sup', frame: 'EXCHANGE',
      label: 'forward share.create (B3 context rides along)',
      payload: { gladeId: 'share.create', shape: 'exchange', verb: 'share.create', correlationId: 'grp-create-1' },
      note: 'Routed to the authority; correlation preserved 1:1. The B3 requester context rides the exchange — the authority evaluates ownership against it, not a payload field.',
      docRef: `${GS} §3 (B3 requester context) · ${SM} §2.3`,
      sets: { 'chat-sup': { 'pending grp-create-1': 'local1', 'requester grp-create-1': 'alice@fp:a1b2 via gryth1' } },
    },
    {
      state: 'S6', phase: 'GC', kind: 'internal', from: 'chat-sup', frame: 'ROUTE',
      label: 'verb check: admit; owner = the B3 principal',
      payload: { detail: { check: 'share.create — any authenticated principal admitted (E-chat-4 §3.3)', owner: 'alice@fp:a1b2 (the B3 principal)', ignored: 'a caller-supplied owner field would be dropped here', verdict: 'ADMIT' } },
      gate: { kind: 'capability', label: 'share.create verb check', status: 'enforced', note: 'The authority evaluates check() for the exchange verb against the B3 context. E-chat-4: self-serve create; ownership is the authenticated principal, so a forged owner field cannot re-point the new share.' },
      note: 'The admission is authorization on the CREATE verb; the owner it records is the B3 principal — the grant-gated alternative (only a domain owner may create) was not taken (§3.3).',
      docRef: `${CH} §3.3 (E-chat-4)`,
      sets: { 'chat-sup': { 'verb share.create': 'admitted (owner = alice@fp:a1b2)' } },
    },

    // ---- Phase GD: a group owns its OWN share ----------------------------
    {
      state: 'D3', phase: 'GD', kind: 'internal', from: 'chat-sup', frame: 'PROVIDE',
      label: 'mint the group’s own share (commons + policy binding)',
      payload: { share: 'grp-standup', detail: { mint: 'share grp-standup — its OWN share (E-chat-1), NOT a key in the chat share', commons: 'grp-standup/chat.msgs (log, commons)', policy: 'grp-standup policy binding seeded — the ACL seed compiles to grant records at registration (GDL-037)' } },
      note: 'The ceremony mints the group share + seeds its ACL. Keyed-commons is RETIRED to stage-1: a single grant on one chat share would admit ALL groups (§3.1), so a real group is per-share and membership is the group-share’s own AZ-16 grant.',
      docRef: `${CH} §3.1 (E-chat-1)`,
      sets: { 'chat-sup': { 'share grp-standup': 'minted (owner alice@fp:a1b2)' } },
    },
    {
      state: 'S1', phase: 'GD', kind: 'internal', from: 'chat-sup', frame: 'APPEND',
      label: 'seed the owner’s membership grant',
      payload: { share: 'grp-standup', detail: { grant: 'owner membership grant for alice@fp:a1b2 — commons + her private zone in the group domain (one AZ-16 unit)', account: 'the account entry names the OWNING session — self-lockout is unrepresentable, so the owner needs no separate grant record to be served (AZ-17)' } },
      note: 'Joining/owning is an AZ-16 membership grant on the GROUP’s share (§3.2), not a chat-share grant. The owner is served owner-exempt; every OTHER member needs their own grant.',
      docRef: `${CH} §3.2 · GladeAuthzModel §7a (AZ-16/AZ-17)`,
      sets: { local1: { 'account grp-standup': 'gryth1', 'grant gryth1 grp-standup': 'owner (read.subscribe.post)' }, 'chat-sup': { 'serving grp-standup': 'policy binding' } },
    },
    {
      state: 'K1', phase: 'GD', kind: 'internal', from: 'local1', frame: 'APPEND',
      label: 'declare the group — typed HOME dir.bindings record',
      payload: { share: 'home', gladeId: 'dir.bindings', detail: { record: 'BindingDecl{share: grp-standup, glade id: chat.msgs, shape: log, zone: commons} — typed, authz-checked (E-chat-2 §3.4)', contrast: 'the stage-1 chat.decl JSON app-share append is NON-AUTHORITATIVE — the node never consumes it (§1 fact 3, retracted)' } },
      note: 'The authoritative declaration is a typed HOME dir.bindings record — the real registry path the node consumes (E-chat-2). The declare-a-surface step is a record write, not a boot-time config replay. (s-chat-decl-realnode proves this on a spawned node.)',
      docRef: `${CH} §3.4 (E-chat-2)`,
      sets: { local1: { 'binding grp-standup/chat.msgs': 'log (commons) — via dir.bindings (authoritative)' } },
    },
    {
      state: 'D4', phase: 'GD', kind: 'message', from: 'chat-sup', to: 'local1', frame: 'EXCHANGE-RESP',
      label: 'share created (ok)', response: true,
      payload: { correlationId: 'grp-create-1', detail: { ok: 'true', share: 'grp-standup', owner: 'alice@fp:a1b2' } },
      note: 'The ceremony completes: the group’s own share exists with alice as owner. Directed response, corr 1:1.',
      docRef: `${SM} §2.3`,
      sets: { 'chat-sup': { 'pending grp-create-1': null } },
    },
    {
      state: 'D5', phase: 'GD', kind: 'message', from: 'local1', to: 'gryth1', frame: 'EXCHANGE-RESP',
      label: 'group ready — response to alice', response: true,
      payload: { correlationId: 'grp-create-1' },
      note: '#standup is created — its own share, alice’s to run.',
      sets: { gryth1: { view: 'group #standup created (owner: me)' }, local1: { 'pending grp-create-1': null } },
    },

    // ---- Phase GF: routable the moment it folds --------------------------
    {
      state: 'P2', phase: 'GF', kind: 'internal', from: 'local1', frame: 'APPEND',
      label: 'register the group binding (the fold is the only authority)',
      payload: { detail: { fold: 'grp-standup/chat.msgs registered from the dir.bindings record', authority: 'a group is routable the moment its create records replicate — the pre-declared list becomes the initial seed, not a fixed ceiling (E-chat-1)', appears: '#standup now folds into chat.groups' } },
      note: 'Registration is ordinary records (GDL-037); routing comes from the fold, nothing about the ceremony is privileged. #standup routes on its OWN share.',
      docRef: `${CH} §3.1 · GDL-037`,
      sets: { local1: { 'route grp-standup/chat.msgs': 'commons (own share)' } },
    },
    {
      state: 'C1', phase: 'GF', kind: 'message', from: 'gryth1', to: 'local1', frame: 'SUBSCRIBE',
      label: 'alice subscribes her new group’s commons',
      payload: { share: 'grp-standup', gladeId: 'chat.msgs', key: '{commons}', shape: 'log' },
      note: 'The commons of the group’s own share — not a key inside chat. The owner joins her created group.',
      docRef: `${CH} §3.1 · §3.2`,
      sets: { gryth1: { subs: 'grp-standup/chat.msgs{commons}' }, local1: { 'sub grp-standup/chat.msgs{commons}': 'gryth1' } },
    },
    {
      state: 'A5', phase: 'GF', kind: 'message', from: 'local1', to: 'gryth1', frame: 'OPS', response: true,
      label: 'the new group’s commons serves (empty, live)',
      payload: { share: 'grp-standup', gladeId: 'chat.msgs', key: '{commons}', shape: 'log', detail: { ops: 'empty log (new group) — routable + serving from the fold', ownerExempt: 'served owner-exempt (account grp-standup = alice); no separate grant needed' } },
      note: 'The created group is immediately routable on its own share; group === share via share.create, proven end to end.',
      docRef: `${CH} §3.1 (E-chat-1)`,
      sets: { gryth1: { view: '#standup: (empty) — live' } },
    },

    // ---- Phase GJ: a member joins the group share ------------------------
    {
      state: 'A1', phase: 'GJ', kind: 'message', from: 'guest1', to: 'local1', frame: 'HELLO',
      label: 'bob’s authenticated session opens',
      payload: { detail: { session: 'sess-b07', principal: 'bob — fp:b7c9 (device-certified, B3)' } },
      gate: { kind: 'security', label: 'HELLO principal seam', status: 'enforced', note: 'A second, distinct B3 principal (fp:b7c9 ≠ fp:a1b2). Being authenticated grants nothing on grp-standup — membership is a separate grant.' },
      note: 'bob is a distinct principal; his access to #standup arrives as a membership grant, never as node-level trust.',
      docRef: `${GU} §1.1`,
      sets: { local1: { 'session guest1': 'open (bob, fp:b7c9)', 'principal bob': 'fp:b7c9 · device-certified (B3)' } },
    },
    {
      state: 'S1', phase: 'GJ', kind: 'internal', from: 'chat-sup', frame: 'APPEND',
      label: 'owner admits bob — share.grant mints the membership grant',
      payload: { share: 'grp-standup', detail: { grant: 'membership grant for bob@fp:b7c9 — commons + bob’s private zone (the AZ-16 unit), authority-appended (H-R3)', gate: 'stage-2 gates the join: this grant is what the built stub-allow-all commons subscribe now checks' } },
      note: 'The owner’s share.grant admits bob (E-share-1). One membership grant carries the commons AND bob’s own private zone in the group domain; revoke would cut both in one act (§3.2).',
      docRef: `${CH} §3.2 · ${GS} §1 (share.grant)`,
      sets: { local1: { 'grant guest1 grp-standup': 'read.subscribe.post (member)' } },
    },
    {
      state: 'C1', phase: 'GJ', kind: 'message', from: 'guest1', to: 'local1', frame: 'SUBSCRIBE',
      label: 'bob joins #standup (the group’s commons)',
      payload: { share: 'grp-standup', gladeId: 'chat.msgs', key: '{commons}', shape: 'log' },
      note: 'bob subscribes the group-share commons; his membership grant admits the join. Routing (Z2) is unchanged from stage-1 — now GATED at the join.',
      docRef: `${CH} §3.2`,
      sets: { guest1: { subs: 'grp-standup/chat.msgs{commons}' }, local1: { 'sub grp-standup/chat.msgs{commons}': 'gryth1, guest1' } },
    },
    {
      state: 'J3', phase: 'GJ', kind: 'message', from: 'guest1', to: 'local1', frame: 'APPEND',
      label: 'bob posts to #standup (client append)',
      payload: { share: 'grp-standup', gladeId: 'chat.msgs', key: '{commons}', detail: { op: 'ChatLine{ts, user: bob, principal: fp:b7c9, text: "standup at 10"} — the principal is the B3 fingerprint, not a caller payload (§1 fact 2)', path: 'CLIENT append — the supplier is out of the hot path even on a created group' } },
      note: 'Posting is a client append the node folds + replicates — the created group behaves exactly like the built keyed-commons one, now per-share.',
      docRef: `${CH} §1 fact 2/3 · ${SM} §2`,
      sets: { local1: { 'fold grp-standup/chat.msgs{commons}': '+1 (bob: standup at 10)' } },
    },
    {
      state: 'B9', phase: 'GJ', kind: 'message', from: 'local1', to: 'gryth1', frame: 'OPS', response: true,
      label: 'bob’s line fans out to the owner',
      payload: { share: 'grp-standup', gladeId: 'chat.msgs', key: '{commons}', shape: 'log', detail: { line: 'ChatLine attributed to bob (fp:b7c9)', ownerExempt: 'served to alice owner-exempt (account grp-standup)' } },
      note: 'Owner + member converge in the new group’s OWN commons share — a real group, created as data, routable + gated per-share.',
      docRef: `${ZN} · The model`,
      sets: { gryth1: { view: '#standup: bob: standup at 10' } },
    },
  ],
};

// ---------------------------------------------------------------------------
// s-chat-quota (E-chat-4 §4) — ChatQuotaSettingsV1 max=50. Creation #50 is
// admitted; #51 returns typed QuotaExceeded{limit:50} with NO partial record;
// two concurrent creates at the boundary admit exactly one; a forged owner
// field does not affect the count (the count is over B3-attributed ownership).
// All exchanges + internal decisions — no serve of a group share to a client,
// so INV-4 stays inert; over-limit is DATA, never an exception.
// ---------------------------------------------------------------------------
export const S_CHAT_QUOTA: Scenario = {
  id: 's-chat-quota',
  stage: 2,
  title: 'Chat — group-creation quota (ChatQuotaSettingsV1)',
  summary:
    'The group-creation admission service atomically admits-and-creates on the count of LIVE groups owned by the B3 principal, bounded by the immutable ChatQuotaSettingsV1 (max=50). alice’s #50 is admitted; #51 returns typed QuotaExceeded{limit:50} with no partial share/binding/invite record; two concurrent creates at bob’s 49→50 boundary admit exactly one; a forged owner field cannot inflate or dodge the count.',

  actors: pick('chat-sup', 'gryth1', 'guest1', 'gryth2', 'local1'),

  initial: {
    'chat-sup': {
      role: 'group-creation admission authority (E-chat-4 §4)',
      'policy ChatQuotaSettingsV1': 'max_owned_groups_per_principal = 50 — IMMUTABLE, versioned, composition-pinned (peers MUST NOT edit/override)',
    },
    local1: {
      'session chat-sup': 'open (authority)',
      'session gryth1': 'open (alice, fp:a1b2)',
      'session guest1': 'open (bob, fp:b7c9)',
      'principal alice': 'fp:a1b2 · device-certified (B3)',
      'principal bob': 'fp:b7c9 · device-certified (B3)',
      'quota alice': 'used 49 / 50 groups',
      'quota bob': 'used 49 / 50 groups',
    },
  },

  phases: [
    { id: 'QA', label: '#50 admitted — atomic admit-and-create', summary: 'alice at 49 creates her 50th group; the admission service admits (49 < 50) and commits the create as one atomic step.' },
    { id: 'QD', label: '#51 denied — typed QuotaExceeded', summary: 'At the limit (50) the 51st create returns QuotaExceeded{limit:50} with NO share/binding/invite/partial record — over-limit is data.' },
    { id: 'QC', label: 'Concurrent boundary — exactly one', summary: 'bob at 49 fires two concurrent creates; atomic admit-and-create serializes them, so exactly one is admitted and the other gets QuotaExceeded.' },
    { id: 'QF', label: 'Forged owner does not count', summary: 'A forged group record carrying a self-declared owner field changes nothing — the count is over B3-authority-attributed live ownership.' },
  ],

  steps: [
    // ---- Phase QA: #50 admitted ------------------------------------------
    {
      state: 'D1', phase: 'QA', kind: 'message', from: 'gryth1', to: 'local1', frame: 'EXCHANGE',
      label: 'alice creates her 50th group',
      payload: { share: 'chat', gladeId: 'share.create', shape: 'exchange', verb: 'share.create', correlationId: 'q50', detail: { name: 'grp-50', ownedSoFar: '49 live groups', ownerField: 'none — ownership is the B3 principal (E-chat-4 §3.3)' } },
      note: 'Any-principal create (§3.3) is bounded by ONE immutable policy record (§4) — not a general quota subsystem; v1 needs no quota-management UI.',
      docRef: `${CH} §4 (E-chat-4)`,
      sets: { local1: { 'pending q50': 'gryth1 → share.create(grp-50)' } },
    },
    {
      state: 'D2', phase: 'QA', kind: 'message', from: 'local1', to: 'chat-sup', frame: 'EXCHANGE',
      label: 'forward to the admission authority',
      payload: { gladeId: 'share.create', shape: 'exchange', verb: 'share.create', correlationId: 'q50' },
      note: 'Routed to the authoritative group-creation service; the B3 requester context rides along — the count is over B3 ownership.',
      docRef: `${GS} §3 · ${SM} §2.3`,
      sets: { 'chat-sup': { 'pending q50': 'local1', 'requester q50': 'alice@fp:a1b2 via gryth1' } },
    },
    {
      state: 'S6', phase: 'QA', kind: 'internal', from: 'chat-sup', frame: 'ROUTE',
      label: 'admission check: count LIVE groups owned by the B3 principal',
      payload: { detail: { count: 'LIVE groups owned by alice@fp:a1b2 = 49', limit: '50 (ChatQuotaSettingsV1)', decision: 'ADMIT #50 (49 < 50)', atomic: 'admit-and-create is ATOMIC on the live-owned count (§4)' } },
      gate: { kind: 'capability', label: 'quota admission', status: 'enforced', note: 'The admission service atomically admits-and-creates on the count of LIVE groups owned by the B3 principal. Atomicity is what keeps the boundary un-double-spendable (see QC).' },
      note: 'Creation #50 is admitted: 49 < 50. The count is LIVE groups owned by the authenticated principal — a tombstoned group frees quota only once its terminal state is authoritative (§3.5).',
      docRef: `${CH} §4`,
      sets: { 'chat-sup': { 'admit q50': '#50 admitted (alice 49→50)' } },
    },
    {
      state: 'D3', phase: 'QA', kind: 'internal', from: 'chat-sup', frame: 'PROVIDE',
      label: 'atomic create leg — mint grp-50',
      payload: { share: 'grp-50', detail: { mint: 'share grp-50 + dir.bindings decl + owner membership grant — committed TOGETHER', count: 'alice live-owned: 49 → 50' } },
      note: 'The create leg mints share + binding + owner grant as one atomic commit; the count moves 49→50 exactly when the records commit.',
      docRef: `${CH} §4 · §3.1`,
      sets: { 'chat-sup': { 'share grp-50': 'minted (owner alice)' }, local1: { 'quota alice': 'used 50 / 50 groups' } },
    },
    {
      state: 'D4', phase: 'QA', kind: 'message', from: 'chat-sup', to: 'local1', frame: 'EXCHANGE-RESP',
      label: '#50 created (ok)', response: true,
      payload: { correlationId: 'q50', detail: { ok: 'true', share: 'grp-50', owned: '50 / 50' } },
      note: 'The 50th group exists; alice is now exactly at the limit.',
      docRef: `${SM} §2.3`,
      sets: { 'chat-sup': { 'pending q50': null } },
    },
    {
      state: 'D5', phase: 'QA', kind: 'message', from: 'local1', to: 'gryth1', frame: 'EXCHANGE-RESP',
      label: 'response to alice', response: true,
      payload: { correlationId: 'q50' },
      note: 'alice’s UI shows #50 created and her budget full (50 / 50).',
      sets: { gryth1: { view: 'group #50 created (50 / 50 owned)' }, local1: { 'pending q50': null } },
    },

    // ---- Phase QD: #51 denied --------------------------------------------
    {
      state: 'D1', phase: 'QD', kind: 'message', from: 'gryth1', to: 'local1', frame: 'EXCHANGE',
      label: 'alice attempts the 51st group',
      payload: { share: 'chat', gladeId: 'share.create', shape: 'exchange', verb: 'share.create', correlationId: 'q51', detail: { name: 'grp-51', ownedSoFar: '50 live groups (at the limit)' } },
      note: 'The same ceremony, now over the limit — the denial must be typed data, not a crash.',
      docRef: `${CH} §4`,
      sets: { local1: { 'pending q51': 'gryth1 → share.create(grp-51)' } },
    },
    {
      state: 'D2', phase: 'QD', kind: 'message', from: 'local1', to: 'chat-sup', frame: 'EXCHANGE',
      label: 'forward the 51st',
      payload: { gladeId: 'share.create', shape: 'exchange', verb: 'share.create', correlationId: 'q51' },
      note: 'Routed to the admission authority with alice’s B3 context.',
      sets: { 'chat-sup': { 'pending q51': 'local1', 'requester q51': 'alice@fp:a1b2 via gryth1' } },
    },
    {
      state: 'S6', phase: 'QD', kind: 'internal', from: 'chat-sup', frame: 'ROUTE',
      label: 'admission check: DENY (50 not < 50)',
      payload: { detail: { count: 'LIVE groups owned by alice@fp:a1b2 = 50', limit: '50', decision: 'DENY — QuotaExceeded{limit: 50}', effect: 'mint NOTHING: no share, no binding, no invite, no partial group record (§4)' } },
      gate: { kind: 'capability', label: 'quota admission', status: 'enforced', note: 'Creation #51 returns typed QuotaExceeded{limit:50}. Because admit-and-create is atomic, a denial creates NO partial state — the fold is untouched.' },
      note: 'Over-limit is DATA (typed QuotaExceeded{limit:50}), never an exception; the atomic admission means no partial share/binding/invite record is left behind.',
      docRef: `${CH} §4`,
      sets: { 'chat-sup': { 'admit q51': 'DENIED — QuotaExceeded{limit:50} (no records minted)' } },
    },
    {
      state: 'D4', phase: 'QD', kind: 'message', from: 'chat-sup', to: 'local1', frame: 'EXCHANGE-RESP',
      label: 'QuotaExceeded (ok:false)', response: true,
      payload: { correlationId: 'q51', detail: { ok: 'false', error: 'QuotaExceeded{limit: 50}', minted: 'nothing — the fold is unchanged (alice still 50 / 50)' } },
      note: 'A typed QuotaExceeded value, corr 1:1; the fold is unchanged — no partial grp-51.',
      docRef: `${CH} §4 · ${SM} §2.4`,
      sets: { 'chat-sup': { 'pending q51': null } },
    },
    {
      state: 'D5', phase: 'QD', kind: 'message', from: 'local1', to: 'gryth1', frame: 'EXCHANGE-RESP',
      label: 'denied — surfaced as data', response: true,
      payload: { correlationId: 'q51', detail: { result: 'QuotaExceeded (limit 50)', remedy: 'delete/tombstone a group to free quota — freed only once the terminal state is authoritative (§3.5)' } },
      note: 'The caller sees a typed limit error with a remedy, not a spinner. The quota stays 50 / 50 — the denial changed nothing.',
      sets: { gryth1: { view: 'create #51 DENIED — QuotaExceeded{limit:50}' }, local1: { 'pending q51': null } },
    },

    // ---- Phase QC: concurrent boundary -----------------------------------
    {
      state: 'D1', phase: 'QC', kind: 'message', from: 'guest1', to: 'local1', frame: 'EXCHANGE',
      label: 'bob create A (at 49)',
      payload: { share: 'chat', gladeId: 'share.create', shape: 'exchange', verb: 'share.create', correlationId: 'qc-a', detail: { name: 'grp-A', ownedSoFar: '49', concurrent: 'issued at the same instant as grp-B' } },
      note: 'bob is at 49; two creates race the 49→50 boundary. Exactly one may win.',
      docRef: `${CH} §4 (concurrent boundary)`,
      sets: { local1: { 'pending qc-a': 'guest1 → share.create(grp-A)' } },
    },
    {
      state: 'D2', phase: 'QC', kind: 'message', from: 'local1', to: 'chat-sup', frame: 'EXCHANGE',
      label: 'forward create A',
      payload: { gladeId: 'share.create', shape: 'exchange', verb: 'share.create', correlationId: 'qc-a' },
      note: 'A routes to the admission authority with bob’s B3 context.',
      sets: { 'chat-sup': { 'pending qc-a': 'local1', 'requester qc-a': 'bob@fp:b7c9 via guest1' } },
    },
    {
      state: 'D1', phase: 'QC', kind: 'message', from: 'guest1', to: 'local1', frame: 'EXCHANGE',
      label: 'bob create B (also at 49, concurrent)',
      payload: { share: 'chat', gladeId: 'share.create', shape: 'exchange', verb: 'share.create', correlationId: 'qc-b', detail: { name: 'grp-B', ownedSoFar: '49', concurrent: 'races grp-A at the 49→50 boundary' } },
      note: 'The second concurrent create — both read 49 before either commits.',
      sets: { local1: { 'pending qc-b': 'guest1 → share.create(grp-B)' } },
    },
    {
      state: 'D2', phase: 'QC', kind: 'message', from: 'local1', to: 'chat-sup', frame: 'EXCHANGE',
      label: 'forward create B',
      payload: { gladeId: 'share.create', shape: 'exchange', verb: 'share.create', correlationId: 'qc-b' },
      note: 'B routes to the same admission authority — where the two serialize.',
      sets: { 'chat-sup': { 'pending qc-b': 'local1', 'requester qc-b': 'bob@fp:b7c9 via guest1' } },
    },
    {
      state: 'S6', phase: 'QC', kind: 'internal', from: 'chat-sup', frame: 'ROUTE',
      label: 'serialize: A admitted (49→50)',
      payload: { detail: { serialize: 'admit-and-create is ATOMIC — the two creates serialize (§4)', a: 'grp-A: reads 49 < 50 → ADMIT, commits 50', b: 'grp-B: serialized after → will read 50' } },
      gate: { kind: 'capability', label: 'quota admission (atomic)', status: 'enforced', note: 'Atomicity is the whole point at the boundary: the counter cannot be double-spent. A reads 49 and commits 50 before B is evaluated.' },
      note: 'The atomic admit-and-create serializes the race: A reads 49 and commits 50.',
      docRef: `${CH} §4`,
      sets: { 'chat-sup': { 'admit qc-a': 'grp-A ADMITTED (bob 49→50)' }, local1: { 'quota bob': 'used 50 / 50 groups' } },
    },
    {
      state: 'D3', phase: 'QC', kind: 'internal', from: 'chat-sup', frame: 'PROVIDE',
      label: 'mint grp-A (the one winner)',
      payload: { share: 'grp-A', detail: { mint: 'share grp-A committed (bob now owns 50)' } },
      note: 'Only A materializes; bob is now at the limit.',
      docRef: `${CH} §4 · §3.1`,
      sets: { 'chat-sup': { 'share grp-A': 'minted (owner bob)' } },
    },
    {
      state: 'S6', phase: 'QC', kind: 'internal', from: 'chat-sup', frame: 'ROUTE',
      label: 'B denied (count now 50)',
      payload: { detail: { b: 'grp-B: count now 50 → DENY QuotaExceeded{limit:50}', effect: 'exactly ONE of the two concurrent creates admitted; NO partial grp-B record' } },
      gate: { kind: 'capability', label: 'quota admission (atomic)', status: 'enforced', note: 'The loser of the race gets the same typed QuotaExceeded — the boundary admitted exactly one, no over-count, no partial record.' },
      note: 'B, serialized after A, reads 50 and is denied. Exactly one admitted at the boundary — the concurrency invariant.',
      docRef: `${CH} §4`,
      sets: { 'chat-sup': { 'admit qc-b': 'grp-B DENIED — QuotaExceeded{limit:50}' } },
    },
    {
      state: 'D5', phase: 'QC', kind: 'message', from: 'local1', to: 'guest1', frame: 'EXCHANGE-RESP',
      label: 'grp-A created', response: true,
      payload: { correlationId: 'qc-a', detail: { ok: 'true', share: 'grp-A' } },
      note: 'A completes for bob.',
      sets: { local1: { 'pending qc-a': null }, 'chat-sup': { 'pending qc-a': null } },
    },
    {
      state: 'D5', phase: 'QC', kind: 'message', from: 'local1', to: 'guest1', frame: 'EXCHANGE-RESP',
      label: 'grp-B denied (QuotaExceeded)', response: true,
      payload: { correlationId: 'qc-b', detail: { ok: 'false', error: 'QuotaExceeded{limit:50}', outcome: 'exactly one of the two concurrent creates admitted' } },
      note: 'B is denied as data; bob sees one group created and one refused. No over-count.',
      sets: { guest1: { view: 'grp-A created; grp-B DENIED (QuotaExceeded) — exactly one at the boundary' }, local1: { 'pending qc-b': null }, 'chat-sup': { 'pending qc-b': null } },
    },

    // ---- Phase QF: forged owner does not count ---------------------------
    {
      state: 'J3', phase: 'QF', kind: 'message', from: 'gryth2', to: 'local1', frame: 'APPEND',
      label: 'a forger appends group records with a self-declared owner field',
      payload: { detail: { forged: 'GroupRecord{owner-field: alice@fp:a1b2} × 100 — a caller self-declared owner field, not authority-attributed', intent: 'inflate alice’s count to force QuotaExceeded (grief) OR dodge the forger’s own limit by attributing to another' } },
      note: 'A forged owner field is just a caller-asserted string. It is appended, but the admission service does not treat it as ownership.',
      docRef: `${CH} §4 (forged ownership)`,
      sets: { local1: { 'fold forged-groups': '100 records with owner-field=alice (unattributed, forged)' } },
    },
    {
      state: 'S6', phase: 'QF', kind: 'internal', from: 'chat-sup', frame: 'ROUTE',
      label: 'recount ignores forged records',
      payload: { detail: { recount: 'alice authoritative LIVE-owned = 50 (the 100 forged records are IGNORED — not B3-authority-attributed)', griefing: 'a forged owner field cannot INFLATE a victim’s count', dodging: 'nor can a creator DODGE their own limit by stamping someone else’s owner field', invariant: 'the count is over B3-attributed ownership, never a self-declared owner field (§4)' } },
      gate: { kind: 'capability', label: 'quota admission (B3-attributed)', status: 'enforced', note: 'Caller-supplied owner fields and forged group records MUST NOT affect the count. Admission counts only authority-attributed live ownership by the B3 principal — both griefing and dodging fail.' },
      note: 'The forged records change nothing: alice’s authoritative live-owned count is 50, computed over B3-attributed ownership only. A forged owner field does not affect the count.',
      docRef: `${CH} §4`,
      sets: { 'chat-sup': { 'count alice (authoritative)': '50 live — forged owner fields ignored' } },
    },
  ],
};

// ---------------------------------------------------------------------------
// s-chat-decl-realnode (E-chat-2 §3.4) — a group declaration is a typed,
// authz-checked HOME dir.bindings record (the real registry path the node
// actually consumes). The old chat.decl JSON app-share append is
// NON-AUTHORITATIVE and changes no routing. The authoritative path is proven
// on a SPAWNED node (local2, a real process), not only an in-memory provider.
// ---------------------------------------------------------------------------
export const S_CHAT_DECL_REALNODE: Scenario = {
  id: 's-chat-decl-realnode',
  stage: 2,
  title: 'Chat — group declaration is a real dir.bindings record',
  summary:
    'A group declaration is a typed, authz-checked HOME dir.bindings BindingDecl — the real registry path the node consumes. The stage-1 chat.decl JSON append lands but the node never folds it, so it creates NO route. The dir.bindings record replicates to a SPAWNED node (local2, a real process) which routes the group from the fold alone — proving the authoritative path, not an in-memory shortcut.',

  actors: pick('gryth1', 'local1', 'local2'),

  initial: {
    local1: { 'session gryth1': 'open (alice, fp:a1b2)', 'principal alice': 'fp:a1b2 · device-certified (B3)', 'grant gryth1 home': 'declare rights on dir.bindings (registrant chain)' },
  },

  phases: [
    { id: 'DR', label: 'chat.decl is non-authoritative', summary: 'alice’s stage-1 chat.decl JSON append lands as decorative metadata; the node consumes nothing from it and produces no route. The authoritative declaration is a typed dir.bindings record.' },
    { id: 'DN', label: 'Proven on a spawned node', summary: 'The dir.bindings record replicates to a freshly spawned real node, which folds it and routes the group — the JSON append drove nothing.' },
  ],

  steps: [
    // ---- Phase DR: chat.decl is non-authoritative ------------------------
    {
      state: 'A1', phase: 'DR', kind: 'message', from: 'gryth1', to: 'local1', frame: 'HELLO',
      label: 'alice’s authenticated session opens',
      payload: { detail: { session: 'sess-a01', principal: 'alice — fp:a1b2 (device-certified, B3)' } },
      gate: { kind: 'security', label: 'HELLO principal seam', status: 'enforced', note: 'The declaration write is authz-checked against this B3 caller context; alice holds declare rights on HOME dir.bindings.' },
      note: 'The declarer is a B3-authenticated principal; the authoritative declaration is authorization-checked against her context (§3.4).',
      docRef: `${CH} §3.4 (E-chat-2)`,
      sets: { local1: { 'session gryth1': 'open (alice, fp:a1b2)' } },
    },
    {
      state: 'J3', phase: 'DR', kind: 'message', from: 'gryth1', to: 'local1', frame: 'APPEND',
      label: 'the legacy chat.decl JSON append (non-authoritative)',
      payload: { share: 'chat', gladeId: 'chat.decl', detail: { op: 'legacy chat.decl JSON append {group: standup} — the built stage-1 step (a)', status: 'NON-AUTHORITATIVE (E-chat-2 retraction, SR56-10/2-15): the node never consumes chat.decl; decorative metadata at most' } },
      note: 'The built "runtime-declares each group’s surface" claim is WITHDRAWN (§1 fact 3, retracted). This chat.decl append lands but the node does NOT fold it into the registry.',
      docRef: `${CH} §3.4 (E-chat-2) · §2`,
      sets: { local1: { 'fold chat/chat.decl': '+{group:standup} (decorative — non-authoritative)' } },
    },
    {
      state: 'C2', phase: 'DR', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'routing check: chat.decl created NO route',
      payload: { detail: { query: 'route for grp-standup/chat.msgs?', answer: 'NONE — chat.decl is not the registry; the node consumed nothing from it', consequence: 'no routing change from the JSON append' } },
      gate: { kind: 'routing', label: 'route lookup', status: 'enforced', note: 'Proof the JSON append is non-authoritative: the routing table has no entry for the group. Routing authority is the dir.bindings fold, never chat.decl.' },
      note: 'The routing table has no entry for the group — the JSON append changed no routing. The real declaration must go through dir.bindings.',
      docRef: `${CH} §3.4`,
      sets: { local1: { 'route grp-standup/chat.msgs': 'ABSENT (chat.decl ignored)' } },
    },
    {
      state: 'K1', phase: 'DR', kind: 'internal', from: 'local1', frame: 'APPEND',
      label: 'the AUTHORITATIVE declaration — typed dir.bindings record',
      payload: { share: 'home', gladeId: 'dir.bindings', detail: { record: 'BindingDecl{share: grp-standup, glade id: chat.msgs, shape: log, zone: commons} — typed', authz: 'authz-checked against the B3 caller context (alice’s declare rights on HOME dir.bindings)' } },
      gate: { kind: 'capability', label: 'declaration authz check', status: 'enforced', note: 'The dir.bindings write is authorization-checked against the B3 caller — unlike the ungated chat.decl append. This is the real registry path the node consumes (E-chat-2 §3.4).' },
      note: 'Authoritative declaration is a typed, authz-checked BindingDecl on HOME dir.bindings. The group becomes routable the moment this record folds.',
      docRef: `${CH} §3.4 (E-chat-2)`,
      sets: { local1: { 'binding grp-standup/chat.msgs': 'log (commons) — via dir.bindings (authoritative)' } },
    },

    // ---- Phase DN: proven on a spawned node ------------------------------
    {
      state: 'B6', phase: 'DN', kind: 'message', from: 'local2', to: 'local1', frame: 'DIAL',
      label: 'a freshly SPAWNED node joins the mesh',
      payload: { detail: { spawn: 'local2 is a freshly SPAWNED node (a real process), NOT an in-memory provider — the §3.4 test obligation', session: 'node↔node glade session over iroh' } },
      gate: { kind: 'security', label: 'node HELLO seam', status: 'enforced', note: 'The E-chat-2 test obligation: declaration reality is proven on a SPAWNED node. Same principal seam as A1, machine-to-machine.' },
      note: 'local2 boots as a real node (not an in-memory provider) and dials local1 — the substrate on which the authoritative declaration must be shown to work (§3.4).',
      docRef: `${CH} §3.4 (spawned-node obligation)`,
      sets: { local1: { 'session local2': 'open (peer node)', 'sub home': 'local2 (mesh)' }, local2: { session: 'local1 (open)' } },
    },
    {
      state: 'B7', phase: 'DN', kind: 'message', from: 'local1', to: 'local2', frame: 'HEADS',
      label: 'heads exchange (anti-entropy)',
      payload: { share: 'home', detail: { heads: 'version vector + chain heads for the home share' } },
      note: 'The two nodes exchange heads to reconcile the home share — ordinary anti-entropy.',
      docRef: `${SM} §2 · GQ-9`,
      sets: { local2: { 'heads home': 'behind local1 (missing the BindingDecl)' } },
    },
    {
      state: 'B8', phase: 'DN', kind: 'message', from: 'local1', to: 'local2', frame: 'OPS',
      label: 'gap ops: the dir.bindings record replicates',
      payload: { share: 'home', gladeId: 'dir.bindings', detail: { ops: 'BindingDecl(grp-standup/chat.msgs) — the AUTHORITATIVE record ships via ordinary anti-entropy', chatDecl: 'chat.decl is NOT replicated as authority — only dir.bindings drives routing' } },
      note: 'The authoritative record ships as ordinary gap ops (B8, node↔node sync — not a subscriber serve). The spawned node folds it.',
      docRef: `${SM} §2 (anti-entropy)`,
      sets: { local2: { 'fold home/dir.bindings': '+BindingDecl(grp-standup/chat.msgs)' } },
    },
    {
      state: 'P2', phase: 'DN', kind: 'internal', from: 'local2', frame: 'APPEND',
      label: 'the spawned node registers the binding from the fold',
      payload: { detail: { fold: 'grp-standup/chat.msgs registered on the SPAWNED node purely from the folded dir.bindings record', chatDecl: 'the chat.decl JSON was never consumed — it drove NOTHING on this real node', authoritative: 'the real node consumes dir.bindings — routable the moment this record folds (E-chat-2)' } },
      note: 'On a real spawned node the group becomes routable purely from the folded dir.bindings record — the real registry path, not an in-memory shortcut.',
      docRef: `${CH} §3.4 (E-chat-2)`,
      sets: { local2: { 'route grp-standup/chat.msgs': 'commons (own share) — from dir.bindings' } },
    },
    {
      state: 'C2', phase: 'DN', kind: 'internal', from: 'local2', frame: 'ROUTE',
      label: 'the spawned node routes the group — FOUND',
      payload: { detail: { query: 'route grp-standup/chat.msgs on local2 (the real node)?', answer: 'FOUND — from the folded dir.bindings record', contrast: 'chat.decl produced no such route (step DR/C2, ABSENT)' } },
      gate: { kind: 'routing', label: 'route lookup', status: 'enforced', note: 'The clean contrast: dir.bindings yields a route on a real spawned node; chat.decl yielded none. The authoritative path works end to end where it must — a real process.' },
      note: 'The spawned node routes the group from dir.bindings alone; the JSON append changed nothing anywhere. E-chat-2 proven on a real node.',
      docRef: `${CH} §3.4 (E-chat-2)`,
      sets: { local2: { 'query grp-standup': 'routable (via dir.bindings) — chat.decl irrelevant' } },
    },
  ],
};

// ---------------------------------------------------------------------------
// s-chat-edit (E-chat-5 §3.5) — editing or deleting a posted line is a SIGNED
// tombstone / superseding record (the flip-instance idiom), never an in-place
// rewrite. The original ChatLine stays immutable + auditable; clients render
// the superseded state. Deny arm: a VALIDLY-SIGNED cross-author edit (bob
// superseding alice’s line) is refused by the distinct EDIT-AUTHORITY check —
// signer must be the line’s author (§3.5), NOT by verify-as-ingest, which its
// own-origin signature would pass; the original is untouched.
// ---------------------------------------------------------------------------
export const S_CHAT_EDIT: Scenario = {
  id: 's-chat-edit',
  stage: 2,
  title: 'Chat — edit/delete is a signed tombstone, original immutable',
  summary:
    'alice edits then deletes a posted line: each lands as a B5-signed superseding / tombstone record BESIDE the original ChatLine, never an in-place rewrite. bob renders the superseded state; the original stays immutable and the full signed chain is the audit trail. An unauthorized edit (bob superseding alice’s line — his signature is VALID, but he is not the author and holds no moderation grant) is rejected by the EDIT-AUTHORITY check, distinct from the signature check — the original is untouched.',

  actors: pick('gryth1', 'guest1', 'local1'),

  initial: {
    local1: {
      'session gryth1': 'open (alice, fp:a1b2)',
      'session guest1': 'open (bob, fp:b7c9)',
      'principal alice': 'fp:a1b2 · device-certified (B5)',
      'principal bob': 'fp:b7c9 · device-certified (B5)',
      'account grp-team': 'gryth1',
      'grant guest1 grp-team': 'read.subscribe.post (member)',
      'sub grp-team/chat.msgs{commons}': 'gryth1, guest1',
    },
    gryth1: { view: '#team (owner)' },
    guest1: { view: '#team (member)' },
  },

  phases: [
    { id: 'EO', label: 'The original line', summary: 'alice posts a B5-signed ChatLine into the group commons; bob folds it.' },
    { id: 'EE', label: 'Edit = a signed superseding record', summary: 'alice edits: a signed SupersedeRecord beside the original — not an in-place rewrite; clients render the superseded state.' },
    { id: 'ED', label: 'Delete = a signed tombstone', summary: 'alice deletes: a signed TombstoneRecord — the original + edit stay in the log; a tombstone hides, it does not erase.' },
    { id: 'EA', label: 'The original stays auditable', summary: 'The full signed record chain (original → edit → delete) is verified + retained — the audit trail is complete.' },
    { id: 'EX', label: 'Unauthorized edit denied', summary: 'bob tries to supersede alice’s line; his signature is valid but the record fails the EDIT-AUTHORITY check (not the author, no moderation grant) and never enters the fold — the original is untouched.' },
  ],

  steps: [
    // ---- Phase EO: the original line -------------------------------------
    {
      state: 'J3', phase: 'EO', kind: 'message', from: 'gryth1', to: 'local1', frame: 'APPEND',
      label: 'alice posts the original line (B5-signed)',
      payload: { share: 'grp-team', gladeId: 'chat.msgs', key: '{commons}', detail: { op: 'ChatLine{seq:1, user: alice, principal: fp:a1b2, text: "ship friday"}', signed: 'B5-signed by alice’s certified device' } },
      note: 'The original line is a signed record in the group commons — the thing edit/delete must NOT rewrite.',
      docRef: `${CH} §3.5 (E-chat-5) · §1 fact 2`,
      sets: { local1: { 'signed alice@1': 'ChatLine "ship friday" · sig ok', 'fold grp-team/chat.msgs{commons}': 'seq1 (alice: "ship friday")' } },
    },
    {
      state: 'B9', phase: 'EO', kind: 'message', from: 'local1', to: 'guest1', frame: 'OPS', response: true,
      label: 'bob folds alice’s line',
      payload: { share: 'grp-team', gladeId: 'chat.msgs', key: '{commons}', shape: 'log', detail: { line: 'ChatLine seq1 (alice)' } },
      note: 'bob (a member — grant present) receives the original line.',
      sets: { guest1: { view: '#team: alice: ship friday' } },
    },

    // ---- Phase EE: edit = a signed superseding record --------------------
    {
      state: 'J3', phase: 'EE', kind: 'message', from: 'gryth1', to: 'local1', frame: 'APPEND',
      label: 'alice edits — a signed superseding record',
      payload: { share: 'grp-team', gladeId: 'chat.msgs', key: '{commons}', detail: { op: 'SupersedeRecord{supersedes: alice@1, seq:2, text: "ship monday"}', signed: 'B5-signed by alice’s certified device', notInPlace: 'the original seq1 is NOT mutated — a new record BESIDE it (the flip-instance idiom, glade-share §4)' } },
      note: 'Editing is a SIGNED superseding record (E-chat-5 §3.5), never an in-place rewrite. The original ChatLine stays immutable.',
      docRef: `${CH} §3.5 (E-chat-5) · ${GS} §4 (flip-instance)`,
      sets: { local1: { 'signed alice@2': 'SupersedeRecord(alice@1 → "ship monday") · sig ok', 'fold grp-team/chat.msgs{commons}': 'seq1 (superseded) + seq2 → renders "ship monday"' } },
    },
    {
      state: 'B9', phase: 'EE', kind: 'message', from: 'local1', to: 'guest1', frame: 'OPS', response: true,
      label: 'bob renders the superseded state',
      payload: { share: 'grp-team', gladeId: 'chat.msgs', key: '{commons}', shape: 'log', detail: { rendered: 'clients render the superseded (current) state: "ship monday"', original: 'seq1 still present + auditable in the log' } },
      note: 'Clients render the superseded state; the audit trail is the full record history — the original is never lost.',
      docRef: `${CH} §3.5`,
      sets: { guest1: { view: '#team: alice: ship monday (edited)' } },
    },

    // ---- Phase ED: delete = a signed tombstone ---------------------------
    {
      state: 'J3', phase: 'ED', kind: 'message', from: 'gryth1', to: 'local1', frame: 'APPEND',
      label: 'alice deletes — a signed tombstone record',
      payload: { share: 'grp-team', gladeId: 'chat.msgs', key: '{commons}', detail: { op: 'TombstoneRecord{tombstones: alice@2, seq:3}', signed: 'B5-signed by alice’s certified device', notErased: 'the original + the edit stay in the log — a tombstone HIDES, it does not erase' } },
      note: 'Deleting is a signed tombstone record beside the original (E-chat-5) — the record history is intact + auditable.',
      docRef: `${CH} §3.5`,
      sets: { local1: { 'signed alice@3': 'TombstoneRecord(alice@2) · sig ok', 'fold grp-team/chat.msgs{commons}': 'seq1 + seq2 + seq3 tombstone → renders "(deleted)"' } },
    },
    {
      state: 'B9', phase: 'ED', kind: 'message', from: 'local1', to: 'guest1', frame: 'OPS', response: true,
      label: 'bob renders the deleted state',
      payload: { share: 'grp-team', gladeId: 'chat.msgs', key: '{commons}', shape: 'log', detail: { rendered: 'the fold renders "(deleted by alice)"; the underlying records are retained' } },
      note: 'The delete is a fold outcome, not a data erasure — the tombstone supersedes the visible state while the chain persists.',
      sets: { guest1: { view: '#team: (deleted by alice)' } },
    },

    // ---- Phase EA: the original stays auditable --------------------------
    {
      state: 'Y2', phase: 'EA', kind: 'internal', from: 'local1', frame: 'FOLD',
      label: 'verify-as-ingest — the full signed chain is auditable',
      payload: { detail: { audit: 'chain: alice@1 (original) → alice@2 (edit) → alice@3 (delete) — all B5-signed, all retained', immutable: 'the original ChatLine bytes are unchanged; edits/deletes are records BESIDE it', verify: 'each record verified as ingested (origin sig + prev-hash continuity + seq monotonicity)' } },
      gate: { kind: 'security', label: 'verify-as-ingest', status: 'enforced', note: 'Per record: origin signature + prev-hash continuity + seq monotonicity. The chain IS the audit trail — free, complete, attributable. The original is immutable + auditable (E-chat-5 §3.5).' },
      note: 'The original stays immutable + auditable: the full signed record chain IS the audit trail. Edit/delete never rewrite; they append signed superseding/tombstone records.',
      docRef: `${CH} §3.5 (E-chat-5)`,
      sets: { local1: { 'audit grp-team/alice': 'seq1 original + seq2 edit + seq3 delete — all signed, immutable, auditable' } },
    },

    // ---- Phase EX: unauthorized edit denied ------------------------------
    {
      state: 'J3', phase: 'EX', kind: 'message', from: 'guest1', to: 'local1', frame: 'APPEND',
      label: 'bob attempts to supersede alice’s line',
      payload: { share: 'grp-team', gladeId: 'chat.msgs', key: '{commons}', detail: { op: 'SupersedeRecord{supersedes: alice@1, text: "cancelled"} — submitted by bob (fp:b7c9), NOT the author', signed: 'signed by bob’s device — the SIGNATURE IS VALID; but supersede(alice@1) requires the signer be alice (the author) OR hold a moderation grant, and bob is neither' } },
      note: 'The deny arm: superseding a line requires EDIT-AUTHORITY — the signer must be the line’s author (or hold a moderation grant). This is a check DISTINCT from B5 signature validity: bob’s own signature is valid, but he is not alice. (Whose-authority may edit — author-only vs a moderation grant — is a chat spec open, §3.5.)',
      docRef: `${CH} §3.5`,
      sets: { local1: { 'signed bob@edit': 'SupersedeRecord(alice@1) · sig VALID, edit-authority DENIED (bob ≠ author alice, no moderation grant)' } },
    },
    {
      state: 'Y2', phase: 'EX', kind: 'internal', from: 'local1', frame: 'FOLD', variant: 'a',
      variantNote: 'The failure branch: a cross-author supersede PASSES the B5 signature check (bob’s device sig is valid) but FAILS the distinct edit-authority check (signer ≠ author, no moderation grant) and is rejected; the original is untouched.',
      label: 'edit-authority REJECTS the cross-author edit',
      payload: { detail: { verdict: 'REJECTED — edit-authority: signer bob ≠ author alice (no moderation grant); the signature itself was valid', effect: 'the supersede does NOT enter the fold; alice’s line renders unchanged', immutable: 'immutability rests on edit-authority, NOT on signature validity: a valid signature by a non-author is still refused' } },
      gate: { kind: 'security', label: 'edit-authority', status: 'enforced', note: 'A supersede/tombstone is admitted only if the signer is the target line’s author OR holds a moderation grant — a valid B5 signature by a non-author is not enough. This check is distinct from verify-as-ingest (signature + prev-hash + seq), which bob’s record would pass.' },
      note: 'The cross-author edit is rejected on edit-authority grounds (bob’s signature is valid; he simply may not edit alice’s line). The original + its authorized history are unchanged — immutable-original holds under a hostile but validly-signed edit.',
      docRef: `${CH} §3.5 · §1 fact 2`,
      sets: { local1: { 'signed bob@edit': 'REJECTED (edit-authority: not the author — original untouched)' } },
    },
  ],
};

// ---------------------------------------------------------------------------
// s-chat-codec (E-chat-3 §6) — taut ChatLine is the SOLE wire payload for
// chat.msgs; gryth-ui decodes it via the taut IR vendored into @grythjs/glade,
// retiring its JSON path. A legacy JSON line decodes best-effort as a legacy
// line (the forward-cut). Stage 1 (a codec/wire concern — nothing gated).
// ---------------------------------------------------------------------------
export const S_CHAT_CODEC: Scenario = {
  id: 's-chat-codec',
  stage: 1,
  title: 'Chat — taut ChatLine is the sole codec (the forward cut)',
  summary:
    'taut ChatLine is the SOLE payload for chat.msgs (E-chat-3): a taut demo client posts and gryth-ui decodes it via the taut IR vendored into @grythjs/glade — the two UIs, once NOT wire-interoperable, now converge on one codec. A legacy JSON line decodes best-effort as a legacy line (principal absent ⇒ null). The JSON→taut cutover is a hard forward-cut gate, not a data migration; chat.groups metadata stays JSON.',

  actors: pick('gryth1', 'gryth2', 'local1'),

  initial: {
    local1: {
      'binding chat/chat.msgs': 'log (keyed commons)',
      'sub chat/chat.msgs{general}': 'gryth1, gryth2',
      'codec chat/chat.msgs': 'taut ChatLine (sole) — E-chat-3',
    },
    gryth1: { subs: 'chat/chat.msgs{general}', view: '#general (taut demo client)' },
    gryth2: { subs: 'chat/chat.msgs{general}', view: '#general (gryth-ui — taut IR vendored)' },
  },

  phases: [
    { id: 'KT', label: 'taut ChatLine is the sole payload', summary: 'A taut client posts a ChatLine; gryth-ui decodes it via the vendored taut IR — one wire codec, the two UIs interoperable.' },
    { id: 'KL', label: 'Legacy JSON decodes best-effort', summary: 'A legacy JSON chat.msgs line (a future persisted deployment) decodes best-effort as a legacy line — text intact, principal null.' },
    { id: 'KC', label: 'The forward cut — a hard gate', summary: 'The JSON→taut cutover is a forward cut, not a migration: no long-lived JSON records outlive the switch; a hard gate before mixing clients on one node.' },
  ],

  steps: [
    // ---- Phase KT: taut ChatLine is the sole payload ---------------------
    {
      state: 'J3', phase: 'KT', kind: 'message', from: 'gryth1', to: 'local1', frame: 'APPEND',
      label: 'a taut client posts a ChatLine',
      payload: { share: 'chat', gladeId: 'chat.msgs', key: '{group:general}', detail: { op: 'ChatLine{ts, user: alice, principal: fp:a1b2, text: "hi"} — encoded as taut', codec: 'taut ChatLine — tag 4 principal OPTIONAL, additive beside user (§1 fact 2)' } },
      note: 'taut ChatLine is the SOLE chat payload for chat.msgs (E-chat-3 §6). JSON was bring-up; unification retires it.',
      docRef: `${CH} §6 (E-chat-3)`,
      sets: { local1: { 'fold chat/chat.msgs{general}': '+1 taut ChatLine (alice: hi)' } },
    },
    {
      state: 'B9', phase: 'KT', kind: 'message', from: 'local1', to: 'gryth2', frame: 'OPS', response: true,
      label: 'gryth-ui decodes the taut line via the vendored IR',
      payload: { share: 'chat', gladeId: 'chat.msgs', key: '{group:general}', shape: 'log', detail: { decode: 'gryth-ui decodes chat.msgs via the taut IR VENDORED into @grythjs/glade (glade.ir.json, refreshed on wire change) — its JSON path retired (E-chat-3 §6)', wire: 'one wire codec unifies the clients — the P1.S4 non-interop caveat closed' } },
      note: 'Post-unification gryth-ui decodes the taut ChatLine via the vendored taut IR — the two UIs are now wire-interoperable on chat payloads.',
      docRef: `${CH} §6 (E-chat-3)`,
      sets: { gryth2: { view: '#general: alice: hi (decoded via vendored taut IR)' } },
    },

    // ---- Phase KL: legacy JSON decodes best-effort -----------------------
    {
      state: 'J3', phase: 'KL', kind: 'message', from: 'gryth2', to: 'local1', frame: 'APPEND',
      label: 'a legacy JSON chat.msgs line (future persisted deployment)',
      payload: { share: 'chat', gladeId: 'chat.msgs', key: '{group:general}', detail: { op: 'legacy record: JSON {user:"bob", text:"old msg"} — NO taut tag structure, NO principal field', origin: 'a long-lived JSON chat.msgs record — relevant only to a FUTURE persisted deployment (§6 migration posture)' } },
      note: 'The migration posture: for any future persisted deployment, a legacy JSON ChatLine decodes BEST-EFFORT as a legacy line (the additive-field / v2-record-beside-v1 lesson, glade-users §5).',
      docRef: `${CH} §6 (migration posture) · ${GU} §5`,
      sets: { local1: { 'fold chat/chat.msgs{general}': '+legacy JSON line (pending best-effort decode)' } },
    },
    {
      state: 'A4', phase: 'KL', kind: 'internal', from: 'local1', frame: 'FOLD',
      label: 'best-effort legacy decode',
      payload: { detail: { decode: 'legacy JSON line decoded best-effort: text preserved, principal ABSENT ⇒ null (decodes to null, §1 fact 2)', forwardOnly: 'no taut re-encode of history — taut is the sole GO-FORWARD codec; best-effort decode is only for a future persisted corpus' } },
      note: 'The legacy line renders best-effort (text intact, principal null); taut is still the sole forward codec. Legacy JSON is read-compatible, not first-class.',
      docRef: `${CH} §6`,
      sets: { local1: { 'render legacy line': 'bob: old msg (principal: null — legacy, best-effort)' } },
    },

    // ---- Phase KC: the forward cut — a hard gate -------------------------
    {
      state: 'A4', phase: 'KC', kind: 'internal', from: 'local1', frame: 'FOLD',
      label: 'the JSON→taut forward cut (a hard migration gate)',
      payload: { detail: { gate: 'forward cut — taut becomes the sole codec BEFORE any node carries mixed clients', why: 'the two UIs are separate grazel deployments and gryth-ui ran an ephemeral MemoryStoreEngine (P1.S4 — no persisted corpus), so nothing to migrate, only to cut', groups: 'chat.groups metadata stays JSON (glial default — a config value, no cross-language MESSAGE need)' } },
      gate: { kind: 'capability', label: 'JSON→taut forward-cut gate', status: 'designed', note: 'The cutover is a FORWARD CUT, not a data migration: no long-lived JSON chat.msgs records outlive the switch. This is a HARD migration gate (a P2 gate) before mixing clients on one node — not an opportunistic cleanup (E-chat-3 §6).' },
      note: 'The forward cut is a hard gate: unify on taut ChatLine before any node carries mixed clients. Only the cross-language MESSAGE payload unifies — chat.groups metadata stays JSON.',
      docRef: `${CH} §6 (forward cut — hard gate)`,
      sets: { local1: { 'codec chat/chat.msgs': 'taut ChatLine (sole) — forward cut complete', 'codec chat/chat.groups': 'JSON (metadata, unchanged)' } },
    },
  ],
};
