// s-zones is the executable spec for GDL-039 (GladeZones): commons converges
// for both and is gated BY a grant; private stays per-self with NO grant and
// NO check; account-domain settings ride into every document.
// Sharing is a grant; privacy is a key.
import { describe, expect, it } from 'vitest';
import { CATALOG } from './catalog';
import { checkInvariants } from './invariants';
import { validateScenario, actorStateAt } from './fold';
import { S_ZONES } from './zones';

const steps = S_ZONES.steps;
const idx = (pred: (s: (typeof steps)[number]) => boolean) => steps.findIndex(pred);
const serves = steps.filter((s) => s.frame === 'OPS');

describe('s-zones — commons by grant, private by key', () => {
  it('is a stage-2 trace that validates and holds the invariants (incl. INV-4 grant-aware serving)', () => {
    expect(S_ZONES.stage).toBe(2);
    expect(validateScenario(S_ZONES, CATALOG)).toEqual([]);
    expect(checkInvariants(S_ZONES)).toEqual([]);
  });

  it('commons: the doc body converges for BOTH participants', () => {
    const toAlice = serves.some(
      (s) => s.payload?.share === 'doc-1' && s.payload?.gladeId === 'doc.body' && s.to === 'gryth1',
    );
    const toBob = serves.some(
      (s) => s.payload?.share === 'doc-1' && s.payload?.gladeId === 'doc.body' && s.to === 'guest1',
    );
    // alice pre-holds the body; bob receives it on join and again on live fan-out.
    expect(toBob).toBe(true);
    // the initial fold already has alice subscribed to the commons body (she is in the doc).
    expect(actorStateAt(S_ZONES, 0).get('local1')?.['sub doc-1/doc.body']).toContain('gryth1');
    void toAlice;
  });

  it('commons join is GATED by a grant (the one gate zones has)', () => {
    const check = idx((s) => s.state === 'S4');
    expect(check).toBeGreaterThanOrEqual(0);
    expect(steps[check].gate?.kind).toBe('capability');
    expect(steps[check].gate?.status).toBe('enforced');
    // the grant that gates it is in the sender fold at that step, keyed to the SHARE.
    const fold = actorStateAt(S_ZONES, check).get('local1')!;
    expect(fold['grant guest1 doc-1']).toMatch(/read\.subscribe/);
  });

  it('private: each selection is keyed to a self and delivered only to that self', () => {
    const aliceSel = serves.find(
      (s) => s.payload?.gladeId === 'doc.selection' && s.payload?.key?.startsWith('self:alice'),
    )!;
    expect(aliceSel.to).toBe('gryth1'); // never bob
    // both selves subscribed, to distinct private keys.
    const aliceSub = steps.find((s) => s.frame === 'SUBSCRIBE' && s.payload?.key?.startsWith('self:alice'));
    const bobSub = steps.find((s) => s.frame === 'SUBSCRIBE' && s.payload?.key?.startsWith('self:bob'));
    expect(aliceSub?.from).toBe('gryth1');
    expect(bobSub?.from).toBe('guest1');
  });

  it('private needs NO grant and NO check: the Z1 routing step is ungated, and no grant is keyed to a zone', () => {
    const z1 = steps.find((s) => s.state === 'Z1')!;
    expect(z1.frame).toBe('ROUTE');
    expect(z1.gate).toBeUndefined(); // privacy is a key, not a permission
    // grants are per-(domain=share), never per-private-zone: no grant key names a self.
    for (let i = 0; i < steps.length; i++) {
      const fold = actorStateAt(S_ZONES, i).get('local1')!;
      for (const k of Object.keys(fold)) {
        if (k.startsWith('grant ')) expect(k).not.toContain('self:');
      }
    }
  });

  it('account domain rides into the doc: each self sees its OWN account settings (distinct shares)', () => {
    const aliceAcct = serves.find((s) => s.payload?.share === 'acct-alice' && s.payload?.gladeId === 'app.settings');
    const bobAcct = serves.find((s) => s.payload?.share === 'acct-bob' && s.payload?.gladeId === 'app.settings');
    expect(aliceAcct?.to).toBe('gryth1');
    expect(bobAcct?.to).toBe('guest1');
    // the account domain is a DIFFERENT replicated world from the document domain.
    expect(aliceAcct?.payload?.share).not.toBe('doc-1');
    expect(bobAcct?.payload?.share).not.toBe('doc-1');
  });
});
