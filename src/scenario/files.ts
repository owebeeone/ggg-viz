// glade-files — the file tree, windowed reads, and the blob strategy, as typed
// traces. Ground truth: dev-docs/glade/suppliers/glade-files.md (full spec v1,
// GLP-0006 rulings D6/D7/D8/D12 + B3/B4). Each scenario proves EXACTLY one
// ruling as folded state + steps: the window contract (D8), the one-exchange
// blob fetch with delivery-time authz (D6), compare-and-replace writes (D12),
// and per-directory ws.tree keying (D7) — the positive path AND the deny arm
// wherever the claim has one.
import type { Scenario } from './types';
import { pick } from './actors';

const GF = 'glade-files';
const SUB_V1 = 'GladeSubstrateV1';
const AZ = 'GladeAuthzModel';

// ---------------------------------------------------------------------------
// s-file-window (RULED — D8): the FULL mutable typed window. Identity is
// {workspace_id, path, revision}; the {from,len} range is INTEREST over that
// identity, not a new binding. glial owns reassembly and serves ONE coherent
// generation — a window that would splice two generations is HELD and re-driven,
// never delivered mixed. Extends s-window (window.ts) from an append log to a
// mutable file, and proves size-independent first paint.
// ---------------------------------------------------------------------------
export const S_FILE_WINDOW: Scenario = {
  id: 's-file-window',
  stage: 1,
  title: 'Mutable-file window — one generation, never mixed',
  summary:
    'A window over {ws1, src/big.rs, rev 7} paints in one round-trip; a save advances the revision and the reassembler re-drives — the reader never observes a mixed generation (D8).',

  actors: pick('gryth1', 'local1', 'peer1'),

  initial: {
    gryth1: { session: 'local1 (open)' },
    local1: { 'session gryth1': 'open', 'fold home': 'claim: ws1@peer1', links: 'peer1 (iroh)' },
    peer1: {
      serving: 'ws1 via grazel',
      'ws.files': 'src/big.rs — 68,000 lines @ revision 7 (authoritative snapshot)',
    },
  },

  phases: [
    { id: 'FW1', label: 'Window ask over identity', summary: 'The viewer names a range over {ws, path, revision} — interest, not a new binding.' },
    { id: 'FW2', label: 'Reassemble + snappy serve', summary: 'glial folds ONE generation; the viewport ships interactive.' },
    { id: 'FW3', label: 'Backfill', summary: 'The full file trails at bulk priority so scrolling stays local.' },
    { id: 'FW4', label: 'Save advances the generation', summary: 'A save bumps the revision; the reassembler re-drives — never a mixed splice.' },
  ],

  steps: [
    {
      state: 'W1', phase: 'FW1', kind: 'message', from: 'gryth1', to: 'local1', frame: 'SUBSCRIBE',
      label: 'window subscribe: src/big.rs [1200+100] @rev 7',
      payload: {
        share: 'ws1', gladeId: 'ws.files', key: '{ws:ws1, path:src/big.rs, rev:7}', shape: 'window',
        detail: { range: '{from:1200, len:100}', identity: 'the {from,len} range is INTEREST over identity, NOT a new binding' },
      },
      note: 'D8: window identity is {workspace_id, path, revision}; the line/byte range is an interest over that identity, so routing keys on identity and the range only refines interest. The revision rides identity — a window always names WHICH generation it reads.',
      docRef: `${GF} §2.1 (RULED — D8)`,
      sets: { gryth1: { subs: 'ws1/ws.files{src/big.rs@7}[1200+100]', 'window ws1/ws.files': 'gen 7 · [1200+100]' } },
    },
    {
      state: 'C2', phase: 'FW1', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'route on identity {ws1, src/big.rs}',
      payload: { share: 'ws1', detail: { answer: 'peer1 (claim valid)', keying: 'routes on the identity; the range is opaque to the router' } },
      gate: { kind: 'routing', label: 'ServeClaim lookup', status: 'designed', note: 'Routing keys on the window identity — the interest range is not a routing input.' },
      note: 'Nothing special routes a window: the identity picks the provider, the range rides the key.',
      docRef: `${GF} §2.1 · GladeWorkspaceDirectory §4`,
      sets: { local1: { 'route ws1': 'peer1' } },
    },
    {
      state: 'C3', phase: 'FW1', kind: 'message', from: 'local1', to: 'peer1', frame: 'SUBSCRIBE',
      label: 'forward window interest',
      payload: { share: 'ws1', gladeId: 'ws.files', key: '{ws:ws1, path:src/big.rs, rev:7}', shape: 'window', detail: { range: '[1200+100]' } },
      gate: { kind: 'capability', label: 'capability check', status: 'stub-allow-all', note: 'Commons read — the same enforcement point as any subscribe (stage-1 allow-all; AZ-1 path scoping is stage-2).' },
      note: 'The provider learns the window bounds — it can serve the viewport without materializing the rest.',
      docRef: `${GF} §7`,
      sets: { local1: { 'sub ws1/ws.files': 'gryth1' }, peer1: { 'sub ws1/ws.files': 'local1 [1200+100]' } },
    },
    {
      state: 'W2', phase: 'FW2', kind: 'message', from: 'peer1', to: 'local1', frame: 'OPS',
      label: 'region ships FIRST — interactive', response: true,
      payload: { share: 'ws1', gladeId: 'ws.files', key: '{ws:ws1, path:src/big.rs, rev:7}', detail: { priority: 'INTERACTIVE — preempts backfill', size: '100 lines, one generation' } },
      note: 'The strict-priority scheduler (already built) ships the window at interactive priority; first-paint latency = one window round-trip, independent of the 68k-line file size.',
      docRef: `${GF} §2.2 · ${SUB_V1} §6`,
      sets: { local1: { replica: 'src/big.rs[1200..1300] @rev 7' } },
    },
    {
      state: 'A4', variant: 'a',
      variantNote: 'glial reassembler: folds the interest region into ONE generation-stamped snapshot (rev 7); it FILLS the typed window and never splices two generations.',
      phase: 'FW2', kind: 'internal', from: 'local1', frame: 'FOLD',
      label: 'glial reassembles ONE generation',
      payload: { share: 'ws1', detail: { owner: 'glial owns REASSEMBLY (the previously-unowned reassembler — D8)', generation: 'rev 7, coherent' } },
      note: 'D8 ownership split: base glade owns window request/routing/generation, glial owns REASSEMBLY, glade-files owns the authoritative snapshot. The reassembler serves ONE coherent generation, tagged by revision.',
      docRef: `${GF} §2.4 (RULED — D8)`,
      sets: { local1: { 'window ws1/ws.files': 'gen 7 · [1200+100] (reassembled, coherent)' } },
    },
    {
      state: 'W2', phase: 'FW2', kind: 'message', from: 'local1', to: 'gryth1', frame: 'OPS',
      label: 'viewport painted @rev 7', response: true,
      payload: { share: 'ws1', gladeId: 'ws.files', key: '{ws:ws1, path:src/big.rs, rev:7}', detail: { paint: 'one round-trip', generation: '7 — uniform, never mixed' } },
      note: 'First paint is independent of file size — the outline’s promise. The window is one uniform typed contract and the consumer sees exactly generation 7.',
      docRef: `${GF} §2.2`,
      sets: { gryth1: { view: 'src/big.rs[1200..1300] painted @gen 7' } },
    },
    {
      state: 'W3', phase: 'FW3', kind: 'message', from: 'peer1', to: 'local1', frame: 'OPS',
      label: 'full file backfills at BULK', response: true,
      payload: { share: 'ws1', gladeId: 'ws.files', detail: { priority: 'BULK — chunked, size-capped', progress: '0..68,000 lines trailing the viewport' } },
      note: 'The body replicates BEHIND the window so the next window ask never leaves the machine — head-of-line blocking is the enemy this design was built against.',
      docRef: `${GF} §2.3 · ${SUB_V1} §6`,
      sets: { local1: { replica: 'src/big.rs[0..68,000] @rev 7 (backfilling)' } },
    },
    {
      state: 'D3', phase: 'FW4', kind: 'internal', from: 'peer1', frame: 'PROVIDE',
      label: 'a save lands — revision 7 → 8',
      payload: { share: 'ws1', detail: { write: 'files.write replace (another editor)', effect: 'authoritative snapshot advances rev 7 → 8' } },
      note: 'An edit advances the revision/generation (§2.5). The workspace file is the at-rest truth (D13) — glade-files owns the authoritative snapshot the reader re-drives against.',
      docRef: `${GF} §2.5 · §4.2 (RULED — D13)`,
      sets: {
        peer1: {
          'ws.files': 'src/big.rs — 68,003 lines @ revision 8 (authoritative snapshot)',
          'generation ws1/src/big.rs': 'gen 8 (save: 3 lines inserted)',
          'window ws1/ws.files': 'gen 8 · [full]',
        },
      },
    },
    {
      state: 'A4', variant: 'b',
      variantNote: 'generation boundary: rather than splicing gen 7 (viewport) with gen 8 (backfill) into a MIXED window, the reassembler HOLDS and re-drives the SAME interest against gen 8 — a consumer must never observe a mixed generation.',
      phase: 'FW4', kind: 'internal', from: 'local1', frame: 'FOLD',
      label: 'reassembler refuses the splice — re-drives at gen 8',
      payload: { share: 'ws1', detail: { held: 'the in-flight window that would mix gen 7 + gen 8', action: 're-drive interest against gen 8, cursor-stably', rule: 'never delivered mixed (§2.4)' } },
      note: 'THE coherence claim: a window that would splice two generations is held or re-driven, NEVER delivered mixed. The reader re-drives its same interest against the new generation cursor-stably — an edit is a re-drive, never a splice.',
      docRef: `${GF} §2.4/§2.5 (RULED — D8)`,
      sets: { local1: { 'window ws1/ws.files': 'gen 8 · [1200+100] (re-driven, coherent — no splice)' } },
    },
    {
      state: 'W2', variant: 'c',
      variantNote: 'the viewport re-paints at gen 8 as ONE generation — cursor-stable, never a mixed frame.',
      phase: 'FW4', kind: 'message', from: 'local1', to: 'gryth1', frame: 'OPS',
      label: 'viewport re-drives @rev 8', response: true,
      payload: { share: 'ws1', gladeId: 'ws.files', key: '{ws:ws1, path:src/big.rs, rev:8}', detail: { generation: '8 — uniform', mixed: 'never observed across viewport + backfill' } },
      note: 'The reader’s interest is re-satisfied against the new generation as one coherent window; because identity carried the revision, the window always named WHICH generation it reads. The consumer transitions 7 → 8, never a spliced 7·8 frame.',
      docRef: `${GF} §2.1/§2.4`,
      sets: { gryth1: { view: 'src/big.rs[1200..1300] painted @gen 8 (never saw a mixed generation)', 'window ws1/ws.files': 'gen 8 · [1200+100]' } },
    },
  ],
};

// ---------------------------------------------------------------------------
// s-blob-fetch (RULED — D6): ws.blob.fetch is ONE declared exchange naming a
// binding/path + revision + BlobRef; authz is RE-RESOLVED at DELIVERY. A BlobRef
// replicates as a small record while the bytes do NOT ride the fold; an
// authorized viewer fetches over a bounded carrier and a second authorized
// viewer dedupes for free — but a caller holding the HASH with no authorized
// path reference is DENIED at delivery (hash = integrity, not authority; the
// bearer-token shape is dead).
// ---------------------------------------------------------------------------
export const S_BLOB_FETCH: Scenario = {
  id: 's-blob-fetch',
  stage: 1,
  title: 'Blob fetch — one exchange, delivery-time authz',
  summary:
    'A BlobRef rides an ordinary ws.tree record (bytes stay off the fold); an authorized fetch ships over a bounded carrier and dedupes for a second viewer, but a bare hash with no authorized path reference is DENIED at delivery (D6).',

  actors: pick('gryth1', 'gryth3', 'guest1', 'local1', 'peer1'),

  initial: {
    gryth1: { session: 'local1 (open)' },
    gryth3: { session: 'local1 (open, second authorized viewer)' },
    guest1: { session: 'local1 (open, principal: teammate)', holds: 'the hash sha256:img-abc (seen in a shared listing) — but no path grant' },
    local1: { 'fold home': 'claim: ws1@peer1', links: 'peer1 (iroh)' },
    peer1: { serving: 'ws1 via grazel', 'blob store': 'iroh-blobs — content-addressed' },
  },

  phases: [
    { id: 'BF1', label: 'BlobRef replicates, bytes don’t', summary: 'A content-addressed ref rides a record; the bytes stay off the fold plane.' },
    { id: 'BF2', label: 'Authorized fetch — one exchange', summary: 'ws.blob.fetch re-resolves + authorizes at delivery, ships over a bounded carrier.' },
    { id: 'BF3', label: 'Dedupe — second authorized viewer', summary: 'Content-addressing serves the same hash from cache, no re-fetch.' },
    { id: 'BF4', label: 'Deny — hash ≠ authority', summary: 'A bare hash with no authorized path reference is refused at delivery.' },
  ],

  steps: [
    {
      state: 'K1', phase: 'BF1', kind: 'internal', from: 'peer1', frame: 'APPEND',
      label: 'ws.tree entry carries a BlobRef',
      payload: { share: 'ws1', gladeId: 'ws.tree', detail: { record: 'assets/logo.png metadata', blobRef: 'BlobRef{hash:sha256:img-abc, size:4MB, media:image/png}', plane: 'a small, verifiable, dedupable ref on the FOLD (control) plane' } },
      note: 'D6: a blob rides as a content-addressed REFERENCE in an ordinary record; the record replicates everywhere cheaply, exactly like any op — the bytes never ride the fold as ops-in-chains.',
      docRef: `${GF} §3.1 (RULED — D6)`,
      sets: { peer1: { 'blob sha256:img-abc': '4 MB · via iroh-blobs — ref only (content out-of-band)' } },
    },
    {
      state: 'B8', phase: 'BF1', kind: 'message', from: 'peer1', to: 'local1', frame: 'OPS',
      label: 'record replicates — bytes do NOT follow',
      payload: { share: 'ws1', gladeId: 'ws.tree', detail: { op: 'BlobRef record', bytes: 'NOT dragged — bytes follow interest + dedupe (lazy)' } },
      note: 'D6: a BlobRef replicating to a node does NOT drag its bytes; only an interested, authorized viewer fetches them. (B8 is heads-driven anti-entropy — not a serve — so no subscription entry is needed.)',
      docRef: `${GF} §3.4`,
      sets: { local1: { 'blob sha256:img-abc': 'ref only — bytes not resident' } },
    },
    {
      state: 'D1', phase: 'BF2', kind: 'message', from: 'gryth1', to: 'local1', frame: 'EXCHANGE',
      label: 'ws.blob.fetch — ONE exchange',
      payload: { share: 'ws1', gladeId: 'ws.blob.fetch', verb: 'ws.blob.fetch', correlationId: 'blob-1', key: '{binding:ws1, path:assets/logo.png, rev:7, ref:sha256:img-abc}', shape: 'exchange' },
      note: 'D6: ws.blob.fetch is ONE declared EXCHANGE — the request NAMES a workspace binding/path + revision + BlobRef, distinct from the §2 window. The bare hash-addressed carrier op (a bearer token) is killed.',
      docRef: `${GF} §3.2 · §6 (RULED — D6)`,
      sets: { gryth1: { 'pending blob-1': 'ws.blob.fetch assets/logo.png' } },
    },
    {
      state: 'D2', phase: 'BF2', kind: 'message', from: 'local1', to: 'peer1', frame: 'EXCHANGE',
      label: 'routed to the blob authority',
      payload: { share: 'ws1', verb: 'ws.blob.fetch', correlationId: 'blob-1', detail: { routed: 'to the claim-holder — exchanges never fan out from caches (1:1 by correlation)' } },
      note: 'The fetch routes 1:1 to the authority holding the workspace binding + blob store.',
      docRef: `${GF} §3.2`,
    },
    {
      state: 'D3', phase: 'BF2', kind: 'internal', from: 'peer1', frame: 'PROVIDE',
      label: 're-resolve + authorize at DELIVERY',
      payload: { share: 'ws1', correlationId: 'blob-1', detail: { reResolve: 'workspace + path re-resolved from the binding', authz: 'principal gianni via gryth1 has an authorized path reference → ALLOW', hash: 'integrity check only — NOT authority' } },
      gate: { kind: 'capability', label: 'delivery-time authz', status: 'designed', note: 'D6: the provider re-resolves the workspace and authorizes the fetch against the B3 principal AT DELIVERY. A content hash proves integrity, not authority.' },
      note: 'Authorization at delivery time — the fetch is checked against the node-authenticated principal, not the caller payload. Even in stage-1 allow-all-commons, the principal must resolve to an authorized path reference.',
      docRef: `${GF} §3.3 (RULED — D6)`,
      sets: { peer1: { 'requester blob-1': 'gianni via gryth1 — authorized path reference' } },
    },
    {
      state: 'D4', phase: 'BF2', kind: 'message', from: 'peer1', to: 'local1', frame: 'EXCHANGE-RESP',
      label: 'bytes over a bounded carrier', response: true,
      payload: { share: 'ws1', correlationId: 'blob-1', detail: { carrier: 'bounded carrier/stream — iroh-blobs (native) / Chunk-frame (browser)', note: 'transport is an impl choice UNDER the bounded-carrier contract' } },
      note: 'The response ships over a bounded carrier/stream channel — NOT a bare hash-addressed carrier op; the specific transport is an impl choice under the contract.',
      docRef: `${GF} §3.2`,
      sets: { local1: { 'blob sha256:img-abc': '4 MB resident — fetched, PINNED in cache (F-GAP10)' } },
    },
    {
      state: 'D5', phase: 'BF2', kind: 'message', from: 'local1', to: 'gryth1', frame: 'EXCHANGE-RESP',
      label: 'bytes delivered to the requester', response: true,
      payload: { share: 'ws1', correlationId: 'blob-1' },
      note: 'The fetch completes at the requesting session; a fetched, referenced blob is pinned in cache (F-GAP10) so scrolling back to it is local.',
      docRef: `${GF} §3.4 · §5 (F-GAP10)`,
      sets: { gryth1: { 'pending blob-1': null, view: 'assets/logo.png rendered (4 MB fetched by hash)' } },
    },
    {
      state: 'D1', phase: 'BF3', kind: 'message', from: 'gryth3', to: 'local1', frame: 'EXCHANGE',
      label: 'second authorized viewer fetches the SAME hash',
      payload: { share: 'ws1', gladeId: 'ws.blob.fetch', verb: 'ws.blob.fetch', correlationId: 'blob-2', key: '{binding:ws1, path:assets/logo.png, rev:7, ref:sha256:img-abc}', shape: 'exchange' },
      note: 'A second authorized viewer of the same content-addressed blob.',
      docRef: `${GF} §3.4`,
      sets: { gryth3: { 'pending blob-2': 'ws.blob.fetch assets/logo.png' } },
    },
    {
      state: 'D3', phase: 'BF3', kind: 'internal', from: 'local1', frame: 'PROVIDE',
      label: 're-resolve authz + content-addressed DEDUPE',
      payload: { share: 'ws1', correlationId: 'blob-2', detail: { authz: 'gryth3 authorized — re-resolved at delivery', dedupe: 'hash already resident → served from cache, NO re-fetch' } },
      gate: { kind: 'capability', label: 'delivery-time authz', status: 'designed', note: 'Delivery-time authz still runs for the second viewer; because content is addressed by hash, an authorized second viewer dedupes for free — the blob analogue of "backfill trails the viewport".' },
      note: 'Authz is per-request, but the bytes are shared: content-addressing means the second authorized viewer dedupes against the resident blob.',
      docRef: `${GF} §3.3/§3.4`,
      sets: { local1: { 'requester blob-2': 'gianni via gryth3 — authorized; deduped from cache' } },
    },
    {
      state: 'D5', phase: 'BF3', kind: 'message', from: 'local1', to: 'gryth3', frame: 'EXCHANGE-RESP',
      label: 'bytes from cache (dedupe)', response: true,
      payload: { share: 'ws1', correlationId: 'blob-2', detail: { source: 'local cache — content-addressed dedupe, zero bytes re-fetched' } },
      note: 'The same content serves the second authorized viewer with no second fetch — dedupe is free under content-addressing.',
      docRef: `${GF} §3.4`,
      sets: { gryth3: { 'pending blob-2': null, view: 'assets/logo.png rendered (deduped — zero bytes re-fetched)' } },
    },
    {
      state: 'D1', phase: 'BF4', kind: 'message', from: 'guest1', to: 'local1', frame: 'EXCHANGE',
      label: 'guest holds the HASH — but no path grant',
      payload: { share: 'ws1', gladeId: 'ws.blob.fetch', verb: 'ws.blob.fetch', correlationId: 'blob-3', key: '{ref:sha256:img-abc — bare hash, NO authorized binding/path}', shape: 'exchange' },
      note: 'D6: possession of a hash grants nothing. guest1 saw the hash in a shared listing but has no authorized path reference to the blob — the bearer-token temptation.',
      docRef: `${GF} §3.3`,
      sets: { guest1: { 'pending blob-3': 'ws.blob.fetch sha256:img-abc (bare hash)' } },
    },
    {
      state: 'D2', phase: 'BF4', kind: 'message', from: 'local1', to: 'peer1', frame: 'EXCHANGE',
      label: 'forwarded — the authority decides at delivery',
      payload: { share: 'ws1', verb: 'ws.blob.fetch', correlationId: 'blob-3', detail: { note: 'the node does not honor a bare hash even if the blob is cached nearby — the authority re-resolves' } },
      note: 'Even a cached-nearby blob is not served on a bare hash; the fetch routes to the authority which re-resolves and authorizes.',
      docRef: `${GF} §3.3`,
    },
    {
      state: 'D3', phase: 'BF4', kind: 'internal', from: 'peer1', frame: 'PROVIDE',
      label: 'DENY at delivery — hash ≠ authority',
      payload: { share: 'ws1', correlationId: 'blob-3', detail: { reResolve: 'no workspace binding/path reference for guest1', hash: 'integrity OK — but integrity is not authority', verdict: 'DENIED' } },
      gate: { kind: 'security', label: 'delivery-time authz', status: 'designed', note: 'D6: the bearer-token shape is DEAD — a revoked or unauthorized principal holding the hash is DENIED at delivery. Possession of a valid hash authorizes nothing; authority comes from an authorized path reference the principal does not have.' },
      note: 'The crux deny: the hash proves integrity, so the content would decode — but authority is a separate question and guest1 fails it. This is exactly what kills the bearer-token shape.',
      docRef: `${GF} §3.3 (RULED — D6)`,
      sets: { peer1: { 'requester blob-3': 'teammate via guest1 — NO authorized path reference → DENIED (hash ≠ authority)' } },
    },
    {
      state: 'D4', variant: 'a',
      variantNote: 'delivery-time DENY: ExchangeRes ok:false — no authorized path reference; the hash proved integrity, never authority.',
      phase: 'BF4', kind: 'message', from: 'peer1', to: 'local1', frame: 'EXCHANGE-RESP',
      label: 'deny travels back as data', response: true,
      payload: { share: 'ws1', correlationId: 'blob-3', detail: { ok: 'false', reason: 'no authorized path reference to the blob' } },
      note: 'The denial is data (ExchangeRes ok:false), not an exception and not silent — it routes back by correlation id like any response.',
      docRef: `${GF} §3.3`,
    },
    {
      state: 'D5', variant: 'a',
      variantNote: 'the fetch resolves to a refusal as DATA — remedy: obtain a path grant to the workspace (the hash alone never suffices).',
      phase: 'BF4', kind: 'message', from: 'local1', to: 'guest1', frame: 'EXCHANGE-RESP',
      label: 'denied as data', response: true,
      payload: { share: 'ws1', correlationId: 'blob-3', detail: { result: 'denied', reason: 'hash = integrity, not authority', remedy: 'request a path-scoped grant to the workspace' } },
      note: 'guest1’s fetch fails as data even while holding a valid hash — the claim proven: hash is integrity, not authority; content-addressing dedupes but never authorizes.',
      docRef: `${GF} §3.3 (RULED — D6)`,
      sets: { guest1: { 'pending blob-3': null, view: 'assets/logo.png: DENIED — a hash is not a capability' } },
    },
  ],
};

// ---------------------------------------------------------------------------
// s-file-write (RULED — D12): files.write replace is compare-and-replace against
// an EXPECTED BASE REVISION. A matching base applies and advances the revision;
// a STALE base returns an explicit CONFLICT (ExchangeRes conflict outcome),
// never a silent last-writer-wins. The caller re-reads and retries. glade-editing's
// doc.save delegates INTO this write.
// ---------------------------------------------------------------------------
export const S_FILE_WRITE: Scenario = {
  id: 's-file-write',
  stage: 1,
  title: 'files.write — compare-and-replace, explicit conflict',
  summary:
    'A write with the right expected base applies (4→5); a second writer’s stale base returns an explicit CONFLICT (never silent last-writer-wins); it re-reads and retries against 5 (→6) (D12).',

  actors: pick('gryth1', 'gryth2', 'local1', 'peer1'),

  initial: {
    gryth1: { session: 'local1 (open)', view: 'src/lib.rs @rev 4 (read)' },
    gryth2: { session: 'local1 (open)', view: 'src/lib.rs @rev 4 (read — same base)' },
    local1: { 'fold home': 'claim: ws1@peer1', links: 'peer1 (iroh)' },
    peer1: { serving: 'ws1 via grazel', wc: 'working copy + lock — src/lib.rs @ revision 4', 'generation ws1/src/lib.rs': 'gen 4' },
  },

  phases: [
    { id: 'WR1', label: 'Write at base 4 → 5', summary: 'The expected base matches; the replace applies under the lock.' },
    { id: 'WR2', label: 'Stale write → CONFLICT', summary: 'A second writer’s base moved under it — explicit conflict, no silent overwrite.' },
    { id: 'WR3', label: 'Re-read + retry → 6', summary: 'Compare-and-replace makes the conflict recoverable, not fatal.' },
  ],

  steps: [
    {
      state: 'D1', phase: 'WR1', kind: 'message', from: 'gryth1', to: 'local1', frame: 'EXCHANGE',
      label: 'files.write replace — expected base 4',
      payload: { share: 'ws1', gladeId: 'files.write', verb: 'files.write:replace', correlationId: 'w-1', key: '{path:src/lib.rs, verb:replace, expectedBase:4}', shape: 'exchange' },
      note: 'D12: files.write carries coarse/structural verbs (replace/create/delete/rename) and takes an EXPECTED BASE REVISION plus any required lock/lease. glade-editing’s doc.save delegates into this — glade-files OWNS the write.',
      docRef: `${GF} §4.1 (RULED — D12)`,
      sets: { gryth1: { 'pending w-1': 'files.write replace src/lib.rs @base 4' } },
    },
    {
      state: 'D2', phase: 'WR1', kind: 'message', from: 'local1', to: 'peer1', frame: 'EXCHANGE',
      label: 'routed to the claim-holder (lock held there)',
      payload: { share: 'ws1', verb: 'files.write:replace', correlationId: 'w-1', detail: { authority: 'authority: share — writes go through an exchange to the claim-holder (SubstrateV1 §3)' } },
      note: 'The write is authority: share — it routes to the node holding the workspace.lock, the real single-writer resource.',
      docRef: `${GF} §4.1`,
    },
    {
      state: 'D3', phase: 'WR1', kind: 'internal', from: 'peer1', frame: 'PROVIDE',
      label: 'compare-and-replace: base 4 == current 4 → APPLY',
      payload: { share: 'ws1', correlationId: 'w-1', detail: { compare: 'expected 4 == current 4', action: 'replace applied under lock', revision: '4 → 5' } },
      note: 'D12: compare-and-replace — the expected base matches the current revision, so the write applies against the working copy (lock held) and advances the revision.',
      docRef: `${GF} §4.1`,
      sets: { peer1: { wc: 'working copy + lock — src/lib.rs @ revision 5', 'generation ws1/src/lib.rs': 'gen 5 (replace by gryth1)' } },
    },
    {
      state: 'D4', phase: 'WR1', kind: 'message', from: 'peer1', to: 'local1', frame: 'EXCHANGE-RESP',
      label: 'ok:true — new revision 5', response: true,
      payload: { share: 'ws1', correlationId: 'w-1', detail: { ok: 'true', newRevision: '5' } },
      note: 'Success carries the new revision so the caller can rebase subsequent edits.',
      docRef: `${GF} §4.1`,
    },
    {
      state: 'D5', phase: 'WR1', kind: 'message', from: 'local1', to: 'gryth1', frame: 'EXCHANGE-RESP',
      label: 'write applied @rev 5', response: true,
      payload: { share: 'ws1', correlationId: 'w-1' },
      note: 'gryth1’s write completes; the file is now at revision 5.',
      docRef: `${GF} §4.1`,
      sets: { gryth1: { 'pending w-1': null, view: 'src/lib.rs @rev 5 (my write applied)' } },
    },
    {
      state: 'D1', phase: 'WR2', kind: 'message', from: 'gryth2', to: 'local1', frame: 'EXCHANGE',
      label: 'files.write replace — expected base 4 (STALE)',
      payload: { share: 'ws1', gladeId: 'files.write', verb: 'files.write:replace', correlationId: 'w-2', key: '{path:src/lib.rs, verb:replace, expectedBase:4}', shape: 'exchange' },
      note: 'gryth2 read revision 4 and never saw gryth1’s write — it still believes the base is 4. This is the concurrent-edit that last-writer-wins would silently clobber.',
      docRef: `${GF} §4.1`,
      sets: { gryth2: { 'pending w-2': 'files.write replace src/lib.rs @base 4 (stale)' } },
    },
    {
      state: 'D2', phase: 'WR2', kind: 'message', from: 'local1', to: 'peer1', frame: 'EXCHANGE',
      label: 'routed to the claim-holder',
      payload: { share: 'ws1', verb: 'files.write:replace', correlationId: 'w-2' },
      note: 'Routes to the lock-holder like any write — the conflict is detected at the authority, not guessed at the edge.',
      docRef: `${GF} §4.1`,
    },
    {
      state: 'D3', variant: 'a',
      variantNote: 'compare FAILS: expected base 4 ≠ current 5 → CONFLICT; the base is NOT overwritten (no silent last-writer-wins).',
      phase: 'WR2', kind: 'internal', from: 'peer1', frame: 'PROVIDE',
      label: 'compare-and-replace: base 4 ≠ current 5 → CONFLICT',
      payload: { share: 'ws1', correlationId: 'w-2', detail: { compare: 'expected 4 ≠ current 5', action: 'REFUSED — base changed under the writer', lww: 'silent last-writer-wins is forbidden (D12)' } },
      note: 'D12: conflict is EXPLICIT — last-writer-wins MUST NOT silently overwrite a changed base. The working copy stays at revision 5; gryth1’s write is not lost.',
      docRef: `${GF} §4.1 (RULED — D12)`,
      sets: { peer1: { 'conflict w-2': 'expected 4, current 5 — replace refused, base intact' } },
    },
    {
      state: 'D4', variant: 'a',
      variantNote: 'ExchangeRes CONFLICT outcome — ok:false, carrying current revision 5 so the caller can re-read and retry.',
      phase: 'WR2', kind: 'message', from: 'peer1', to: 'local1', frame: 'EXCHANGE-RESP',
      label: 'conflict outcome — ok:false, current 5', response: true,
      payload: { share: 'ws1', correlationId: 'w-2', detail: { ok: 'false', outcome: 'conflict', currentRevision: '5' } },
      note: 'The conflict rides the ordinary ExchangeRes as data (GladeSupplierModel §6) — the current revision comes back so the retry can rebase.',
      docRef: `${GF} §4.1 · GladeSupplierModel §6`,
    },
    {
      state: 'D5', phase: 'WR2', kind: 'message', from: 'local1', to: 'gryth2', frame: 'EXCHANGE-RESP',
      label: 'conflict surfaced as DATA', response: true,
      payload: { share: 'ws1', correlationId: 'w-2', detail: { result: 'conflict', reason: 'stale base — file moved to revision 5', remedy: 're-read and retry against 5' } },
      note: 'gryth2 gets an explicit conflict — never a silent overwrite and never an exception. Conflict-as-data: the UI renders it and offers the retry.',
      docRef: `${GF} §4.1`,
      sets: { gryth2: { 'pending w-2': null, view: 'src/lib.rs: WRITE CONFLICT — base moved 4 → 5 (re-read to retry)' } },
    },
    {
      state: 'D1', phase: 'WR3', kind: 'message', from: 'gryth2', to: 'local1', frame: 'EXCHANGE',
      label: 'retry: files.write replace — expected base 5',
      payload: { share: 'ws1', gladeId: 'files.write', verb: 'files.write:replace', correlationId: 'w-3', key: '{path:src/lib.rs, verb:replace, expectedBase:5}', shape: 'exchange' },
      note: 'gryth2 re-reads to revision 5, rebases its edit, and retries with the correct expected base.',
      docRef: `${GF} §4.1`,
      sets: { gryth2: { view: 'src/lib.rs @rev 5 (re-read)', 'pending w-3': 'files.write replace src/lib.rs @base 5' } },
    },
    {
      state: 'D2', phase: 'WR3', kind: 'message', from: 'local1', to: 'peer1', frame: 'EXCHANGE',
      label: 'routed to the claim-holder',
      payload: { share: 'ws1', verb: 'files.write:replace', correlationId: 'w-3' },
      note: 'Same write path, correct base this time.',
      docRef: `${GF} §4.1`,
    },
    {
      state: 'D3', phase: 'WR3', kind: 'internal', from: 'peer1', frame: 'PROVIDE',
      label: 'compare-and-replace: base 5 == current 5 → APPLY',
      payload: { share: 'ws1', correlationId: 'w-3', detail: { compare: 'expected 5 == current 5', revision: '5 → 6' } },
      note: 'With the correct expected base the retry applies cleanly — compare-and-replace makes conflict recoverable, not fatal; no update was ever silently lost.',
      docRef: `${GF} §4.1`,
      sets: { peer1: { wc: 'working copy + lock — src/lib.rs @ revision 6', 'generation ws1/src/lib.rs': 'gen 6 (replace by gryth2, retried)' } },
    },
    {
      state: 'D5', phase: 'WR3', kind: 'message', from: 'local1', to: 'gryth2', frame: 'EXCHANGE-RESP',
      label: 'retry applied @rev 6', response: true,
      payload: { share: 'ws1', correlationId: 'w-3', detail: { ok: 'true', newRevision: '6' } },
      note: 'The retried write lands at revision 6 — both edits survive in order, which is the whole point of compare-and-replace over silent LWW.',
      docRef: `${GF} §4.1`,
      sets: { gryth2: { 'pending w-3': null, view: 'src/lib.rs @rev 6 (retry applied — no write lost)' } },
    },
  ],
};

// ---------------------------------------------------------------------------
// s-tree-subtree (RULED — D7): ws.tree is keyed per canonical workspace-relative
// DIRECTORY path. The SAME per-directory path policy runs per key, so a /src read
// grant serves /src and HIDES /secret — impossible over a monolithic {root} value.
// A write outside the granted subtree fails as data (ExchangeRes ok:false). This
// is the stage-2 AZ-1 enforcement point.
// ---------------------------------------------------------------------------
export const S_TREE_SUBTREE: Scenario = {
  id: 's-tree-subtree',
  stage: 2,
  title: 'ws.tree per-directory keying — /src serves, /secret hides',
  summary:
    'A /src read grant lists /src, but the SAME per-directory path policy redacts /secret and refuses a write into it — subtree redaction, expressible only because ws.tree keys per directory (D7).',

  actors: pick('gryth1', 'local1', 'peer1'),

  initial: {
    gryth1: { session: 'local1 (open)' },
    local1: {
      'fold home': 'claim: ws1@peer1',
      links: 'peer1 (iroh)',
      'grant gryth1 ws1': 'read.subscribe /src (path-scoped — AZ-1)',
    },
    peer1: {
      serving: 'ws1 via grazel',
      'ws.tree': 'keyed per directory: /src, /secret, /docs (canonical workspace-relative dir paths)',
    },
  },

  phases: [
    { id: 'TS1', label: 'List /src — granted', summary: 'The /src directory key matches the /src grant; the listing serves.' },
    { id: 'TS2', label: 'List /secret — redacted', summary: 'The same path policy on the /secret key finds no grant — hidden.' },
    { id: 'TS3', label: 'Write outside subtree — denied', summary: 'A write into /secret fails as data — the AZ-1 write gate.' },
  ],

  steps: [
    {
      state: 'A1', phase: 'TS1', kind: 'message', from: 'gryth1', to: 'local1', frame: 'HELLO',
      label: 'certified session — principal gianni',
      payload: { detail: { session: 'sess-tree', principal: 'gianni (node-authenticated, B3)', deviceCert: 'valid' } },
      gate: { kind: 'security', label: 'HELLO principal seam', status: 'enforced', note: 'Attribution is REAL from day one (B3/B4): the principal is node-authenticated from the session and delivered BESIDE the request DTO — never a caller-payload Hello.principal field.' },
      note: 'The B3 ProviderCallContext principal established here is what the per-directory path policy authorizes against — path-scoped redaction needs a real principal, not a stub.',
      docRef: `${GF} §4.5 (RULED — B3/B4)`,
      sets: { local1: { 'session gryth1': 'open (principal: gianni)' } },
    },
    {
      state: 'C1', phase: 'TS1', kind: 'message', from: 'gryth1', to: 'local1', frame: 'SUBSCRIBE',
      label: 'ws.tree subscribe — dir key /src',
      payload: { share: 'ws1', gladeId: 'ws.tree', key: '{dir:"/src"}', shape: 'value' },
      note: 'D7: ws.tree is keyed by a canonical workspace-relative DIRECTORY path (not a monolithic {root} value). Names never serve as workspace identity — the stable workspace/share ID routes (E-ws-1).',
      docRef: `${GF} §4.4 (RULED — D7)`,
      sets: { gryth1: { subs: 'ws1/ws.tree{/src}' } },
    },
    {
      state: 'C2', phase: 'TS1', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'route on workspace id; the dir key rides',
      payload: { share: 'ws1', detail: { answer: 'peer1 (claim valid)', keying: 'the stable workspace/share ID routes; the /src directory key rides along' } },
      gate: { kind: 'routing', label: 'ServeClaim lookup', status: 'designed', note: 'Routing keys on the workspace id, not the directory name — names are not identity (E-ws-1).' },
      note: 'The share picks the provider; the directory key rides the subscription to pick which listing.',
      docRef: `${GF} §4.4`,
      sets: { local1: { 'route ws1': 'peer1', 'sub ws1/ws.tree': 'gryth1' } },
    },
    {
      state: 'C3', phase: 'TS1', kind: 'message', from: 'local1', to: 'peer1', frame: 'SUBSCRIBE',
      label: 'forward /src interest',
      payload: { share: 'ws1', gladeId: 'ws.tree', key: '{dir:"/src"}', shape: 'value' },
      gate: { kind: 'capability', label: 'per-directory capability check', status: 'enforced', note: 'The per-directory path policy check runs per directory key — the /src grant authorizes the /src key (stage-2 AZ-1 enforced).' },
      note: 'Interest forwarded for the /src directory key specifically — the unit the path policy checks.',
      docRef: `${GF} §4.4/§7`,
      sets: { peer1: { 'sub ws1/ws.tree': 'local1' } },
    },
    {
      state: 'S4', variant: 'a',
      variantNote: 'per-DIRECTORY path policy (D7): the /src read grant authorizes the /src directory key → ALLOW.',
      phase: 'TS1', kind: 'internal', from: 'peer1', frame: 'ROUTE',
      label: 'path policy: /src → ALLOW',
      payload: { share: 'ws1', detail: { key: '/src', grant: 'gryth1 has read.subscribe /src', verdict: 'ALLOW' } },
      gate: { kind: 'capability', label: 'per-directory path policy', status: 'enforced', note: 'The SAME path policy check runs per directory key; a /src grant matches the /src key. This is the mechanism that makes /secret separately deniable.' },
      note: 'The per-directory check is what lets one grant authorize one subtree without leaking siblings — the AZ-1 point (AuthzModel §2/§6).',
      docRef: `${GF} §4.4 · ${AZ} §2/§6`,
    },
    {
      state: 'C5', phase: 'TS1', kind: 'message', from: 'peer1', to: 'local1', frame: 'OPS',
      label: '/src listing served', response: true,
      payload: { share: 'ws1', gladeId: 'ws.tree', key: '{dir:"/src"}', detail: { listing: 'src/lib.rs, src/main.rs, …', revision: 'rev 12', continuation: 'token abc (bounded listing)' } },
      note: 'D7: one bounded listing + explicit revision + continuation token per directory key.',
      docRef: `${GF} §4.4`,
      sets: { local1: { replica: 'ws1/ws.tree{/src} @rev 12' } },
    },
    {
      state: 'C6', phase: 'TS1', kind: 'message', from: 'local1', to: 'gryth1', frame: 'OPS',
      label: '/src listing to the consumer', response: true,
      payload: { share: 'ws1', gladeId: 'ws.tree', key: '{dir:"/src"}' },
      note: 'gryth1 sees /src because its grant is scoped to /src — the positive arm of subtree access.',
      docRef: `${GF} §4.4`,
      sets: { gryth1: { view: '/src listed (src/lib.rs, src/main.rs)' } },
    },
    {
      state: 'C1', variant: 'a',
      variantNote: 'same surface, DIFFERENT directory key — /secret; the ONLY thing that changed is the key the path policy checks.',
      phase: 'TS2', kind: 'message', from: 'gryth1', to: 'local1', frame: 'SUBSCRIBE',
      label: 'ws.tree subscribe — dir key /secret',
      payload: { share: 'ws1', gladeId: 'ws.tree', key: '{dir:"/secret"}', shape: 'value' },
      note: 'The consumer asks a sibling directory key. Because ws.tree keys per directory (D7), this is a separately-checkable request — impossible to isolate over a monolithic {root} value.',
      docRef: `${GF} §4.4`,
      sets: { gryth1: { 'subs secret': 'ws1/ws.tree{/secret} (requested)' } },
    },
    {
      state: 'S4', variant: 'b',
      variantNote: 'per-directory policy at the NODE hop: gryth1’s grant is scoped to /src; the /secret directory key finds NO matching grant → DENY (every hop enforces from its own fold).',
      phase: 'TS2', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'path policy: /secret → DENY (redacted)',
      payload: { share: 'ws1', detail: { key: '/secret', grant: 'gryth1 has /src only — none for /secret', verdict: 'DENY — subtree redacted' } },
      gate: { kind: 'capability', label: 'per-directory path policy', status: 'enforced', note: 'D7 crux: the SAME path policy check runs per directory key, so a /src read grant HIDES /secret — impossible over a monolithic {root} value, where one grant would leak the whole tree.' },
      note: 'Enforcement at every hop: the node denies the /secret key from its own grant fold before forwarding. Same principal, same surface, different directory key — one served, one hidden.',
      docRef: `${GF} §4.4 (RULED — D7) · §7`,
      sets: { local1: { 'denied gryth1 /secret': 'no path grant — subtree redacted' } },
    },
    {
      state: 'S3', phase: 'TS2', kind: 'message', from: 'local1', to: 'gryth1', frame: 'STATUS',
      label: '/secret redacted — denied as data', response: true,
      payload: { share: 'ws1', detail: { result: 'denied', key: '/secret', reason: 'read grant is scoped to /src', remedy: 'request a grant covering /secret' } },
      gate: { kind: 'security', label: 'enforcement cut', status: 'enforced', note: 'The redaction is data with a named remedy; /secret simply is not in the tree gryth1 can name. AZ-1 path-scoped grants ENFORCE at stage-2.' },
      note: 'The negative arm: per-directory keying makes /src and /secret separately answerable, and the /secret answer is a redaction. THAT separability is the AZ-1 enforcement point.',
      docRef: `${GF} §7 (stage-2 AZ-1)`,
      sets: { gryth1: { 'subs secret': null, 'view secret': '/secret: ACCESS DENIED (grant scoped to /src)' } },
    },
    {
      state: 'D1', phase: 'TS3', kind: 'message', from: 'gryth1', to: 'local1', frame: 'EXCHANGE',
      label: 'files.write replace — /secret/keys.txt',
      payload: { share: 'ws1', gladeId: 'files.write', verb: 'files.write:replace', correlationId: 'tw-1', key: '{path:/secret/keys.txt, verb:replace, expectedBase:12}', shape: 'exchange' },
      note: 'A write TARGETING a path outside the granted subtree — the write-side of the same path-scoping question.',
      docRef: `${GF} §4.4/§7`,
      sets: { gryth1: { 'pending tw-1': 'files.write replace /secret/keys.txt' } },
    },
    {
      state: 'S6', phase: 'TS3', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'verb check: write path /secret outside grant → DENY',
      payload: { share: 'ws1', correlationId: 'tw-1', detail: { verb: 'files.write:replace', path: '/secret/keys.txt', grant: '/src only', verdict: 'DENY' } },
      gate: { kind: 'capability', label: 'exchange verb check', status: 'enforced', note: 'A write outside the granted subtree fails as data (D7 keying + D14 RootRelativePath make the scope expressible); the authority evaluates the verb against the path grant before touching the working copy.' },
      note: 'The write gate mirrors the read redaction: the same /src grant that hides /secret also refuses a write into it — one path-scoping model, both directions.',
      docRef: `${GF} §4.4/§7 · §4.3 (RULED — D14)`,
      sets: { local1: { 'denied gryth1 write': '/secret/keys.txt — outside /src grant' } },
    },
    {
      state: 'D5', phase: 'TS3', kind: 'message', from: 'local1', to: 'gryth1', frame: 'EXCHANGE-RESP',
      label: 'write refused — ExchangeRes ok:false', response: true,
      payload: { share: 'ws1', correlationId: 'tw-1', detail: { ok: 'false', reason: 'write outside granted subtree (/src)', note: 'a denied write fails AS DATA (ExchangeRes{ok:false})' } },
      note: 'The write outside the granted path fails as data, not an exception — closing the AZ-1 loop that per-directory keying opened (D7 makes subtree scope expressible; stage-2 enforces it).',
      docRef: `${GF} §4.4 (RULED — D7) · §7`,
      sets: { gryth1: { 'pending tw-1': null, 'view write': '/secret/keys.txt: write DENIED as data' } },
    },
  ],
};
