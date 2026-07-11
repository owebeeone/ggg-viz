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
