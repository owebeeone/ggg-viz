// s-boot is the executable spec for GDL-036: it must pin the observable boot
// behaviour so the interim blob StoreApi and the real home-share folds produce
// the SAME trace. These assertions are the pins.
import { describe, expect, it } from 'vitest';
import { CATALOG } from './catalog';
import { checkInvariants } from './invariants';
import { validateScenario, actorStateAt } from './fold';
import { S_BOOT } from './boot';

const idx = (pred: (s: (typeof S_BOOT.steps)[number]) => boolean) =>
  S_BOOT.steps.findIndex(pred);

describe('s-boot — the system-data seam', () => {
  it('is a stage-1 substrate trace that validates and holds the invariants', () => {
    expect(S_BOOT.stage).toBe(1);
    expect(validateScenario(S_BOOT, CATALOG)).toEqual([]);
    expect(checkInvariants(S_BOOT)).toEqual([]);
  });

  it('runs the load-validation ladder in class order: identity → load → verify → fail-closed', () => {
    const nodeKey = idx((s) => s.state === 'N2'); // class 1
    const loadBlob = idx((s) => s.state === 'N3'); // class 2 load
    const verify = idx((s) => s.state === 'Y2'); // class 2 verify-as-ingest
    const failClosed = idx((s) => s.state === 'N4'); // class 3
    expect(nodeKey).toBeGreaterThanOrEqual(0);
    expect(nodeKey).toBeLessThan(loadBlob);
    expect(loadBlob).toBeLessThan(verify);
    expect(verify).toBeLessThan(failClosed);
    // verify-as-ingest carries the security gate — the disk is another carrier.
    expect(S_BOOT.steps[verify].gate?.kind).toBe('security');
    expect(S_BOOT.steps[failClosed].gate?.kind).toBe('security');
  });

  it('loads the whole system state as ONE taut SystemSnapshot blob through StoreApi', () => {
    const load = S_BOOT.steps.find((s) => s.state === 'N3')!;
    expect(load.frame).toBe('HYDRATE');
    expect(JSON.stringify(load.payload)).toMatch(/SystemSnapshot/);
  });

  it('appends the node’s own presence with ORIGIN attribution (blob-land, still attributed)', () => {
    const append = S_BOOT.steps.find((s) => s.state === 'K1')!;
    expect(append.frame).toBe('APPEND');
    expect(JSON.stringify(append.payload)).toMatch(/origin/i);
  });

  it('answers the first UI query over the materialised fold (RegistryApi ready, then A4→A5)', () => {
    const ready = idx((s) => s.state === 'N5');
    const fold = idx((s) => s.state === 'A4');
    const serve = idx((s) => s.state === 'A5');
    expect(ready).toBeGreaterThanOrEqual(0);
    expect(ready).toBeLessThan(fold);
    expect(fold).toBeLessThan(serve);
    // the serve is the home directory — a RegistryApi query in disguise.
    const s = S_BOOT.steps[serve];
    expect(s.payload?.share).toBe('home');
    expect(s.to).toBe('gryth1');
    // and the node had built that fold before any client connected.
    const helloAt = idx((st) => st.state === 'A1');
    expect(ready).toBeLessThan(helloAt);
  });

  it('the node is booted (registry ready) before the UI HELLO lands', () => {
    const helloAt = idx((s) => s.state === 'A1');
    const state = actorStateAt(S_BOOT, helloAt);
    expect(state.get('local1')?.['registry']).toMatch(/ready/);
  });
});
