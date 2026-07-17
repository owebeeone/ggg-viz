// INV-4 unit coverage: a stage-2 trace that serves without a grant must fail;
// the same trace with the grant in the sender's fold must pass.
import { describe, expect, it } from 'vitest';
import { checkInvariants } from './invariants';
import type { Scenario } from './types';

const actor = (id: string, role: 'client' | 'node') => ({
  id,
  label: id,
  sub: '',
  role,
  x: 0,
  y: 0,
  w: 10,
  h: 10,
  internals: [],
  blurb: '',
});

const base: Scenario = {
  id: 'leaky',
  stage: 2,
  title: 'leaky',
  summary: '',
  actors: [actor('ui', 'client'), actor('node', 'node')],
  phases: [{ id: 'p', label: 'P', summary: '' }],
  initial: { node: { 'sub ws-x/tree': 'ui' } },
  steps: [
    {
      state: 'A5',
      phase: 'p',
      kind: 'message',
      from: 'node',
      to: 'ui',
      frame: 'OPS',
      label: 'serve',
      payload: { share: 'ws-x', gladeId: 'tree' },
      note: 'serve without grant',
    },
  ],
};

describe('INV-4 grant-aware serving', () => {
  it('flags a stage-2 serve with no grant in the sender fold', () => {
    const errs = checkInvariants(base);
    expect(errs.some((e) => e.includes('INV-4'))).toBe(true);
  });

  it('passes when the sender fold carries the grant', () => {
    const ok: Scenario = {
      ...base,
      initial: { node: { 'sub ws-x/tree': 'ui', 'grant ui ws-x': 'read.subscribe' } },
    };
    expect(checkInvariants(ok)).toEqual([]);
  });

  it('exempts stage-1 traces (allow-all by design)', () => {
    const stage1: Scenario = { ...base, stage: 1 };
    expect(checkInvariants(stage1).some((e) => e.includes('INV-4'))).toBe(false);
  });

  it('INV-5: flags a replica held without a matching operator hold-grant', () => {
    const bad: Scenario = {
      ...base,
      initial: {
        node: { operator: 'saas-corp', 'replica ws-x': 'live', 'sub ws-x/tree': 'ui', 'grant ui ws-x': 'read' },
      },
    };
    expect(checkInvariants(bad).some((e) => e.includes('INV-5'))).toBe(true);
    const ok: Scenario = {
      ...base,
      initial: {
        node: {
          operator: 'saas-corp',
          'replica ws-x': 'live',
          'hold ws-x': 'granted: gianni, saas-corp',
          'sub ws-x/tree': 'ui',
          'grant ui ws-x': 'read',
        },
      },
    };
    expect(checkInvariants(ok)).toEqual([]);
  });

  it('INV-5: nodes without an operator key are exempt (legacy traces)', () => {
    const legacy: Scenario = {
      ...base,
      initial: { node: { 'replica ws-x': 'live', 'sub ws-x/tree': 'ui', 'grant ui ws-x': 'read' } },
    };
    expect(checkInvariants(legacy).some((e) => e.includes('INV-5'))).toBe(false);
  });

  it('account domains: the OWNER needs no grant (owner-scoped carve-out, AZ-17)', () => {
    const owner: Scenario = {
      ...base,
      initial: { node: { 'sub acct-u/settings': 'ui', 'account acct-u': 'ui' } },
      steps: [{ ...base.steps[0], payload: { share: 'acct-u', gladeId: 'settings' } }],
    };
    expect(checkInvariants(owner).some((e) => e.includes('INV-4'))).toBe(false);
  });

  it('account domains: any NON-owner still needs a grant (the carve-out is owner-scoped, not blanket)', () => {
    const support: Scenario = {
      ...base,
      actors: [actor('ui', 'client'), actor('support', 'client'), actor('node', 'node')],
      initial: { node: { 'sub acct-u/settings': 'support', 'account acct-u': 'ui' } },
      steps: [{ ...base.steps[0], to: 'support', payload: { share: 'acct-u', gladeId: 'settings' } }],
    };
    expect(checkInvariants(support).some((e) => e.includes('INV-4'))).toBe(true);
  });

  it('exempts node↔node replication and the home share', () => {
    const nodeToNode: Scenario = {
      ...base,
      actors: [actor('ui', 'client'), actor('node', 'node'), actor('node2', 'node')],
      initial: { node: { 'sub ws-x/tree': 'node2' } },
      steps: [
        { ...base.steps[0], to: 'node2' },
      ],
    };
    expect(checkInvariants(nodeToNode).some((e) => e.includes('INV-4'))).toBe(false);
    const homeShare: Scenario = {
      ...base,
      steps: [{ ...base.steps[0], payload: { share: 'home', gladeId: 'dir' } }],
    };
    expect(checkInvariants(homeShare).some((e) => e.includes('INV-4'))).toBe(false);
  });
});

// INV-6 (glade-users §1.2): the principal fold is keyed by fingerprint, so
// after the fold no two principal records may share a fingerprint — every view
// converges to exactly one principal per fingerprint. A fold entry
// `principal <id>` whose value carries `fp:<hex>` is a folded principal.
describe('INV-6 fingerprint-canonical identity', () => {
  const withFolds = (folds: Record<string, Record<string, string>>): Scenario => ({
    id: 'ids',
    stage: 1,
    title: 'ids',
    summary: '',
    actors: [actor('n1', 'node'), actor('n2', 'node')],
    phases: [{ id: 'p', label: 'P', summary: '' }],
    initial: folds,
    steps: [{ state: 'A4', phase: 'p', kind: 'internal', from: 'n1', frame: 'FOLD', label: 'fold', note: 'fold' }],
  });

  it('flags two principal records that share a fingerprint (dedup failure)', () => {
    const bad = withFolds({ n1: { 'principal alice': 'fp:9c2e', 'principal alice-dup': 'fp:9c2e' } });
    expect(checkInvariants(bad).some((e) => e.includes('INV-6'))).toBe(true);
  });

  it('passes when each fingerprint maps to exactly one principal', () => {
    const ok = withFolds({ n1: { 'principal alice': 'fp:9c2e', 'principal bob': 'fp:b7c9' } });
    expect(checkInvariants(ok)).toEqual([]);
  });

  it('flags cross-view divergence — two nodes disagree on a fingerprint', () => {
    const diverge = withFolds({ n1: { 'principal alice': 'fp:9c2e' }, n2: { 'principal mallory': 'fp:9c2e' } });
    expect(checkInvariants(diverge).some((e) => e.includes('INV-6'))).toBe(true);
  });

  it('two principals sharing a display NAME but distinct fingerprints are fine (the two-freds case)', () => {
    const twoFreds = withFolds({
      n1: { 'principal fred-1': 'fp:a1b2 · name="fred"', 'principal fred-2': 'fp:b7c9 · name="fred"' },
    });
    expect(checkInvariants(twoFreds)).toEqual([]);
  });

  it('is opt-in by shape: folds with no principal/fp entries are unaffected (all pre-users traces)', () => {
    const none = withFolds({ n1: { 'sub home/dir': 'ui', 'claim ws-x': 'held — epoch 1' } });
    expect(checkInvariants(none).some((e) => e.includes('INV-6'))).toBe(false);
  });
});

// INV-7 (glade-diff §5, D3): a DERIVED surface must not launder access to its
// sources — Readers(derived) ⊆ ⋂ Readers(source). A stage-2 serve of a derived
// share to a client/service requires the receiver to hold a grant on EVERY
// source closure listed in the sender's `derived <share>/<gladeId>` entry.
// Opt-in by that key shape; matched on the specific share+gladeId being served.
describe('INV-7 derived-surface serve closure', () => {
  const DERIVED = 'sources: [ws-razel, ws-glade]';
  // local2 serves the derived svc/ws.diff to a receiver over an A5 OPS hop.
  const serve = (
    fold: Record<string, string>,
    opts?: { stage?: 1 | 2; rxRole?: 'client' | 'node'; share?: string; gladeId?: string },
  ): Scenario => ({
    id: 'derived-serve',
    stage: opts?.stage ?? 2,
    title: 'derived-serve',
    summary: '',
    actors: [actor('rx', opts?.rxRole ?? 'client'), actor('local2', 'node')],
    phases: [{ id: 'p', label: 'P', summary: '' }],
    initial: { local2: { 'sub svc/ws.diff': 'rx', 'grant rx svc': 'read.subscribe', ...fold } },
    steps: [
      {
        state: 'A5',
        phase: 'p',
        kind: 'message',
        from: 'local2',
        to: 'rx',
        frame: 'OPS',
        label: 'serve diff',
        payload: { share: opts?.share ?? 'svc', gladeId: opts?.gladeId ?? 'ws.diff' },
        note: 'serve derived surface',
      },
    ],
  });

  // Positive vector: derived serve to a reader holding BOTH source closures.
  const full = {
    'derived svc/ws.diff': DERIVED,
    'grant rx ws-razel': 'read.subscribe',
    'grant rx ws-glade': 'read.subscribe',
  };

  it('passes when the receiver holds read on BOTH source closures', () => {
    expect(checkInvariants(serve(full))).toEqual([]);
  });

  it('flags a derived serve missing the right source grant (names ws-glade)', () => {
    const { ['grant rx ws-glade']: _drop, ...missingGlade } = full;
    const errs = checkInvariants(serve(missingGlade));
    expect(errs.some((e) => e.includes('INV-7'))).toBe(true);
    expect(errs.some((e) => e.includes('INV-7') && e.includes('ws-glade'))).toBe(true);
  });

  it('flags a derived serve missing the left source grant (names ws-razel)', () => {
    const { ['grant rx ws-razel']: _drop, ...missingRazel } = full;
    const errs = checkInvariants(serve(missingRazel));
    expect(errs.some((e) => e.includes('INV-7') && e.includes('ws-razel'))).toBe(true);
  });

  it('owner-exempt: an `account <source>` naming the receiver satisfies that source', () => {
    const { ['grant rx ws-glade']: _drop, ...rest } = full;
    const owned = { ...rest, 'account ws-glade': 'rx' };
    expect(checkInvariants(serve(owned)).some((e) => e.includes('INV-7'))).toBe(false);
  });

  it('is opt-in by shape: a serve with no `derived …` entry never trips INV-7', () => {
    expect(checkInvariants(serve({})).some((e) => e.includes('INV-7'))).toBe(false);
  });

  it('exempts stage 1 (allow-all), even with a derived entry and no source grants', () => {
    const bare = { 'derived svc/ws.diff': DERIVED };
    expect(checkInvariants(serve(bare, { stage: 1 })).some((e) => e.includes('INV-7'))).toBe(false);
  });

  it('exempts a NODE/PROVIDER receiver (node-trust, parallel to INV-4)', () => {
    const bare = { 'derived svc/ws.diff': DERIVED };
    expect(
      checkInvariants(serve(bare, { rxRole: 'node' })).some((e) => e.includes('INV-7')),
    ).toBe(false);
  });

  it('a derived entry for a DIFFERENT gladeId does not gate a serve of another surface', () => {
    // The derived entry is svc/ws.diff, but the step serves svc/ws.other — no
    // source-closure check applies to the non-derived surface.
    const other = { 'derived svc/ws.diff': DERIVED, 'sub svc/ws.other': 'rx' };
    expect(
      checkInvariants(serve(other, { gladeId: 'ws.other' })).some((e) => e.includes('INV-7')),
    ).toBe(false);
  });
});
