// Window delivery: the viewer asks for lines 3000+100 of a big build log and
// gets them IMMEDIATELY, while the rest backfills behind — the snappy path.
import type { Scenario } from './types';
import { pick } from './actors';

const SUB_V1 = 'GladeSubstrateV1';

export const S_WINDOW: Scenario = {
  id: 's-window',
  stage: 1,
  title: 'Window viewer — snappy first paint',
  summary: 'A windowed subscription (lines 3000+100) ships at interactive priority while the full log backfills at bulk priority.',

  actors: pick('gryth1', 'local1', 'peer1'),

  initial: {
    gryth1: { session: 'local1 (open)' },
    local1: { 'session gryth1': 'open', 'fold home': 'claim: ws-razel@peer1', links: 'peer1 (iroh)' },
    peer1: { serving: 'ws-razel via grazel', razel: 'build RUNNING — log at 41,200 lines' },
  },

  phases: [
    { id: 'W1', label: 'Window ask', summary: 'The viewer names a window, not the whole log.' },
    { id: 'W2', label: 'Snappy serve', summary: 'The window preempts everything — interactive priority.' },
    { id: 'W3', label: 'Backfill + live tail', summary: 'The rest arrives at bulk priority; the tail keeps appending.' },
  ],

  steps: [
    {
      state: 'W1', phase: 'W1', kind: 'message', from: 'gryth1', to: 'local1', frame: 'SUBSCRIBE',
      label: 'window subscribe: build.log[3000..3100]',
      payload: { share: 'ws-razel', gladeId: 'build.log', key: '{from:3000, len:100}', shape: 'window' },
      note: 'CONTENTIOUS — is `window` a new delivery shape, or a keyed PROJECTION over the log shape (the reassembler pattern: viewers declare interest regions, never see deltas)? This trace assumes shape; the reassembler §7 machinery is the alternative. Feeds back into taut-shape after it proves out.',
      docRef: `${SUB_V1} §7 · taut-shape (log first, window candidate)`,
      sets: { gryth1: { subs: 'ws-razel/build.log[3000+100]' } },
    },
    {
      state: 'C2', phase: 'W1', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'route to provider',
      payload: { share: 'ws-razel', detail: { answer: 'peer1 (claim valid)', window: 'params ride the key' } },
      gate: { kind: 'routing', label: 'ServeClaim lookup', status: 'designed', note: 'Window params are just the canonical key — routing is unchanged.' },
      note: 'Nothing special routes a window; the key is opaque here.',
      docRef: 'GladeWorkspaceDirectory §4',
      sets: { local1: { 'route ws-razel': 'peer1' } },
    },
    {
      state: 'C3', phase: 'W1', kind: 'message', from: 'local1', to: 'peer1', frame: 'SUBSCRIBE',
      label: 'forward window interest',
      payload: { share: 'ws-razel', gladeId: 'build.log', key: '{from:3000, len:100}', shape: 'window' },
      gate: { kind: 'capability', label: 'capability check', status: 'stub-allow-all', note: 'Same enforcement point as any subscribe.' },
      note: 'The provider learns the window bounds — it can serve the viewport without touching the rest.',
      docRef: 'SecurityModelAnalysisPrompt §3.4',
      sets: { local1: { 'sub ws-razel/build.log': 'gryth1' }, peer1: { 'sub ws-razel/build.log': 'local1 [3000+100]' } },
    },
    {
      state: 'W2', phase: 'W2', kind: 'message', from: 'peer1', to: 'local1', frame: 'OPS',
      label: 'window ships FIRST', response: true,
      payload: { share: 'ws-razel', gladeId: 'build.log', key: '{from:3000, len:100}', detail: { priority: 'INTERACTIVE — preempts log backfill', size: '100 lines, one chunk' } },
      note: 'The strict-priority scheduler exists for exactly this: streams/exchanges/windows preempt bulk backfill; values conflate in queue.',
      docRef: `${SUB_V1} §6 (priority scheduler)`,
      sets: { local1: { replica: 'build.log[3000..3100]' } },
    },
    {
      state: 'W2', phase: 'W2', kind: 'message', from: 'local1', to: 'gryth1', frame: 'OPS',
      label: 'viewport painted', response: true,
      payload: { share: 'ws-razel', gladeId: 'build.log', key: '{from:3000, len:100}' },
      note: 'First paint latency = one window round-trip, independent of log size. THAT is the snappy experience.',
      sets: { gryth1: { view: 'log[3000..3100] painted' } },
    },
    {
      state: 'W3', phase: 'W3', kind: 'message', from: 'peer1', to: 'local1', frame: 'OPS',
      label: 'backfill trails at bulk priority', response: true,
      payload: { share: 'ws-razel', gladeId: 'build.log', detail: { priority: 'BULK — chunked, size-capped', progress: '0..41,200 lines streaming' } },
      note: 'The full log replicates BEHIND the window so scrolling becomes local. Backfill never delays the viewport — head-of-line blocking is the enemy this design was built against.',
      docRef: `${SUB_V1} §6`,
      sets: { local1: { replica: 'build.log[0..41,200] (backfilling)' } },
    },
    {
      state: 'C5', phase: 'W3', kind: 'message', from: 'peer1', to: 'local1', frame: 'OPS',
      label: 'live tail appends',
      payload: { share: 'ws-razel', gladeId: 'build.log', detail: { ops: '+220 lines — build still running' } },
      note: 'The log grows while it backfills; append-only makes the interleave safe (causal order per origin).',
      sets: { peer1: { razel: 'build RUNNING — log at 41,420 lines' } },
    },
    {
      state: 'B9', phase: 'W3', kind: 'message', from: 'local1', to: 'gryth1', frame: 'OPS',
      label: 'tail to viewer', response: true,
      payload: { share: 'ws-razel', gladeId: 'build.log', detail: { ui: 'viewer may auto-follow the tail — a UI choice, not protocol' } },
      note: 'Scroll-to-window after this is a LOCAL operation against the replica: the next window ask never leaves the machine.',
      sets: { gryth1: { view: 'log tail following (local scrollback growing)' } },
    },
  ],
};
