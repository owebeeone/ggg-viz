import { describe, expect, it } from 'vitest';
import {
  activityAt,
  actorStateAt,
  clampStep,
  edgeForStep,
  stepAt,
  traceUpTo,
  validateScenario,
  visibleActorsAt,
} from './fold';
import type { CatalogState, Scenario } from './types';
import { stepId } from './types';

const actor = (id: string, temp = false) => ({
  id,
  label: id,
  sub: '',
  role: 'node' as const,
  x: 0,
  y: 0,
  w: 10,
  h: 10,
  internals: [],
  blurb: '',
  ...(temp ? { temp: true } : {}),
});

const MINI_CATALOG: Record<string, CatalogState> = {
  X1: { id: 'X1', title: 'ask', frame: 'EXCHANGE', kind: 'message', desc: '' },
  X2: { id: 'X2', title: 'decide', frame: 'ROUTE', kind: 'internal', gateKind: 'routing', desc: '' },
  X3: { id: 'X3', title: 'answer', frame: 'EXCHANGE-RESP', kind: 'message', desc: '' },
};

const MINI: Scenario = {
  id: 'mini',
  stage: 1,
  title: 'mini',
  summary: '',
  actors: [actor('a'), actor('b'), actor('c'), actor('svc', true)],
  phases: [
    { id: 'p1', label: 'P1', summary: '' },
    { id: 'p2', label: 'P2', summary: '' },
  ],
  initial: { a: { mood: 'ready' } },
  steps: [
    {
      state: 'X1',
      phase: 'p1',
      kind: 'message',
      from: 'a',
      to: 'b',
      frame: 'EXCHANGE',
      label: 'ask',
      payload: { correlationId: 'c-1' },
      note: 'request',
      sets: { b: { pending: 'c-1' }, svc: { alive: 'yes' } },
    },
    {
      state: 'X2',
      phase: 'p1',
      kind: 'internal',
      from: 'b',
      frame: 'ROUTE',
      label: 'decide',
      gate: { kind: 'routing', label: 'route', status: 'designed', note: 'pick provider' },
      note: 'gate',
    },
    {
      state: 'X3',
      phase: 'p2',
      kind: 'message',
      from: 'b',
      to: 'a',
      frame: 'EXCHANGE-RESP',
      label: 'answer',
      response: true,
      payload: { correlationId: 'c-1' },
      note: 'response',
      sets: { b: { pending: null }, svc: { alive: null } },
    },
  ],
};

describe('stepId', () => {
  it('renders base and variant ids', () => {
    expect(stepId(MINI.steps[0])).toBe('X1');
    expect(stepId({ ...MINI.steps[0], variant: 'a' })).toBe('X1.a');
  });
});

describe('clampStep / stepAt / traceUpTo', () => {
  it('clamps into range', () => {
    expect(clampStep(MINI, -5)).toBe(0);
    expect(clampStep(MINI, 99)).toBe(2);
  });

  it('stepAt returns the clamped step', () => {
    expect(stepAt(MINI, 0).state).toBe('X1');
    expect(stepAt(MINI, 99).state).toBe('X3');
  });

  it('traceUpTo is inclusive of the current step', () => {
    expect(traceUpTo(MINI, 1).map(stepId)).toEqual(['X1', 'X2']);
  });
});

describe('edgeForStep / activityAt', () => {
  it('message steps yield an edge with direction; internals none', () => {
    expect(edgeForStep(MINI.steps[0])).toEqual({ from: 'a', to: 'b', response: false });
    expect(edgeForStep(MINI.steps[1])).toBeNull();
  });

  it('marks sender/receiver, gated internals, idle others', () => {
    const act = activityAt(MINI, 0);
    expect(act.get('a')).toBe('sending');
    expect(act.get('b')).toBe('receiving');
    expect(act.get('c')).toBe('idle');
    expect(activityAt(MINI, 1).get('b')).toBe('gated');
  });
});

describe('actorStateAt / visibleActorsAt', () => {
  it('applies initial state before step 0', () => {
    expect(actorStateAt(MINI, 0).get('a')).toEqual({ mood: 'ready' });
  });

  it('accumulates patches and null-deletes', () => {
    expect(actorStateAt(MINI, 1).get('b')).toEqual({ pending: 'c-1' });
    expect(actorStateAt(MINI, 2).get('b')).toEqual({});
  });

  it('temp actors are visible only while alive', () => {
    expect(visibleActorsAt(MINI, 0)).toContain('svc');
    expect(visibleActorsAt(MINI, 1)).toContain('svc');
    expect(visibleActorsAt(MINI, 2)).not.toContain('svc');
    // non-temp actors always visible
    expect(visibleActorsAt(MINI, 2)).toEqual(expect.arrayContaining(['a', 'b', 'c']));
  });
});

describe('validateScenario (structural)', () => {
  it('accepts a well-formed scenario', () => {
    expect(validateScenario(MINI)).toEqual([]);
  });

  it('rejects unknown actor references and unknown patch targets', () => {
    const bad: Scenario = {
      ...MINI,
      steps: [{ ...MINI.steps[0], to: 'ghost', sets: { phantom: { x: '1' } } }],
    };
    const errs = validateScenario(bad);
    expect(errs.some((e) => e.includes('ghost'))).toBe(true);
    expect(errs.some((e) => e.includes('phantom'))).toBe(true);
  });

  it('rejects message steps without a target and phases out of order', () => {
    const noTo: Scenario = { ...MINI, steps: [{ ...MINI.steps[0], to: undefined }] };
    expect(validateScenario(noTo).some((e) => e.includes('message step'))).toBe(true);
    const disorder: Scenario = {
      ...MINI,
      steps: [MINI.steps[0], MINI.steps[2], MINI.steps[1]],
    };
    expect(validateScenario(disorder).some((e) => e.includes('order'))).toBe(true);
  });

  it('rejects orphan response correlations and empty notes', () => {
    const orphan: Scenario = {
      ...MINI,
      steps: [{ ...MINI.steps[2], payload: { correlationId: 'orphan' } }],
    };
    expect(validateScenario(orphan).some((e) => e.includes('correlation'))).toBe(true);
    const blank: Scenario = { ...MINI, steps: [{ ...MINI.steps[0], note: '' }] };
    expect(validateScenario(blank).some((e) => e.includes('note'))).toBe(true);
  });

  it('rejects variants without a declared twist', () => {
    const bad: Scenario = { ...MINI, steps: [{ ...MINI.steps[0], variant: 'a' }] };
    expect(validateScenario(bad).some((e) => e.includes('variantNote'))).toBe(true);
  });
});

describe('validateScenario (catalog atlas)', () => {
  it('accepts steps matching their catalog states', () => {
    expect(validateScenario(MINI, MINI_CATALOG)).toEqual([]);
  });

  it('rejects unknown states', () => {
    const bad: Scenario = { ...MINI, steps: [{ ...MINI.steps[0], state: 'Z9' }] };
    expect(validateScenario(bad, MINI_CATALOG).some((e) => e.includes('not in catalog'))).toBe(true);
  });

  it('rejects frame/kind drift from the catalog', () => {
    const wrongFrame: Scenario = {
      ...MINI,
      steps: [{ ...MINI.steps[0], frame: 'OPS' as const }],
    };
    expect(validateScenario(wrongFrame, MINI_CATALOG).some((e) => e.includes('≠ catalog'))).toBe(
      true,
    );
  });

  it('rejects gate-kind drift from the catalog', () => {
    const wrongGate: Scenario = {
      ...MINI,
      steps: [
        {
          ...MINI.steps[1],
          gate: { kind: 'security', label: 'x', status: 'designed', note: 'y' },
        },
      ],
    };
    expect(validateScenario(wrongGate, MINI_CATALOG).some((e) => e.includes('≠ catalog'))).toBe(
      true,
    );
  });
});
