// s-app-register is the executable spec for GDL-037/038: the <app>.glade file
// is runtime DATA, its ACL seeds become ordinary grant records, and the
// management surface is ordinary bindings — never a privileged plane.
import { describe, expect, it } from 'vitest';
import { CATALOG } from './catalog';
import { checkInvariants } from './invariants';
import { validateScenario, actorStateAt } from './fold';
import { S_APP_REGISTER } from './register';

const steps = S_APP_REGISTER.steps;
const idx = (pred: (s: (typeof steps)[number]) => boolean) => steps.findIndex(pred);

describe('s-app-register — .glade loaded as data', () => {
  it('validates and holds the invariants', () => {
    expect(validateScenario(S_APP_REGISTER, CATALOG)).toEqual([]);
    expect(checkInvariants(S_APP_REGISTER)).toEqual([]);
  });

  it('loads the app file as DATA, not as a compiler front-end', () => {
    const read = steps.find((s) => s.state === 'P1')!;
    expect(read.frame).toBe('FOLD'); // a load, not a build step
    const p = JSON.stringify(read.payload);
    expect(p).toMatch(/LOADED, not compiled/);
    expect(p).toMatch(/grazel-app\.glade/);
  });

  it('registers glade ids + shapes as the SAME records dynamic config writes', () => {
    const register = steps.find((s) => s.state === 'P2')!;
    expect(register.frame).toBe('APPEND');
    expect(JSON.stringify(register.payload)).toMatch(/dynamic configuration/);
  });

  it('compiles ACL seeds to ordinary grant records under the registrant’s chain', () => {
    const seed = idx((s) => s.state === 'S1');
    expect(seed).toBeGreaterThanOrEqual(0);
    const step = steps[seed];
    expect(step.frame).toBe('APPEND');
    expect(JSON.stringify(step.payload)).toMatch(/CapabilityGrant/);
    // the seed becomes a real grant in the fold.
    const fold = actorStateAt(S_APP_REGISTER, seed).get('local1')!;
    expect(Object.keys(fold).some((k) => k.startsWith('grant '))).toBe(true);
  });

  it('keeps the fold as the ONLY runtime authority (seeds are a bootstrap shortcut)', () => {
    const authority = steps.find((s) => s.state === 'A4' && s.phase === 'RC')!;
    expect(authority).toBeTruthy();
    expect(JSON.stringify(authority.payload)).toMatch(/WIN by ordinary fold rules/);
  });

  it('management surface: reads are subscriptions, writes are appends — no privileged plane', () => {
    const read = steps.find((s) => s.phase === 'RM' && s.frame === 'SUBSCRIBE')!;
    const write = steps.find((s) => s.phase === 'RM' && s.frame === 'APPEND')!;
    expect(read.payload?.gladeId).toBe('dir.grants'); // a system share binding
    expect(write.frame).toBe('APPEND'); // a write is an ordinary record append
    // the only gate anywhere is the ordinary allow-all HELLO seam — no admin plane.
    const gated = steps.filter((s) => s.gate);
    expect(gated.every((s) => s.gate!.status === 'stub-allow-all')).toBe(true);
    expect(gated.every((s) => s.frame === 'HELLO')).toBe(true);
  });
});
