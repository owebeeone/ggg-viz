// The suite gate: every trace validates against the atlas, satisfies the
// cross-cutting invariants, and keeps the doc-tool guarantees.
import { describe, expect, it } from 'vitest';
import { CATALOG } from './catalog';
import { checkInvariants } from './invariants';
import { SCENARIOS } from './index';
import { validateScenario } from './fold';

describe('trace suite', () => {
  it('scenario ids are unique', () => {
    const ids = SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const sc of SCENARIOS) {
    describe(sc.id, () => {
      it('validates against the catalog atlas', () => {
        expect(validateScenario(sc, CATALOG)).toEqual([]);
      });

      it('satisfies the cross-cutting invariants', () => {
        expect(checkInvariants(sc)).toEqual([]);
      });

      it('has phases and every phase has steps', () => {
        expect(sc.phases.length).toBeGreaterThan(0);
        for (const p of sc.phases) {
          expect(
            sc.steps.some((s) => s.phase === p.id),
            `${sc.id} phase ${p.id} empty`,
          ).toBe(true);
        }
      });

      it('every SUBSCRIBE carries the routing tuple (share, glade id, shape)', () => {
        for (const s of sc.steps.filter((x) => x.frame === 'SUBSCRIBE')) {
          expect(s.payload?.share, `${sc.id}/${s.state}`).toBeTruthy();
          expect(s.payload?.gladeId, `${sc.id}/${s.state}`).toBeTruthy();
          expect(s.payload?.shape, `${sc.id}/${s.state}`).toBeTruthy();
        }
      });

      it('every gate step cites a doc', () => {
        for (const s of sc.steps.filter((x) => x.gate)) {
          expect(s.docRef, `${sc.id}/${s.state}`).toBeTruthy();
        }
      });

      it('keeps glade frames off iroh edges', () => {
        const gladeFrames = new Set([
          'HELLO', 'HELLO-ACK', 'SUBSCRIBE', 'UNSUBSCRIBE', 'OPS', 'HEADS', 'EXCHANGE', 'EXCHANGE-RESP', 'APPEND',
        ]);
        for (const s of sc.steps) {
          if (s.from === 'iroh' || s.to === 'iroh') {
            expect(gladeFrames.has(s.frame), `${sc.id}/${s.state} glade frame on iroh edge`).toBe(false);
          }
        }
      });
    });
  }

  it('the suite covers all four gate classes', () => {
    const kinds = new Set(
      SCENARIOS.flatMap((sc) => sc.steps.map((s) => s.gate?.kind).filter(Boolean)),
    );
    for (const k of ['security', 'discovery', 'capability', 'routing']) {
      expect(kinds).toContain(k);
    }
  });

  it('stage 2 exists and actually enforces', () => {
    const stage2 = SCENARIOS.filter((s) => s.stage === 2);
    expect(stage2.length).toBeGreaterThan(0);
    expect(
      stage2.some((sc) => sc.steps.some((s) => s.gate?.status === 'enforced')),
    ).toBe(true);
  });

  it('the golden path keeps its failure leg', () => {
    const disc = SCENARIOS.find((s) => s.id === 's-discovery')!;
    expect(
      disc.steps.some(
        (s) => s.frame === 'STATUS' && s.to === 'gryth1' && s.payload?.detail?.result === 'timeout',
      ),
    ).toBe(true);
  });

  it('temp actors appear somewhere (the service story is present)', () => {
    expect(
      SCENARIOS.some((sc) => sc.actors.some((a) => a.temp)),
    ).toBe(true);
  });
});
