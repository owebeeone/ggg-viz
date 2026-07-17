// Terminal slice (glade-terminal supplier). Three correctness arms of the
// three-surface decomposition (scrollback log + live pty stream + open/attach
// exchange):
//   · s-term-reattach       — D9: second owner session reattaches; scrollback
//                             replay from a cursor then live cutover keyed by
//                             TermOut{generation, offset} — no byte doubled or
//                             omitted across the splice.
//   · s-term-takeover       — D9: driver handoff advances driver_epoch
//                             atomically; a stale-epoch TermIn from the old
//                             driver fails closed (its buffered bytes never run).
//   · s-term-remote-denied  — D10: a local session is never forwarded/advertised
//                             across the mesh, so a remote caller has no route to
//                             it; owner identity is the B3 ProviderCallContext,
//                             never a payload principal — masquerade fails at the
//                             context seam. Owner-only by MECHANISM (no-advertise
//                             + unguessable session_id), before any stage-2 grant.
// Spec of record: dev-docs/glade/suppliers/glade-terminal.md.
import type { Scenario } from './types';
import { pick } from './actors';

const GT = 'glade-terminal'; //     the supplier spec (§ refs below)
const AZ = 'GladeAuthzModel'; //    term.write ≈ shell.exec, cosign(sponsor)
const SUB = 'GladeSubstrateV1'; //  channel envelopes / priority scheduler

// One unguessable session id fronts BOTH the term.pty channel and the
// term.scrollback log (spec §2). ws-razel is the selected workspace.
const SID = 's-7a2f';

// -----------------------------------------------------------------------------
// s-term-reattach — the primary correctness seam (spec §4, Open Q1; D9 RULED)
// -----------------------------------------------------------------------------
export const S_TERM_REATTACH: Scenario = {
  id: 's-term-reattach',
  stage: 1,
  title: 'Terminal reattach — scrollback replay + lossless live cutover',
  summary:
    'A second session of MINE reattaches: replay term.scrollback from a cursor, then splice to the live pty tail — the client trims the overlap by TermOut.offset, so no output byte is doubled or omitted.',

  actors: pick('gryth1', 'gryth2', 'local1', 'peer1'),

  initial: {
    // gryth1 is the FIRST owner session — already live, driving vim. Present as
    // context: reattach is "a second session of MINE", not a fresh open.
    gryth1: { session: 'local1 (open)', view: 'term.pty live (vim, driver)' },
    local1: {
      'session gryth1': 'open',
      'sub ws-razel/term.pty{s-7a2f}': 'gryth1',
      links: 'peer1 (iroh)',
    },
    peer1: {
      serving: 'ws-razel terminal via grazel',
      // providerAttach vocab: authority session serving a binding, with epoch.
      'provider ws-razel/term.pty': 'sess s-7a2f attached — epoch 1 (1 owner session)',
      // termOut vocab: the durable single-writer output surface, keyed off SID.
      'termout ws-razel/term.scrollback': '412 lines · gen 1 · cursor 412',
      'sub ws-razel/term.pty{s-7a2f}': 'local1',
    },
  },

  phases: [
    { id: 'RA1', label: 'Attach (broker)', summary: 'term.open with attach: session_id; owner identity is the B3 context, never a payload principal.' },
    { id: 'RA2', label: 'Scrollback replay', summary: 'Windowed read of term.scrollback from a cursor — durable log earns reattach.' },
    { id: 'RA3', label: 'Live cutover', summary: 'Splice replay to the live pty tail; TermOut.offset trims the overlap — lossless.' },
  ],

  steps: [
    // ---- RA1: open-or-attach broker (term.open exchange) --------------------
    {
      state: 'D1', phase: 'RA1', kind: 'message', from: 'gryth2', to: 'local1', frame: 'EXCHANGE',
      label: 'term.open { attach: session_id }',
      payload: { share: 'ws-razel', gladeId: 'term.open', shape: 'exchange', verb: 'term.open', correlationId: 'x-tr-1', detail: { attach: SID, note: 'owner identity rides the B3 ProviderCallContext — NOT a payload principal field' } },
      note: 'Reattach goes through the term.open broker with attach: session_id (spec §4). The owner principal + fingerprint come from the node-authenticated ProviderCallContext (B3), never a spelled payload field.',
      docRef: `${GT} §2/§4 (D9 · B3)`,
      sets: { local1: { 'pending x-tr-1': 'gryth2 → attach s-7a2f' } },
    },
    {
      state: 'D2', phase: 'RA1', kind: 'message', from: 'local1', to: 'peer1', frame: 'EXCHANGE',
      label: 'forward attach to the pty host',
      payload: { share: 'ws-razel', gladeId: 'term.open', correlationId: 'x-tr-1', verb: 'term.open', detail: { route: 'app-side session → host map (local); the session is NOT advertised on the mesh (D10)' } },
      note: 'The broker leg routes 1:1 to the session’s host. The route is app-owned/local — a local session is never forwarded across the mesh (foreshadows s-term-remote-denied).',
      docRef: `${GT} §4/§5`,
      sets: { peer1: { 'pending x-tr-1': 'local1 → attach s-7a2f' } },
    },
    {
      state: 'D3', phase: 'RA1', kind: 'internal', from: 'peer1', frame: 'PROVIDE',
      label: 'broker validates owner + returns channel',
      payload: { detail: { session: 's-7a2f exists (live)', ownerCheck: 'B3 fingerprint == session owner fingerprint (same owner, second session)', channel: '(ws-razel, term.pty, key=s-7a2f)' } },
      gate: { kind: 'security', label: 'owner-only (B3)', status: 'designed', note: 'Stage-1 owner-only holds by the B3 context match (same owner fingerprint) + the unguessable session_id — a term.read grant CHECK is stage-2 (spec §5/§7).' },
      note: 'The broker attaches a SECOND owner session to the existing session. All watchers share ONE live-output/scrollback space (D10), so there is one offset line to align against.',
      docRef: `${GT} §2/§4`,
      sets: { peer1: { 'provider ws-razel/term.pty': 'sess s-7a2f attached — epoch 1 (2 owner sessions)' } },
    },
    {
      state: 'D4', phase: 'RA1', kind: 'message', from: 'peer1', to: 'local1', frame: 'EXCHANGE-RESP',
      label: 'channel handle back', response: true,
      payload: { correlationId: 'x-tr-1', detail: { session_id: SID, channel: '(ws-razel, term.pty, s-7a2f)', cursor: '412' } },
      note: 'The response carries the session_id and the (share, glade id, key) channel address — the same canonical key fronts both the pty channel and the scrollback log (spec §2).',
      docRef: `${GT} §2`,
      sets: { peer1: { 'pending x-tr-1': null } },
    },
    {
      state: 'D5', phase: 'RA1', kind: 'message', from: 'local1', to: 'gryth2', frame: 'EXCHANGE-RESP',
      label: 'attached — channel ready', response: true,
      payload: { correlationId: 'x-tr-1', detail: { cursor: '412' } },
      note: 'The reattaching session now knows the channel and the current scrollback cursor. Replay comes next; the live channel splices after.',
      sets: { local1: { 'pending x-tr-1': null }, gryth2: { session: 'local1 (open)', 'attach s-7a2f': 'channel ready — cursor 412' } },
    },

    // ---- RA2: scrollback replay from a cursor (window read of the log) -------
    {
      state: 'W1', phase: 'RA2', kind: 'message', from: 'gryth2', to: 'local1', frame: 'SUBSCRIBE',
      label: 'window subscribe: scrollback [0..412]',
      payload: { share: 'ws-razel', gladeId: 'term.scrollback', key: SID, shape: 'window', detail: { window: 'from offset 0, len 412 (replay to the attach cursor)' } },
      note: 'Scrollback is a durable log (spec §1.1) — this is what makes reattach work. The replay is a windowed read from a cursor; each record is TermOut{generation, offset, bytes} (D9).',
      docRef: `${GT} §1/§4 · ${SUB} §7`,
      // windowGen vocab: the reattaching viewer’s replay window generation.
      sets: { gryth2: { 'window ws-razel/term.scrollback': 'gen 1 · [0+412]' }, local1: { 'sub ws-razel/term.scrollback{s-7a2f}': 'gryth2' } },
    },
    {
      state: 'C3', phase: 'RA2', kind: 'message', from: 'local1', to: 'peer1', frame: 'SUBSCRIBE',
      label: 'forward window interest',
      payload: { share: 'ws-razel', gladeId: 'term.scrollback', key: SID, shape: 'window' },
      gate: { kind: 'capability', label: 'term.read', status: 'stub-allow-all', note: 'Stage-1 the scrollback is commons gated only by the unguessable session_id; the term.read grant CHECK fires at stage-2 (spec §5/§7).' },
      note: 'The single-writer provider (peer1) owns the scrollback log; interest lands there for the windowed replay.',
      docRef: `${GT} §2/§5`,
      sets: { peer1: { 'sub ws-razel/term.scrollback{s-7a2f}': 'local1' } },
    },
    {
      state: 'W2', phase: 'RA2', kind: 'message', from: 'peer1', to: 'local1', frame: 'OPS',
      label: 'replay ships [offset 0..412]', response: true,
      payload: { share: 'ws-razel', gladeId: 'term.scrollback', key: SID, detail: { records: 'TermOut{gen 1, offset 0..412}', keyed: 'each record carries its monotonic offset' } },
      note: 'The replay window ships from the cursor. Offsets are the monotonic per-session byte positions (spec §3) the client will use to dedup at the splice.',
      docRef: `${GT} §3/§4 (D9)`,
      sets: { local1: { 'replica ws-razel/term.scrollback': 'TermOut[0..412] cached' } },
    },
    {
      state: 'W2', phase: 'RA2', kind: 'message', from: 'local1', to: 'gryth2', frame: 'OPS',
      label: 'replay forwarded to the reattaching session', response: true,
      payload: { share: 'ws-razel', gladeId: 'term.scrollback', key: SID, detail: { ui: 'scrollback repaints [0..412]' } },
      note: 'The second session has the full scrollback up to the cursor — same history the first session shows.',
      sets: { gryth2: { view: 'scrollback replayed [0..412] — replaying' } },
    },

    // ---- RA3: live cutover — splice replay to the live tail ------------------
    {
      state: 'C1', phase: 'RA3', kind: 'message', from: 'gryth2', to: 'local1', frame: 'SUBSCRIBE',
      label: 'open the LIVE pty channel',
      payload: { share: 'ws-razel', gladeId: 'term.pty', key: SID, shape: 'stream', detail: { note: 'the live 1:1 channel — never replicated (spec §1.2)' } },
      note: 'The live session is a 1:1 stream/channel (TerminalPty). Opening it is the P3.S4 THIRD attach path (channel-to-provider), beside value/log serve and the exchange. The client buffers live output from the moment it opens — offset 412 onward.',
      docRef: `${GT} §1/§3 (P3.S4 · D9)`,
      sets: { local1: { 'sub ws-razel/term.pty{s-7a2f}': 'gryth1, gryth2' }, gryth2: { 'live channel s-7a2f': 'opening — buffering from offset 412' } },
    },
    {
      state: 'C2', phase: 'RA3', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'route the channel to the pty host',
      payload: { share: 'ws-razel', gladeId: 'term.pty', key: SID, detail: { answer: 'peer1 (attached provider)', kind: 'channel route by (share, glade id, key=session_id) — 1:1, NOT a fold subscribe' } },
      gate: { kind: 'routing', label: 'channel route (P3.S4)', status: 'designed', note: 'A third attach path beside value/log (ServeClaim + ops) and exchange (provider map): the channel routes to the attached authority, 1:1 like exchange handle_request (spec §3).' },
      note: 'Channel frames grow a real route to the attached provider — the P3.S4 gap (channel routed to a real provider, not the echo stub).',
      docRef: `${GT} §3 (P3.S4)`,
      sets: { local1: { 'route ws-razel/term.pty{s-7a2f}': 'peer1 (channel)' } },
    },
    {
      state: 'C3', phase: 'RA3', kind: 'message', from: 'local1', to: 'peer1', frame: 'SUBSCRIBE',
      label: 'forward channel interest',
      payload: { share: 'ws-razel', gladeId: 'term.pty', key: SID, shape: 'stream' },
      gate: { kind: 'capability', label: 'term.read', status: 'stub-allow-all', note: 'Watching the live output is term.read at stage-2; a DRIVER (input) additionally needs term.write ≈ shell.exec (spec §5).' },
      note: 'The provider attaches the second owner session to the live channel; output rides both this channel and the scrollback append.',
      docRef: `${GT} §5 · ${AZ} §3`,
      sets: { peer1: { 'sub ws-razel/term.pty{s-7a2f}': 'local1' } },
    },
    {
      state: 'C5', phase: 'RA3', kind: 'message', from: 'peer1', to: 'local1', frame: 'OPS',
      label: 'live tail on the channel [offset 412..460]', response: true,
      payload: { share: 'ws-razel', gladeId: 'term.pty', key: SID, detail: { records: 'TermOut{gen 1, offset 412..460}', both: 'the SAME bytes also append to term.scrollback (output rides both paths)' } },
      note: 'The pty keeps producing while the client reattaches. Output rides BOTH paths (spec §1.5): the live channel AND the durable scrollback — same TermOut{generation, offset}, so a cutover can align them.',
      docRef: `${GT} §1/§3 (D9)`,
      sets: { peer1: { 'termout ws-razel/term.scrollback': '460 lines · gen 1 · cursor 460' } },
    },
    {
      state: 'C6', phase: 'RA3', kind: 'message', from: 'local1', to: 'gryth2', frame: 'OPS',
      label: 'live tail forwarded', response: true,
      payload: { share: 'ws-razel', gladeId: 'term.pty', key: SID, detail: { ui: 'live bytes [412..460] arrive on the channel' } },
      note: 'The reattaching session now holds replay [0..412) AND live [412..460) — with an overlap region to reconcile by offset.',
      sets: { gryth2: { 'live channel s-7a2f': 'live — received [412..460]' } },
    },
    {
      state: 'A4', phase: 'RA3', kind: 'internal', from: 'gryth2', frame: 'FOLD',
      label: 'cutover: splice by TermOut.offset — lossless',
      payload: { detail: { splice: 'replay [0..412) + live [412..460)', dedup: 'trim the replay/live overlap by TermOut.offset (monotonic byte position)', generation: 'gen stays 1 ⇒ continuation (a bump would show an EXPLICIT truncation gap, F-GAP10) — never a silent hole', invariant: 'no output byte doubled, none omitted' } },
      note: 'The re-attach cutover is the primary correctness seam (spec §4, Open Q1; D9 RULES it): offset gives the single monotonic line to align against, generation distinguishes a truncation/reset from a continuation. Neither duplicate nor omit — the done criterion "same scrollback, live again" is exactly this.',
      docRef: `${GT} §3/§4/§6 (D9 · F-GAP10)`,
      sets: { gryth2: { 'termout ws-razel/term.scrollback': '460 lines · gen 1 · cursor 460 (cutover aligned)', view: 'live again — cutover clean, 0 bytes doubled/omitted' } },
    },
  ],
};

// -----------------------------------------------------------------------------
// s-term-takeover — driver-slot handoff over the pty (spec §4; D9/D10 RULED)
// -----------------------------------------------------------------------------
export const S_TERM_TAKEOVER: Scenario = {
  id: 's-term-takeover',
  stage: 1,
  title: 'Terminal takeover — atomic driver_epoch fence',
  summary:
    'The input channel is 1:1 — exactly one session drives. A second owner session takes the driver slot; driver_epoch advances atomically; the stale driver’s buffered TermIn fails closed off the epoch and never executes. The HOST does not migrate.',

  actors: pick('gryth1', 'gryth2', 'local1', 'peer1'),

  initial: {
    gryth1: { session: 'local1 (open)', 'drives pty:s-7a2f': 'epoch 1', view: 'term.pty live (driver)' },
    gryth2: { session: 'local1 (open)', view: 'term.pty live (watching — 2nd owner session)' },
    local1: {
      'session gryth1': 'open',
      'session gryth2': 'open',
      'sub ws-razel/term.pty{s-7a2f}': 'gryth1, gryth2',
      'route ws-razel/term.pty{s-7a2f}': 'peer1 (channel)',
      links: 'peer1 (iroh)',
    },
    peer1: {
      serving: 'ws-razel terminal via grazel',
      // The authoritative driver fence lives at the provider (spec §4). One
      // holder, so the `claim` shape opts into INV-3 as a clean single-driver
      // proof; the epoch advances 1→2 at the handoff.
      'claim pty:s-7a2f': 'held — epoch 1 · driver gryth1',
      'provider ws-razel/term.pty': 'sess s-7a2f attached — epoch 1',
      'sub ws-razel/term.pty{s-7a2f}': 'local1',
      'termout ws-razel/term.scrollback': '412 lines · gen 1 · cursor 412',
    },
  },

  phases: [
    { id: 'TK1', label: 'Healthy drive (epoch 1)', summary: 'The driver types; every TermIn is stamped driver_epoch; the provider executes.' },
    { id: 'TK2', label: 'Atomic handoff', summary: 'A second owner session takes the slot; driver_epoch advances 1→2 in one step; the host does NOT move.' },
    { id: 'TK3', label: 'Stale driver fenced', summary: 'The old driver’s buffered TermIn is off-epoch → fails closed; the bytes never execute.' },
  ],

  steps: [
    // ---- TK1: healthy drive at epoch 1 -------------------------------------
    {
      state: 'J3', phase: 'TK1', kind: 'message', from: 'gryth1', to: 'local1', frame: 'APPEND',
      label: 'TermIn.Bytes — keystroke @ driver_epoch 1',
      payload: { share: 'ws-razel', gladeId: 'term.pty', key: SID, detail: { termIn: 'Bytes("ls\\n")', driver_epoch: '1' } },
      note: 'Input frames ride the live channel up; the terminal defines a TermIn union (Bytes | Winch | Signal) in ChannelData, every frame stamped with the sender’s driver_epoch (D9 §3) — the fence.',
      docRef: `${GT} §3 (D9)`,
    },
    {
      state: 'J3', phase: 'TK1', kind: 'message', from: 'local1', to: 'peer1', frame: 'APPEND',
      label: 'forward TermIn up the channel',
      payload: { share: 'ws-razel', gladeId: 'term.pty', key: SID, detail: { driver_epoch: '1' } },
      note: 'The node forwards the input 1:1 to the pty host (the P3.S4 channel route).',
      docRef: `${GT} §3`,
    },
    {
      state: 'C4', phase: 'TK1', kind: 'internal', from: 'peer1', frame: 'PROVIDE',
      label: 'epoch check → ACCEPT + execute',
      payload: { detail: { fence: 'frame driver_epoch 1 == authoritative driver_epoch 1', action: 'write to pty; emit TermOut' } },
      note: 'The provider compares the frame’s driver_epoch to the authoritative slot epoch. Equal → the keystroke executes and output appends to scrollback.',
      docRef: `${GT} §3/§4`,
      sets: { peer1: { 'termout ws-razel/term.scrollback': '418 lines · gen 1 · cursor 418' } },
    },
    {
      state: 'C5', phase: 'TK1', kind: 'message', from: 'peer1', to: 'local1', frame: 'OPS',
      label: 'TermOut down the channel', response: true,
      payload: { share: 'ws-razel', gladeId: 'term.pty', key: SID, detail: { records: 'TermOut{gen 1, offset 412..418}' } },
      note: 'Output flows back on the same channel.',
      sets: { local1: { 'replica ws-razel/term.pty': 'TermOut[..418]' } },
    },
    {
      state: 'C6', phase: 'TK1', kind: 'message', from: 'local1', to: 'gryth1', frame: 'OPS',
      label: 'output to driver (watchers share the space)', response: true,
      payload: { share: 'ws-razel', gladeId: 'term.pty', key: SID, detail: { commons: 'all watchers share ONE live-output space (D10) — gryth2 sees the same bytes' } },
      note: 'The driver sees its output; the second owner session (gryth2) watches the same commons output space (D10).',
      sets: { gryth1: { view: 'term.pty live — cursor 418 (driver)' } },
    },

    // ---- TK2: atomic driver_epoch handoff ----------------------------------
    {
      state: 'H4', phase: 'TK2', kind: 'internal', from: 'peer1', frame: 'LEASE', variant: 'a',
      variantNote: 'Driver-slot handoff only: driver_epoch advances but the PTY HOST does NOT migrate (grip-lab affinity must_same_provider_until_close). Contrast s-takeover, which moves the ServeClaim to another node. Terminal takeover shifts WHO TYPES, never which box runs the process.',
      label: 'atomic handoff → driver_epoch 1→2',
      payload: { detail: { handoff: 'gryth2 takes the driver slot', epoch: '1 → 2 (atomic, no election)', hostPinned: 'PTY stays on peer1 — non-migratable' } },
      gate: { kind: 'security', label: 'same-owner handoff', status: 'designed', note: 'gryth1→gryth2 is the SAME owner principal — owner-self, no grant (spec §5). A cross-principal driver handoff is stage-2: it needs term.write ≈ shell.exec (AuthzModel §3) plus any cosign rule, not just an epoch.' },
      note: 'Reuse s-takeover’s shape (epoch fence, no election): the driver slot carries a driver_epoch; a second owner session takes over by an atomic advance (epoch+1). The fencing-token move, not STONITH (spec §4; D9/D10).',
      docRef: `${GT} §4 (D9/D10)`,
      sets: {
        peer1: { 'claim pty:s-7a2f': 'held — epoch 2 · driver gryth2', 'provider ws-razel/term.pty': 'sess s-7a2f attached — epoch 2' },
        gryth2: { 'drives pty:s-7a2f': 'epoch 2', view: 'term.pty live (DRIVER — epoch 2)' },
        gryth1: { 'drives pty:s-7a2f': 'epoch 1 (STALE — superseded by epoch 2)' },
      },
    },
    {
      state: 'J3', phase: 'TK2', kind: 'message', from: 'gryth2', to: 'local1', frame: 'APPEND',
      label: 'new driver types @ driver_epoch 2',
      payload: { share: 'ws-razel', gladeId: 'term.pty', key: SID, detail: { termIn: 'Bytes(":q\\n")', driver_epoch: '2' } },
      note: 'The new driver’s frames carry epoch 2 — the current slot epoch.',
      docRef: `${GT} §3`,
    },
    {
      state: 'C4', phase: 'TK2', kind: 'internal', from: 'peer1', frame: 'PROVIDE',
      label: 'epoch 2 == current → ACCEPT',
      payload: { detail: { fence: 'frame driver_epoch 2 == authoritative driver_epoch 2', action: 'execute; emit TermOut' } },
      note: 'The forwarded frame matches the current epoch and executes — the new driver is live.',
      docRef: `${GT} §3/§4`,
      sets: { peer1: { 'termout ws-razel/term.scrollback': '424 lines · gen 1 · cursor 424' } },
    },

    // ---- TK3: the stale driver is fenced off the epoch ---------------------
    {
      state: 'J3', phase: 'TK3', kind: 'message', from: 'gryth1', to: 'local1', frame: 'APPEND',
      label: 'stale buffered TermIn @ driver_epoch 1',
      payload: { share: 'ws-razel', gladeId: 'term.pty', key: SID, detail: { termIn: 'Bytes("rm -rf .\\n")', driver_epoch: '1', why: 'buffered by gryth1 BEFORE it learned of the handoff' } },
      note: 'The old driver had bytes queued at epoch 1 (it has not yet seen the handoff). This is exactly the frame the fence must reject.',
      docRef: `${GT} §4`,
    },
    {
      state: 'J3', phase: 'TK3', kind: 'message', from: 'local1', to: 'peer1', frame: 'APPEND',
      label: 'forwarded up the channel',
      payload: { share: 'ws-razel', gladeId: 'term.pty', key: SID, detail: { driver_epoch: '1' } },
      note: 'The node forwards it blind — the fence lives at the authority, at execution time (AuthzModel §1).',
      docRef: `${AZ} §1`,
    },
    {
      state: 'E5', phase: 'TK3', kind: 'message', from: 'peer1', to: 'local1', frame: 'STATUS',
      label: 'FENCE: epoch 1 < 2 → fail closed',
      payload: { share: 'ws-razel', gladeId: 'term.pty', key: SID, detail: { fence: 'frame driver_epoch 1 < authoritative driver_epoch 2', outcome: 'REJECTED — 0 bytes written to the pty', semantics: 'fencing token (not STONITH); the buffered bytes never execute' } },
      note: 'The stale frame fails closed off the epoch. termout is UNCHANGED — the destructive buffered command never runs. Gaps/denials are EXPLICIT typed outcomes on the stream, never silent drops (D9 §3).',
      docRef: `${GT} §4 (D9/D10)`,
      sets: { peer1: { 'fenced pty:s-7a2f': 'gryth1 epoch 1 rejected — 0 bytes executed' } },
    },
    {
      state: 'E5', phase: 'TK3', kind: 'message', from: 'local1', to: 'gryth1', frame: 'STATUS',
      label: 'rejection surfaced to the old driver',
      payload: { share: 'ws-razel', gladeId: 'term.pty', key: SID, detail: { reason: 'no longer the driver (epoch 1 < 2)' } },
      note: 'The old driver learns it lost the slot — an appropriate typed message, not a spinner and not a silent drop. It demotes.',
      docRef: `${GT} §4`,
      sets: { gryth1: { 'drives pty:s-7a2f': 'none — lost driver (stale epoch)', view: 'input rejected — no longer the driver' } },
    },
  ],
};

// -----------------------------------------------------------------------------
// s-term-remote-denied — owner-only / local-only by MECHANISM (spec §5; D10)
// -----------------------------------------------------------------------------
export const S_TERM_REMOTE_DENIED: Scenario = {
  id: 's-term-remote-denied',
  stage: 1,
  title: 'Remote attach denied — no-advertise + context identity',
  summary:
    'A local terminal session is never forwarded or advertised across the mesh, so a remote caller’s node finds NO route to it. Even spelling the owner fingerprint in the payload fails: identity is the B3 ProviderCallContext, not a payload claim. Owner-only holds BEFORE any stage-2 grant.',

  actors: pick('gryth1', 'local1', 'guest1', 'local2'),

  initial: {
    gryth1: { session: 'local1 (open)', view: 'terminal live (owner)' },
    local1: {
      'session gryth1': 'open',
      serving: 'ws-razel terminal via grazel (local authority)',
      'provider ws-razel/term.pty': 'sess s-7a2f attached — epoch 1',
      'claim pty:s-7a2f': 'held — epoch 1 · driver gryth1',
      'termout ws-razel/term.scrollback': '412 lines · gen 1 · cursor 412',
      'sub ws-razel/term.pty{s-7a2f}': 'gryth1',
    },
    // The remote caller is a DIFFERENT principal on a DIFFERENT node.
    guest1: { session: 'local2 (open)', view: 'own workspace' },
    local2: { 'session guest1': 'open', 'fold home': 'ws-razel entry — but NO term.* ServeClaim (local sessions are not advertised)' },
  },

  phases: [
    { id: 'RD1', label: 'Local, un-advertised', summary: 'The owner’s terminal session is served locally and advertised nowhere — no cross-peer ServeClaim.' },
    { id: 'RD2', label: 'Remote attach attempt', summary: 'A remote caller (another principal) tries term.open { attach } via its own node.' },
    { id: 'RD3', label: 'No route → fail closed', summary: 'The remote node’s fold has no advertised host for the session — routing dies, denied as data.' },
    { id: 'RD4', label: 'Masquerade fails', summary: 'Spelling the owner fingerprint in the payload is inert: identity is bound from the B3 context.' },
  ],

  steps: [
    // ---- RD1: the local session exists and is advertised NOWHERE ------------
    {
      state: 'C4', phase: 'RD1', kind: 'internal', from: 'local1', frame: 'PROVIDE',
      label: 'serve locally, advertise nothing',
      payload: { detail: { serves: 'term.pty + term.scrollback to the owner’s LOCAL sessions (keyed s-7a2f)', advertise: 'NONE — no cross-peer ServeClaim; the supplier never forwards a local session (D10)', id: 'session_id is unguessable — possession alone grants nothing' } },
      note: 'Local-only holds by MECHANISM (spec §5, §10 answered): the supplier neither forwards nor advertises a local session across the mesh, and the session_id is unguessable. This is real BEFORE the term.read/term.write grant CHECKS (those are stage-2).',
      docRef: `${GT} §5/§10 (D10)`,
      // selfKeyBind vocab: the owner’s session key bound to the self zone.
      sets: { local1: { 'advertise ws-razel/term.pty{s-7a2f}': 'none — not forwarded/advertised (local-only, D10)', 'selfkey self:gianni': 'gryth1 bound — fp:1a2b' } },
    },
    {
      state: 'A5', phase: 'RD1', kind: 'message', from: 'local1', to: 'gryth1', frame: 'OPS',
      label: 'owner receives live output',
      payload: { share: 'ws-razel', gladeId: 'term.pty', key: SID, detail: { records: 'TermOut{gen 1, offset ..412}' } },
      note: 'The session works — for the owner, locally. INV-2 backs this: local1 holds a sub naming gryth1. There simply is no path off this box for it.',
      docRef: `${GT} §5`,
      sets: { gryth1: { view: 'terminal live (owner, local)' } },
    },

    // ---- RD2: the remote caller tries to attach -----------------------------
    {
      state: 'D1', phase: 'RD2', kind: 'message', from: 'guest1', to: 'local2', frame: 'EXCHANGE',
      label: 'remote term.open { attach: session_id }',
      payload: { share: 'ws-razel', gladeId: 'term.open', shape: 'exchange', verb: 'term.open', correlationId: 'x-rd-1', detail: { attach: SID, caller: 'guest1 / self:mallory (a DIFFERENT principal, DIFFERENT node)', how: 'session_id string possessed but not owned' } },
      note: 'A remote caller attempts to reach the local session, having scraped a session_id. Possession of the id is the ONLY thing they have — and by D10 that grants nothing.',
      docRef: `${GT} §5/§8 (D10)`,
      sets: { local2: { 'pending x-rd-1': 'guest1 → attach s-7a2f', 'selfkey self:mallory': 'guest1 bound — fp:9f9f' } },
    },

    // ---- RD3: the remote node has no route ----------------------------------
    {
      state: 'E2', phase: 'RD3', kind: 'internal', from: 'local2', frame: 'ROUTE',
      label: 'resolve host for s-7a2f → NONE',
      payload: { share: 'ws-razel', gladeId: 'term.open', key: SID, detail: { lookup: 'home-share fold on local2', result: 'NO ServeClaim, NO advertised host for the session — never forwarded across the mesh (D10)' } },
      gate: { kind: 'routing', label: 'no advertised host', status: 'designed', note: 'The local-only mechanism is ANSWERED (spec §10): no-forward/no-advertise + unguessable session_id. There is nothing in local2’s fold to route to — not a policy denial, an ABSENCE of a route.' },
      note: 'Routing dies at the fold: a local session that was never advertised has no entry anywhere but its own host. Contrast s-discovery E2 (expired claim) — here there was never a claim to expire.',
      docRef: `${GT} §5/§10 (D10)`,
      sets: { local2: { 'route term.open{s-7a2f}': 'NONE — no advertised host (local-only)' } },
    },
    {
      state: 'E5', phase: 'RD3', kind: 'message', from: 'local2', to: 'guest1', frame: 'STATUS',
      label: 'attach denied — no route',
      payload: { share: 'ws-razel', gladeId: 'term.open', key: SID, detail: { outcome: 'DENIED — no route to session s-7a2f', reason: 'possession of a session_id alone grants nothing (D10)' } },
      note: 'Denial is data, not an exception. Owner-only/local-only proven by mechanism: the remote caller cannot even find the session, let alone attach.',
      docRef: `${GT} §5/§8 (D10)`,
      sets: { local2: { 'pending x-rd-1': null }, guest1: { view: 'attach denied — no route (session not advertised)' } },
    },

    // ---- RD4: even the payload-principal masquerade is inert -----------------
    {
      state: 'D1', phase: 'RD4', kind: 'message', from: 'guest1', to: 'local2', frame: 'EXCHANGE', variant: 'a',
      variantNote: 'Payload-principal masquerade: the caller now writes the OWNER fingerprint (fp:1a2b) into the request DTO, trying to be seen as the local owner.',
      label: 'term.open { attach, principal: fp:1a2b (SPOOFED) }',
      payload: { share: 'ws-razel', gladeId: 'term.open', shape: 'exchange', verb: 'term.open', correlationId: 'x-rd-2', detail: { attach: SID, 'payload.principal': 'fp:1a2b (the owner’s fingerprint, SPELLED into the body)' } },
      note: 'The sharpest attack: spell the owner’s identity in the payload. The spec forbids trusting it — ownership comes from the node-authenticated context, never a payload field (spec §4).',
      docRef: `${GT} §4 (B3)`,
      sets: { local2: { 'pending x-rd-2': 'guest1 → attach s-7a2f (payload claims fp:1a2b)' } },
    },
    {
      state: 'S7', phase: 'RD4', kind: 'internal', from: 'local2', frame: 'ROUTE',
      label: 'bind principal from the B3 context',
      payload: { detail: { bound: 'guest1 / self:mallory (fp:9f9f) — from the certified device key', ignored: 'payload.principal fp:1a2b DISCARDED', rule: 'identity is the B3 ProviderCallContext, delivered BESIDE the request DTO — never a payload field' } },
      gate: { kind: 'security', label: 'context identity (B3)', status: 'designed', note: 'The requester principal is the node-authenticated context (B3/B4): a remote caller cannot spell its way into being the local owner. Authn only — binds who is asking, not what they may do.' },
      note: 'The trust seam binds the session principal from the authenticated context, discarding the spoofed payload fingerprint. The masquerade is inert at the identity seam — independently of the missing route.',
      docRef: `${GT} §4/§5 (B3/B4)`,
      sets: { local2: { 'bind x-rd-2': 'mallory fp:9f9f (from device cert) — payload fp:1a2b IGNORED' } },
    },
    {
      state: 'E5', phase: 'RD4', kind: 'message', from: 'local2', to: 'guest1', frame: 'STATUS',
      label: 'masquerade denied',
      payload: { share: 'ws-razel', gladeId: 'term.open', key: SID, detail: { outcome: 'DENIED', reasons: '(1) bound principal is mallory, not the owner; (2) still no route to the un-advertised session' } },
      note: 'Owner-only holds two ways over: no route to reach it (no-advertise), and no way to BE the owner by spelling one (context identity). Both are stage-1 mechanism — before any grant check (spec §5/§7).',
      docRef: `${GT} §4/§5 (D10 · B3)`,
      sets: { local2: { 'pending x-rd-2': null }, guest1: { view: 'masquerade denied — identity is the B3 context, not a payload field' } },
    },
  ],
};
